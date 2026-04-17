import Room from "../models/Room.js";

/** Fixed hotel inventory: rooms 1–50 only. */
export const ALLOWED_ROOM_NUMBERS = Array.from({ length: 50 }, (_, i) => String(i + 1));

function floorForRoom(n) {
  return Math.min(5, Math.ceil(n / 10));
}

/**
 * Catalog fields for room n (1–50). Used on insert and to re-sync layout fields each boot.
 */
export function buildRoomSpec(n) {
  const floor = floorForRoom(n);

  if (n >= 1 && n <= 15) {
    const airConditioned = n % 2 === 1;
    return {
      variant: "Standard",
      roomType: "Standard Room",
      floor,
      capacity: 2,
      airConditioned,
      description:
        "Basic room for 1–2 guests. Comfortable and practical — available with or without air conditioning.",
      basePricePerNight: airConditioned ? 12500 : 9900,
      amenities: airConditioned ? ["Wi‑Fi", "Air conditioning"] : ["Wi‑Fi"],
    };
  }

  if (n >= 16 && n <= 30) {
    const airConditioned = n <= 27;
    return {
      variant: "King",
      roomType: "King Room",
      floor,
      capacity: 2,
      airConditioned,
      description: "Larger room with king-size bed — more comfort; mostly air conditioned.",
      basePricePerNight: airConditioned ? 21000 : 17500,
      amenities: airConditioned ? ["Wi‑Fi", "Air conditioning", "King bed"] : ["Wi‑Fi", "King bed"],
    };
  }

  if (n >= 31 && n <= 40) {
    return {
      variant: "Deluxe",
      roomType: "Deluxe Room",
      floor,
      capacity: 2,
      airConditioned: true,
      description: "Better interior with more space — air conditioned; ideal for couples or business guests.",
      basePricePerNight: 28500,
      amenities: ["Wi‑Fi", "Air conditioning", "Workspace", "Premium bath"],
    };
  }

  if (n >= 41 && n <= 45) {
    return {
      variant: "Duplex",
      roomType: "Duplex Room",
      floor,
      capacity: 4,
      airConditioned: true,
      description: "Two-level room with internal stairs — luxury feel; air conditioned only.",
      basePricePerNight: 45000,
      amenities: ["Wi‑Fi", "Air conditioning", "Two levels", "Living area"],
    };
  }

  if (n >= 46 && n <= 50) {
    return {
      variant: "Suite",
      roomType: "Suite / Family Room",
      floor,
      capacity: 6,
      airConditioned: true,
      description: "Very spacious suite for families — air conditioning and premium facilities.",
      basePricePerNight: 62000,
      amenities: ["Wi‑Fi", "Air conditioning", "Family layout", "Premium facilities", "Lounge area"],
    };
  }

  throw new Error(`Invalid room index ${n}`);
}

/**
 * Remove any room not in 1–50; upsert all 50 with correct variant layout.
 * Preserves per-room description, pricing, status, photos when the document already exists
 * (only $setOnInsert fills defaults on first create; recurring $set syncs variant/floor/capacity/AC/type).
 */
export async function ensureFixedRooms() {
  await Room.updateMany({}, { $unset: { packages: 1 } });
  await Room.deleteMany({ roomNumber: { $nin: ALLOWED_ROOM_NUMBERS } });

  for (let n = 1; n <= 50; n++) {
    const key = String(n);
    const spec = buildRoomSpec(n);
    await Room.updateOne(
      { roomNumber: key },
      {
        $set: {
          variant: spec.variant,
          roomType: spec.roomType,
          floor: spec.floor,
          capacity: spec.capacity,
          airConditioned: spec.airConditioned,
        },
        $setOnInsert: {
          roomNumber: key,
          description: spec.description,
          basePricePerNight: spec.basePricePerNight,
          amenities: spec.amenities,
          status: "Available",
          photos: [],
        },
      },
      { upsert: true }
    );
  }
}

export function sortRoomsByNumber(rooms) {
  return [...rooms].sort((a, b) => Number(a.roomNumber) - Number(b.roomNumber));
}
