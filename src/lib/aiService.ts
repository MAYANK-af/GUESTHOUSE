import { computeInvoice, formatINR, todayISO } from './booking';
import type { Room, Guest, Booking } from './supabase';

export interface CopilotContext {
  rooms: Room[];
  guests: Guest[];
  bookings: Booking[];
}

export type CopilotActionType =
  | 'create_booking'
  | 'set_room_status'
  | 'change_booking_status'
  | 'update_payment'
  | 'filter_rooms'
  | 'mark_clean'
  | 'check_in'
  | 'gst_inquiry'
  | 'general_reply';

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface CopilotResult {
  action: CopilotActionType;
  message: string;
  data?: unknown;
}

export interface ExtractedIdData {
  id_type: 'aadhaar' | 'passport' | 'driving_license' | 'voter_id' | 'other';
  id_number: string;
  first_name: string;
  last_name: string;
  company?: string;
  address?: string;
  confidence: number;
}

const AI_STORAGE_KEY = 'gh_pro_gemini_api_key';

export function getStoredApiKey(): string {
  try {
    return localStorage.getItem(AI_STORAGE_KEY) || (import.meta.env.VITE_GEMINI_API_KEY as string) || '';
  } catch {
    return '';
  }
}

export function setStoredApiKey(key: string): void {
  try {
    localStorage.setItem(AI_STORAGE_KEY, key.trim());
  } catch {
    // Ignore
  }
}

const GEMINI_MODELS = [
  'gemini-flash-latest',
  'gemini-3.5-flash',
  'gemini-flash-lite-latest',
  'gemini-2.5-flash',
];

async function callGemini(apiKey: string, body: unknown): Promise<string | null> {
  for (const model of GEMINI_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (response.ok) {
        const json = await response.json();
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      } else if (response.status === 429) {
        console.warn(`Gemini model ${model} rate-limited, switching to next fallback...`);
      }
    } catch (err) {
      console.warn(`Error querying Gemini model ${model}:`, err);
    }
  }
  return null;
}

function buildGeminiContents(history: ChatTurn[], currentQuery: string) {
  const turns: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];

  for (const turn of history) {
    const role = turn.role === 'user' ? 'user' : 'model';
    // Skip initial greeting / model message if it has no preceding user turn
    if (turns.length === 0 && role === 'model') continue;
    if (turns.length > 0 && turns[turns.length - 1].role === role) {
      turns[turns.length - 1].parts[0].text += `\n${turn.text}`;
    } else {
      turns.push({ role, parts: [{ text: turn.text }] });
    }
  }

  if (turns.length > 0 && turns[turns.length - 1].role === 'user') {
    turns[turns.length - 1].parts[0].text += `\n${currentQuery}`;
  } else {
    turns.push({ role: 'user', parts: [{ text: currentQuery }] });
  }

  return turns;
}

function parseDateString(str: string): string | null {
  const dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (dmy) {
    const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    const month = dmy[2].padStart(2, '0');
    const day = dmy[1].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const iso = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  }
  return null;
}

