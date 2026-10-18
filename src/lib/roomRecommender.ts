import type { Room, Booking, Guest } from './supabase';
import { GST_THRESHOLD_PER_NIGHT, formatINR } from './booking';

export interface RoomRecommendation {
  room: Room;
  score: number; // 0 to 100
  reasons: string[];
  isTopPick: boolean;
  corporatePolicyStatus: 'approved' | 'exceeds_budget' | 'standard';
}

// Corporate default budget ceilings per night (INR)
const CORPORATE_BUDGETS: Record<string, number> = {
  'Tata Consultancy Services': 6000,
  'Infosys Ltd': 5500,
  'Wipro Technologies': 5000,
  'HCL Technologies': 5000,
  'Reliance Industries': 10000,
};

/**
 * Ranks candidate rooms based on:
 * 1. Guest stay history (preferred room type / previously stayed room)
 * 2. Corporate company tariff guidelines
 * 3. GST slab optimization (5% vs 18%)
 * 4. Floor preference and amenities
 */
export function rankRooms(
  rooms: Room[],
  guest: Guest | null | undefined,
  allBookings: Booking[],
): RoomRecommendation[] {
  if (!rooms.length) return [];

  // Filter only available rooms (not maintenance or currently occupied)
  const availableRooms = rooms.filter((r) => r.status === 'available');
  if (!availableRooms.length) return [];

  // 1. Analyze guest history
  const guestBookings = guest
    ? allBookings.filter((b) => b.guest_id === guest.id && b.status !== 'cancelled')
    : [];

  const pastRoomIds = new Set(guestBookings.map((b) => b.room_id));
  const pastRoomTypes = new Map<string, number>();
  for (const b of guestBookings) {
    const room = rooms.find((r) => r.id === b.room_id);
    if (room) {
      pastRoomTypes.set(room.room_type, (pastRoomTypes.get(room.room_type) ?? 0) + 1);
    }
  }

  // Determine favourite room type if any
  let favouriteType: string | null = null;
  let maxCount = 0;
  for (const [type, count] of pastRoomTypes.entries()) {
    if (count > maxCount) {
      maxCount = count;
      favouriteType = type;
    }
  }

  // 2. Corporate budget check
  const company = guest?.company?.trim();
  const corporateCeiling = company ? (CORPORATE_BUDGETS[company] ?? 6000) : null;

  const results: RoomRecommendation[] = availableRooms.map((room) => {
    let score = 50; // Base score
    const reasons: string[] = [];
    let corporatePolicyStatus: 'approved' | 'exceeds_budget' | 'standard' = 'standard';

    // A. Guest History Bonus
    if (pastRoomIds.has(room.id)) {
      score += 25;
      reasons.push(`Guest previously stayed in Room ${room.room_number}`);
    } else if (favouriteType && room.room_type === favouriteType) {
      score += 15;
      reasons.push(`Matches guest's preferred category (${room.room_type})`);
    }

    // B. Corporate Tariff Check
    if (corporateCeiling !== null) {
      if (room.price_per_night <= corporateCeiling) {
        score += 20;
        corporatePolicyStatus = 'approved';
        reasons.push(`Within ${company} tariff limit (≤ ${formatINR(corporateCeiling)})`);
      } else {
        score -= 20;
        corporatePolicyStatus = 'exceeds_budget';
        reasons.push(`Exceeds ${company} standard tariff limit (${formatINR(room.price_per_night)})`);
      }
    }

    // C. GST Slab Optimization
    if (room.price_per_night <= GST_THRESHOLD_PER_NIGHT) {
      score += 10;
      reasons.push('Eligible for lower 5% GST slab');
    } else {
      reasons.push('Higher 18% GST tier applied');
    }

    // D. Room features & floor preference
    if (room.floor === 1) {
      score += 5;
      reasons.push('Convenient ground-floor access');
    } else if (room.floor && room.floor >= 3) {
      score += 5;
      reasons.push('Higher floor with quieter ambience');
    }

    if (room.notes && room.notes.toLowerCase().includes('desk')) {
      score += 5;
      reasons.push('Equipped with work/study desk');
    }

    const normalizedScore = Math.max(10, Math.min(100, score));

    return {
      room,
      score: normalizedScore,
      reasons,
      isTopPick: false,
      corporatePolicyStatus,
    };
  });

  // Sort descending by score
  results.sort((a, b) => b.score - a.score);

  if (results.length > 0) {
    results[0].isTopPick = true;
  }

  return results;
}
