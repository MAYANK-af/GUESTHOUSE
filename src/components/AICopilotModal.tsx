import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import { Sparkles, Send, Bot, User, CheckCircle, ArrowRight, CornerDownLeft, Loader2 } from 'lucide-react';
import { processCopilotQuery, type CopilotResult } from '@/lib/aiService';
import { supabase, type Room, type Guest, type Booking } from '@/lib/supabase';
import { createBooking, setRoomStatus, changeBookingStatus } from '@/lib/bookingService';
import type { RoomStatus, BookingStatusFsm } from '@/lib/roomFsm';

interface AICopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshData?: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  actionData?: CopilotResult;
  executed?: boolean;
}

export default function AICopilotModal({ isOpen, onClose, onRefreshData }: AICopilotModalProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Hello! I am your Front-Desk AI Copilot. You can tell me to book rooms, check availability, mark rooms clean, or calculate GST.',
    },
  ]);
  const [context, setContext] = useState<{ rooms: Room[]; guests: Guest[]; bookings: Booking[] }>({
    rooms: [],
    guests: [],
    bookings: [],
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    async function loadContext() {
      const [rRes, gRes, bRes] = await Promise.all([
        supabase.from('rooms').select('*'),
        supabase.from('guests').select('*'),
        supabase.from('bookings').select('*'),
      ]);
      setContext({
        rooms: (rRes.data as Room[]) ?? [],
        guests: (gRes.data as Guest[]) ?? [],
        bookings: (bRes.data as Booking[]) ?? [],
      });
    }
    loadContext();
  }, [isOpen]);

  const reloadContext = async () => {
    const [rRes, gRes, bRes] = await Promise.all([
      supabase.from('rooms').select('*'),
      supabase.from('guests').select('*'),
      supabase.from('bookings').select('*'),
    ]);
    setContext({
      rooms: (rRes.data as Room[]) ?? [],
      guests: (gRes.data as Guest[]) ?? [],
      bookings: (bRes.data as Booking[]) ?? [],
    });
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (userPrompt?: string) => {
    const text = (userPrompt ?? input).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      sender: 'user',
      text,
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const historyForAi = newMessages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.sender, text: m.text }));

      const res = await processCopilotQuery(text, context, historyForAi);
      const botMsg: ChatMessage = {
        id: Math.random().toString(),
        sender: 'assistant',
        text: res.message,
        actionData: res,
        executed: false,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: 'assistant',
          text: 'I ran into an issue processing that instruction. Please check the command and try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteAction = async (msgId: string, result: CopilotResult) => {
    try {
      const data = result.data as Record<string, unknown> | undefined;

      if (result.action === 'create_booking' && data) {
        let guestId = data.guestId as string | undefined;

        // Auto-provision new guest if name was provided but guest doesn't exist in DB
        if (!guestId && data.newGuest) {
          const newG = data.newGuest as { first_name?: string; last_name?: string };
          const firstName = newG.first_name || 'Guest';
          const lastName = newG.last_name || '';
          const { data: createdGuest, error: guestErr } = await supabase
            .from('guests')
            .insert({
              first_name: firstName,
              last_name: lastName,
              email: `${firstName.toLowerCase().replace(/\s+/g, '')}@example.com`,
              phone: '+91 98000 00000',
              company: 'Independent',
              id_type: 'other',
              id_number: 'N/A',
            })
            .select('*')
            .single();

          if (guestErr) throw new Error(guestErr.message || 'Failed to auto-create guest');
          guestId = createdGuest.id;
        }

        // Defensively resolve roomId (matching by room_number or ID)
        let roomId = data.roomId as string | undefined;
        const targetRoom = context.rooms.find(
          (r) => r.id === roomId || r.room_number === roomId || r.room_number === String(data.roomNumber),
        );
        if (targetRoom) {
          roomId = targetRoom.id;
        }

        if (!guestId) {
          throw new Error('Please select or specify a guest for this booking.');
        }
        if (!roomId) {
          throw new Error('Target room was not found in the guesthouse.');
        }

        await createBooking(supabase, {
          guestId,
          roomId,
          checkIn: data.checkIn as string,
          checkOut: data.checkOut as string,
          paymentStatus: (data.paymentStatus as 'pending' | 'paid' | 'partial') || 'pending',
          notes: (data.notes as string) || 'Booked via Front-Desk AI Copilot',
        });

        await reloadContext();
      } else if (result.action === 'set_room_status' && data?.roomId && data?.nextStatus) {
        await setRoomStatus(supabase, data.roomId as string, data.nextStatus as RoomStatus, data.note as string | undefined);
        await reloadContext();
      } else if (result.action === 'mark_clean' && data?.roomId) {
        await setRoomStatus(supabase, data.roomId as string, 'available');
        await reloadContext();
      } else if (result.action === 'change_booking_status' && data?.bookingId && data?.nextStatus) {
        await changeBookingStatus(supabase, data.bookingId as string, data.nextStatus as BookingStatusFsm);
        await reloadContext();
      } else if (result.action === 'update_payment' && data?.bookingId && data?.paymentStatus) {
        await supabase.from('bookings').update({ payment_status: data.paymentStatus }).eq('id', data.bookingId);
        await reloadContext();
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? { ...m, executed: true, text: `${m.text} \n\n✅ Action successfully executed!` }
            : m,
        ),
      );

      if (onRefreshData) onRefreshData();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      alert(`Action failed: ${errorMsg}`);
    }
  };

  const getActionButtonLabel = (result: CopilotResult) => {
    const data = result.data as Record<string, unknown> | undefined;
    if (result.action === 'create_booking') return 'Confirm & Create Booking';
    if (result.action === 'set_room_status') {
      if (data?.nextStatus === 'maintenance') return 'Confirm: Place in Maintenance';
      return 'Confirm: Mark Available';
    }
    if (result.action === 'mark_clean') return 'Mark Available Now';
    if (result.action === 'change_booking_status') {
      if (data?.nextStatus === 'checked_out') return 'Confirm Check-Out & Housekeeping';
      if (data?.nextStatus === 'cancelled') return 'Confirm Cancellation';
      if (data?.nextStatus === 'checked_in') return 'Confirm Check-In';
    }
    if (result.action === 'update_payment') return 'Confirm: Mark as Paid';
    return null;
  };

  const samplePrompts = [
    'Put room 103 under maintenance for AC servicing',
    'Check out Aarav Sharma from room 301',
    'Cancel booking for Priya Patel',
    'Mark booking GH-IN-1002 as paid',
    'Who is currently staying in room 101?',
    'Show available deluxe rooms',
  ];

  return (
    <Modal open={isOpen} onClose={onClose} title="Front-Desk AI Copilot" maxWidth="max-w-2xl">
      <div className="flex flex-col h-[520px] -mx-6 -my-4">
        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'assistant' && (
                <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm whitespace-pre-wrap ${
                  msg.sender === 'user'
                    ? 'bg-sky-600 text-white rounded-tr-none'
                    : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-none'
                }`}
              >
                {msg.text}

                {/* Interactive Action Buttons */}
                {msg.actionData && !msg.executed && getActionButtonLabel(msg.actionData) && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleExecuteAction(msg.id, msg.actionData!)}
                      className="btn btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-sm"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      {getActionButtonLabel(msg.actionData)}
                    </button>
                  </div>
                )}
              </div>

              {msg.sender === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200 flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" />
                <span>Copilot is reasoning...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-6 py-2 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 flex-shrink-0">
            <Sparkles className="w-3 h-3 text-sky-500" />
            Suggestions:
          </span>
          {samplePrompts.map((p) => (
            <button
              key={p}
              type="button"
              disabled={loading}
              onClick={() => handleSend(p)}
              className="text-[11px] bg-slate-100 hover:bg-sky-50 hover:text-sky-700 text-slate-600 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors flex items-center gap-1 flex-shrink-0"
            >
              {p}
              <ArrowRight className="w-2.5 h-2.5 opacity-60" />
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-white border-t border-slate-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Type any command (e.g. 'check out Aarav', 'put room 202 in maintenance', 'who is in 301?')..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="input flex-1 text-sm py-2"
              disabled={loading}
              autoFocus
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="btn btn-primary px-4 py-2 flex items-center gap-1.5"
            >
              <Send className="w-4 h-4" />
              <CornerDownLeft className="w-3 h-3 opacity-60" />
            </button>
          </form>
        </div>
      </div>
    </Modal>
  );
}