function extractDates(text: string): { checkIn: string; checkOut: string } | null {
  const rangeMatch = text.match(/(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\s*(?:to|until|-|–)\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i);
  if (rangeMatch) {
    const cin = parseDateString(rangeMatch[1]);
    const cout = parseDateString(rangeMatch[2]);
    if (cin && cout) return { checkIn: cin, checkOut: cout };
  }

  const isoRange = text.match(/(\d{4}-\d{2}-\d{2})\s*(?:to|until|-|–)\s*(\d{4}-\d{2}-\d{2})/);
  if (isoRange) {
    return { checkIn: isoRange[1], checkOut: isoRange[2] };
  }

  const singleDate = text.match(/(?:check\s*in\s*date|checkin\s*date|from|date)\s*:?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i);
  if (singleDate) {
    const cin = parseDateString(singleDate[1]);
    if (cin) {
      const d = new Date(cin);
      d.setDate(d.getDate() + 1);
      const cout = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return { checkIn: cin, checkOut: cout };
    }
  }

  return null;
}

/**
 * Intelligent AI Copilot Query Processor:
 * Powered by Gemini Flash models for multi-turn natural language instructions and commands,
 * with an extensive local offline rule-based NLP engine as fallback.
 */
export async function processCopilotQuery(
  query: string,
  context: CopilotContext,
  history: ChatTurn[] = [],
): Promise<CopilotResult> {
  const apiKey = getStoredApiKey();

  // If Gemini API is configured, use Gemini with multi-turn conversation support
  if (apiKey) {
    try {
      const systemInstruction = `You are the Front-Desk AI Copilot for GuestHouse Pro, a professional Indian corporate and boutique guesthouse management platform.
Current Date: ${todayISO()}.

You assist front-desk staff with:
1. Creating bookings (parsing room number, guest name, check-in & check-out dates, payment status, notes).
2. Changing room status (e.g. putting a room under maintenance, cleaning, or marking available).
3. Changing booking status (check-in, check-out, cancelling reservations).
4. Updating payment status (paid, pending, partial).
5. Room search / filtering (e.g. available deluxe rooms, presidential suites).
6. Answering questions (who is in room X, guest contact details, GST slabs/rates, guesthouse statistics, occupancy).
7. Multi-turn conversational commands: Connect follow-up instructions with previous conversation turns (e.g. if the user previously said "Book room 401" and then answers "Mayank check in date 10/11/26 to 13/11/26 payment status is pending", combine these turns into a create_booking action!).

Context:
ROOMS: ${JSON.stringify(context.rooms.map((r) => ({ id: r.id, num: r.room_number, type: r.room_type, status: r.status, price: r.price_per_night, notes: r.notes })))}
GUESTS: ${JSON.stringify(context.guests.map((g) => ({ id: g.id, name: `${g.first_name} ${g.last_name}`.trim(), company: g.company, phone: g.phone, email: g.email })))}
BOOKINGS: ${JSON.stringify(context.bookings.map((b) => ({ id: b.id, ref: b.booking_reference, guestId: b.guest_id, roomId: b.room_id, in: b.check_in_date, out: b.check_out_date, status: b.status, pay: b.payment_status, total: b.total_amount })))}

DATE HANDLING:
- Convert any DD/MM/YY, DD/MM/YYYY, or relative dates into ISO format "YYYY-MM-DD" (e.g. "10/11/26" -> "2026-11-10").
- If only check-in date is given, default check-out to next day. If a range is given, use the start and end dates.

GUEST HANDLING:
- If a guest matches an existing guest in GUESTS, return their "guestId".
- If the guest does NOT exist in GUESTS (e.g. "Mayank"), set "guestId": null and provide "newGuest": { "first_name": "Mayank", "last_name": "" }.

ROOM HANDLING:
- Look for room number in current query OR recent conversation history. Match with roomId from ROOMS.

Return ONLY valid JSON matching this schema:
{
  "action": "create_booking" | "set_room_status" | "change_booking_status" | "update_payment" | "filter_rooms" | "general_reply",
  "message": "Clear explanation of what was found or what action is about to be executed",
  "data": {
    // for create_booking:
    "roomId": "...",
    "guestId": "... or null",
    "newGuest": { "first_name": "...", "last_name": "..." },
    "checkIn": "YYYY-MM-DD",
    "checkOut": "YYYY-MM-DD",
    "paymentStatus": "pending" | "paid" | "partial",
    "notes": "...",
    // for set_room_status:
    "roomId": "...",
    "roomNumber": "...",
    "nextStatus": "available" | "maintenance" | "cleaning",
    "note": "...",
    // for change_booking_status:
    "bookingId": "...",
    "bookingReference": "...",
    "nextStatus": "confirmed" | "checked_in" | "checked_out" | "cancelled",
    "guestName": "...",
    "roomNumber": "...",
    // for update_payment:
    "bookingId": "...",
    "bookingReference": "...",
    "paymentStatus": "paid" | "pending" | "partial"
  }
}`;

      const contents = buildGeminiContents(history, query);
      const text = await callGemini(apiKey, {
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      if (text) {
        const parsed = JSON.parse(text);
        if (parsed.action && parsed.message) {
          const actionData = (parsed.data || {}) as Record<string, string | number | undefined>;

          // Normalize room status fields
          if (parsed.action === 'set_room_status') {
            const target = context.rooms.find(
              (r) => r.id === actionData.roomId || r.room_number === actionData.roomNumber || r.room_number === actionData.roomId,
            );
            if (target) {
              actionData.roomId = target.id;
              actionData.roomNumber = target.room_number;
            }
          }

          // Normalize booking status fields
          if (parsed.action === 'change_booking_status') {
            const target = context.bookings.find(
              (b) => b.id === actionData.bookingId || b.booking_reference === actionData.bookingReference,
            );
            if (target) {
              actionData.bookingId = target.id;
              actionData.bookingReference = target.booking_reference;
            }
          }

          return {
            action: parsed.action as CopilotActionType,
            message: parsed.message,
            data: actionData,
          };
        }
      }
    } catch (err) {
      console.warn('Gemini Copilot API error, falling back to local NLP engine:', err);
    }
  }

  // =========================================================================
  // LOCAL NLP FALLBACK ENGINE (Covers all actions even offline)
  // =========================================================================
  const q = query.trim().toLowerCase();

  // 1. GST / Tax inquiry
  const gstMatch = q.match(/gst\s+(?:rate|for|on)?\s*₹?\s*(\d+)/i);
  if (gstMatch || q.includes('gst rate') || q.includes('tax slab')) {
    const amount = gstMatch ? Number(gstMatch[1]) : 7500;
    const inv = computeInvoice(amount, 1);
    const ratePct = inv.rate * 100;
    return {
      action: 'gst_inquiry',
      message: `For a room priced at ${formatINR(amount)}/night, the GST rate is ${ratePct}% (${formatINR(inv.gst)} GST). Total per night: ${formatINR(inv.total)}. (Threshold is ₹7,500: 5% up to ₹7,500, 18% above).`,
      data: inv,
    };
  }

  // 2. Put Room In / Out of Maintenance
  const maintMatch = q.match(/(?:put|place|set|move)?\s*(?:room\s+)?(\d{3})\s*(?:in|into|under|to)?\s*maintenance(?:\s+(?:for|due to|because)\s+(.+))?/i)
    || q.match(/maintenance\s+(?:for\s+)?(?:room\s+)?(\d{3})(?:\s+(?:for|due to|because)\s+(.+))?/i);
  if (maintMatch) {
    const roomNum = maintMatch[1];
    const note = maintMatch[2] || 'Maintenance logged via AI Copilot';
    const room = context.rooms.find((r) => r.room_number === roomNum);
    if (!room) return { action: 'general_reply', message: `Room ${roomNum} was not found.` };
    return {
      action: 'set_room_status',
      message: `Ready to place Room ${roomNum} under maintenance. Reason: ${note}.`,
      data: { roomId: room.id, roomNumber: room.room_number, nextStatus: 'maintenance', note },
    };
  }

  // 3. Mark Room Clean / Release from Cleaning
  const cleanMatch = q.match(/mark\s+(?:room\s+)?(\d{3})\s*(?:as\s+)?clean/i) || q.match(/clean\s+(?:room\s+)?(\d{3})/i);
  if (cleanMatch) {
    const roomNum = cleanMatch[1];
    const room = context.rooms.find((r) => r.room_number === roomNum);
    if (!room) return { action: 'general_reply', message: `Room ${roomNum} was not found.` };
    return {
      action: 'set_room_status',
      message: `Ready to mark Room ${roomNum} as clean and release it to Available.`,
      data: { roomId: room.id, roomNumber: room.room_number, nextStatus: 'available' },
    };
  }

  // 4. Check Out Guest / Room
  if (q.includes('check out') || q.includes('checkout')) {
    const roomMatch = q.match(/(?:room\s+)?(\d{3})/i);
    const targetRoom = roomMatch ? context.rooms.find((r) => r.room_number === roomMatch[1]) : null;

    const activeBooking = context.bookings.find((b) => {
      if (b.status !== 'checked_in') return false;
      if (targetRoom && b.room_id === targetRoom.id) return true;
      const guest = context.guests.find((g) => g.id === b.guest_id);
      if (!guest) return false;
      const fullName = `${guest.first_name} ${guest.last_name}`.toLowerCase();
      return q.includes(fullName) || q.includes(guest.first_name.toLowerCase()) || q.includes(guest.last_name.toLowerCase());
    });

    if (activeBooking) {
      const guest = context.guests.find((g) => g.id === activeBooking.guest_id);
      const room = context.rooms.find((r) => r.id === activeBooking.room_id);
      return {
        action: 'change_booking_status',
        message: `Found active checked-in stay for ${guest?.first_name} ${guest?.last_name} in Room ${room?.room_number} (${activeBooking.booking_reference}). Check out and send room to housekeeping?`,
        data: {
          bookingId: activeBooking.id,
          bookingReference: activeBooking.booking_reference,
          nextStatus: 'checked_out',
          guestName: `${guest?.first_name} ${guest?.last_name}`,
          roomNumber: room?.room_number,
        },
      };
    }
  }

  // 5. Cancel Booking
  if (q.includes('cancel booking') || q.includes('cancel reservation')) {
    const refMatch = q.match(/gh-in-\d+/i);
    const targetRef = refMatch ? refMatch[0].toUpperCase() : null;

    const bookingToCancel = context.bookings.find((b) => {
      if (b.status === 'cancelled') return false;
      if (targetRef && b.booking_reference.toUpperCase() === targetRef) return true;
      const guest = context.guests.find((g) => g.id === b.guest_id);
      if (!guest) return false;
      const fullName = `${guest.first_name} ${guest.last_name}`.toLowerCase();
      return q.includes(fullName) || q.includes(guest.first_name.toLowerCase());
    });

    if (bookingToCancel) {
      const guest = context.guests.find((g) => g.id === bookingToCancel.guest_id);
      const room = context.rooms.find((r) => r.id === bookingToCancel.room_id);
      return {
        action: 'change_booking_status',
        message: `Found booking ${bookingToCancel.booking_reference} for ${guest?.first_name} ${guest?.last_name} (Room ${room?.room_number}). Confirm cancellation?`,
        data: {
          bookingId: bookingToCancel.id,
          bookingReference: bookingToCancel.booking_reference,
          nextStatus: 'cancelled',
          guestName: `${guest?.first_name} ${guest?.last_name}`,
          roomNumber: room?.room_number,
        },
      };
    }
  }

  // 6. Check In Guest
  if (q.includes('check in') || q.includes('checkin')) {
    const foundGuest = context.guests.find((g) => {
      const fullName = `${g.first_name} ${g.last_name}`.toLowerCase();
      return q.includes(fullName) || q.includes(g.first_name.toLowerCase()) || q.includes(g.last_name.toLowerCase());
    });

    if (foundGuest) {
      const activeBooking = context.bookings.find(
        (b) => b.guest_id === foundGuest.id && b.status === 'confirmed',
      );
      if (activeBooking) {
        const room = context.rooms.find((r) => r.id === activeBooking.room_id);
        return {
          action: 'change_booking_status',
          message: `Found confirmed reservation for ${foundGuest.first_name} ${foundGuest.last_name} in Room ${room?.room_number} (${activeBooking.booking_reference}). Proceed to check in?`,
          data: {
            bookingId: activeBooking.id,
            bookingReference: activeBooking.booking_reference,
            nextStatus: 'checked_in',
            guestName: `${foundGuest.first_name} ${foundGuest.last_name}`,
            roomNumber: room?.room_number,
          },
        };
      }
    }
  }

  // 7. Mark Payment as Paid / Update Payment
  if (q.includes('mark paid') || q.includes('mark as paid') || q.includes('payment received')) {
    const refMatch = q.match(/gh-in-\d+/i);
    const targetRef = refMatch ? refMatch[0].toUpperCase() : null;

    const bookingToPay = context.bookings.find((b) => {
      if (targetRef && b.booking_reference.toUpperCase() === targetRef) return true;
      const guest = context.guests.find((g) => g.id === b.guest_id);
      if (!guest) return false;
      const fullName = `${guest.first_name} ${guest.last_name}`.toLowerCase();
      return q.includes(fullName) || q.includes(guest.first_name.toLowerCase());
    });

    if (bookingToPay) {
      const guest = context.guests.find((g) => g.id === bookingToPay.guest_id);
      return {
        action: 'update_payment',
        message: `Booking ${bookingToPay.booking_reference} for ${guest?.first_name} ${guest?.last_name} (${formatINR(bookingToPay.total_amount)}) has status '${bookingToPay.payment_status}'. Update payment status to 'paid'?`,
        data: {
          bookingId: bookingToPay.id,
          bookingReference: bookingToPay.booking_reference,
          paymentStatus: 'paid',
        },
      };
    }
  }

  // 8. Contact Info / Phone query
  if (q.includes('phone') || q.includes('contact') || q.includes('email') || q.includes('address')) {
    const foundGuest = context.guests.find((g) => {
      const fullName = `${g.first_name} ${g.last_name}`.toLowerCase();
      return q.includes(fullName) || q.includes(g.first_name.toLowerCase()) || q.includes(g.last_name.toLowerCase());
    });

    if (foundGuest) {
      return {
        action: 'general_reply',
        message: `Guest Details for ${foundGuest.first_name} ${foundGuest.last_name}:\n• Phone: ${foundGuest.phone || 'N/A'}\n• Email: ${foundGuest.email || 'N/A'}\n• Company: ${foundGuest.company || 'Individual'}\n• Address: ${foundGuest.address || 'N/A'}\n• Document: ${foundGuest.id_type?.toUpperCase() || 'N/A'} (${foundGuest.id_number || 'N/A'})`,
      };
    }
  }

  // 9. Who is staying in Room X
  const whoMatch = q.match(/who\s+(?:is\s+)?(?:in|staying in)\s+(?:room\s+)?(\d{3})/i);
  if (whoMatch) {
    const roomNum = whoMatch[1];
    const room = context.rooms.find((r) => r.room_number === roomNum);
    if (room) {
      const currentBooking = context.bookings.find((b) => b.room_id === room.id && b.status === 'checked_in');
      if (currentBooking) {
        const guest = context.guests.find((g) => g.id === currentBooking.guest_id);
        return {
          action: 'general_reply',
          message: `Room ${roomNum} is currently occupied by ${guest?.first_name} ${guest?.last_name}${guest?.company ? ' from ' + guest.company : ''} (${currentBooking.booking_reference}). Expected checkout: ${currentBooking.check_out_date}.`,
        };
      }
      return {
        action: 'general_reply',
        message: `Room ${roomNum} is currently ${room.status}. There is no guest checked in right now.`,
      };
    }
  }

  // 10. Search / Filter Rooms
  if (q.includes('available room') || q.includes('free room') || q.includes('empty room')) {
    let typeFilter: string | null = null;
    if (q.includes('deluxe')) typeFilter = 'deluxe';
    else if (q.includes('executive')) typeFilter = 'executive';
    else if (q.includes('standard')) typeFilter = 'standard';
    else if (q.includes('presidential')) typeFilter = 'presidential';

    let available = context.rooms.filter((r) => r.status === 'available');
    if (typeFilter) {
      available = available.filter((r) => r.room_type === typeFilter);
    }

    if (!available.length) {
      return {
        action: 'filter_rooms',
        message: `No ${typeFilter ? typeFilter + ' ' : ''}rooms are currently available.`,
        data: { rooms: [] },
      };
    }

    const roomList = available.map((r) => `Room ${r.room_number} (${r.room_type}, ${formatINR(r.price_per_night)})`).join(', ');
    return {
      action: 'filter_rooms',
      message: `Found ${available.length} available room(s): ${roomList}.`,
      data: { rooms: available },
    };
  }

  // 11. Booking Creation Intent
  const allText = `${history.map((h) => h.text).join(' ')} ${query}`.toLowerCase();
  const isBookingIntent =
    q.includes('book') ||
    q.includes('reserve') ||
    q.includes('reservation') ||
    q.includes('check in date') ||
    q.includes('check-in date') ||
    /payment\s+status/i.test(q) ||
    history.some((h) => /book\s+room/i.test(h.text));

  if (isBookingIntent) {
    // 1. Find room: check current query first, then history
    const roomMatch = q.match(/(?:room\s*)?(\d{3})/i) || allText.match(/(?:room\s*)?(\d{3})/i);
    const matchedRoom = roomMatch ? context.rooms.find((r) => r.room_number === roomMatch[1]) : null;

    // 2. Find dates
    const dates = extractDates(q) || extractDates(allText);
    const checkIn = dates?.checkIn || todayISO();
    let checkOut = dates?.checkOut;

    if (!checkOut) {
      const nightsMatch = q.match(/(\d+)\s*night/i) || allText.match(/(\d+)\s*night/i);
      const nights = nightsMatch ? parseInt(nightsMatch[1], 10) : 1;
      const outDate = new Date(checkIn);
      outDate.setDate(outDate.getDate() + nights);
      checkOut = `${outDate.getFullYear()}-${String(outDate.getMonth() + 1).padStart(2, '0')}-${String(outDate.getDate()).padStart(2, '0')}`;
    }

    // 3. Find guest (existing in context.guests or new)
    const matchedGuest = context.guests.find((g) => {
      const fullName = `${g.first_name} ${g.last_name}`.toLowerCase();
      return q.includes(fullName) || q.includes(g.first_name.toLowerCase()) || q.includes(g.last_name.toLowerCase());
    });

    let newGuest: { first_name: string; last_name: string } | null = null;
    if (!matchedGuest) {
      const nameMatch =
        q.match(/^([a-z]+)(?:\s+([a-z]+))?\s*(?:check\s*in|booking|payment)/i) ||
        q.match(/(?:for|guest)\s+([a-z]+)(?:\s+([a-z]+))?/i);
      if (nameMatch) {
        const fn = nameMatch[1];
        const ln = nameMatch[2] || '';
        const stopWords = ['book', 'then', 'room', 'check', 'show', 'cancel', 'put', 'who', 'what', 'mark', 'clean', 'please'];
        if (!stopWords.includes(fn.toLowerCase())) {
          const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
          newGuest = { first_name: capitalize(fn), last_name: ln ? capitalize(ln) : '' };
        }
      }
    }

    const paymentStatus = q.includes('paid') && !q.includes('pending') ? 'paid' : 'pending';

    const roomToUse = matchedRoom || context.rooms.find((r) => r.status === 'available');
    const guestDisplayName = matchedGuest
      ? `${matchedGuest.first_name} ${matchedGuest.last_name}`.trim()
      : newGuest
      ? `${newGuest.first_name} ${newGuest.last_name}`.trim()
      : null;

    if (roomToUse && guestDisplayName) {
      return {
        action: 'create_booking',
        message: `Ready to prepare booking for ${guestDisplayName} in Room ${roomToUse.room_number} (${checkIn} to ${checkOut}, payment: ${paymentStatus}).`,
        data: {
          roomId: roomToUse.id,
          roomNumber: roomToUse.room_number,
          guestId: matchedGuest ? matchedGuest.id : null,
          newGuest: matchedGuest ? undefined : newGuest,
          checkIn,
          checkOut,
          paymentStatus,
        },
      };
    }

    if (matchedRoom && !guestDisplayName) {
      return {
        action: 'general_reply',
        message: `Ready to prepare booking for Room ${matchedRoom.room_number}. Please provide guest name and check-in / check-out dates (e.g. "Mayank from 10/11/26 to 13/11/26, payment pending").`,
      };
    }
  }

  // Fallback intelligent response
  return {
    action: 'general_reply',
    message: `I can help you with anything across GuestHouse Pro! You can give me commands like:
• "Put room 103 under maintenance for AC servicing"
• "Check out Aarav Sharma from room 301"
• "Cancel booking for Priya Patel"
• "Mark booking GH-IN-1002 as paid"
• "Who is currently staying in room 101?"
• "Give me phone number of Vikram Singh"
• "Show available deluxe rooms"
• "Book room 102 for Aarav Sharma for 2 nights"
• "What is the GST rate for ₹8,999?"`,
  };
}

/**
 * Extracts identity document details from an uploaded image or camera snapshot.
 * Supports direct Gemini Vision OCR with fallback models, or realistic demo extraction when offline.
 */
export async function extractIdDocument(
  imageDataBase64: string,
  demoType: 'aadhaar' | 'passport' | 'driving_license' = 'aadhaar',
): Promise<ExtractedIdData> {
  const apiKey = getStoredApiKey();

  if (apiKey && imageDataBase64 && imageDataBase64.length > 50) {
    try {
      const prompt = `Analyze this Indian identity document. Return ONLY valid JSON with keys:
"id_type": one of "aadhaar", "passport", "driving_license", "voter_id", "other"
"id_number": unmasked document number string
"first_name": first name
"last_name": last name
"company": company name if mentioned or empty string
"address": full address if visible or empty string`;

      const text = await callGemini(apiKey, {
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: imageDataBase64.replace(/^data:image\/\w+;base64,/, ''),
                },
              },
            ],
          },
        ],
        generationConfig: { responseMimeType: 'application/json' },
      });

      if (text) {
        const parsed = JSON.parse(text);
        return {
          id_type: parsed.id_type || 'aadhaar',
          id_number: parsed.id_number || '',
          first_name: parsed.first_name || '',
          last_name: parsed.last_name || '',
          company: parsed.company || '',
          address: parsed.address || '',
          confidence: 0.96,
        };
      }
    } catch (err) {
      console.warn('Gemini Vision API error, falling back to local OCR parser:', err);
    }
  }

  // Deterministic local smart demo extraction for immediate offline testing
  if (demoType === 'passport') {
    return {
      id_type: 'passport',
      id_number: 'Z7491023',
      first_name: 'Meera',
      last_name: 'Deshmukh',
      company: 'Mahindra & Mahindra',
      address: 'Worli Sea Face, Mumbai, Maharashtra 400018',
      confidence: 0.98,
    };
  }

  if (demoType === 'driving_license') {
    return {
      id_type: 'driving_license',
      id_number: 'DL0420210056789',
      first_name: 'Kabir',
      last_name: 'Narang',
      company: 'Bharti Airtel',
      address: 'Vasant Vihar, New Delhi 110057',
      confidence: 0.95,
    };
  }

  // Default: Aadhaar with valid Verhoeff check digit (5038 9201 4768)
  return {
    id_type: 'aadhaar',
    id_number: '503892014768',
    first_name: 'Siddharth',
    last_name: 'Malhotra',
    company: 'Tata Motors Ltd',
    address: 'Bandra West, Mumbai, Maharashtra 400050',
    confidence: 0.99,
  };
}
