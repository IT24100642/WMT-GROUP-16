export const ADVANCE_LKR = 5000;
/** Kept from advance when guest cancels after paying it */
export const CANCELLATION_FEE_LKR = 1000;
export const TAX_RATE = 0.12;
export const MEAL_PER_NIGHT = { breakfast: 300, lunch: 400, dinner: 500 };
/** Maximum number of nights per booking (60 days stay). */
export const MAX_STAY_NIGHTS = 60;

export function parseDateOnly(str) {
  const s = String(str ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function nightsBetween(checkInStr, checkOutStr) {
  const a = parseDateOnly(checkInStr);
  const b = parseDateOnly(checkOutStr);
  if (!a || !b || b <= a) return 0;
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000));
}

export function computeBookingTotals({ bookingType, room, offer, nights, breakfast, lunch, dinner }) {
  let roomSubtotal = 0;
  if (bookingType === "room" && room) {
    roomSubtotal = Math.round(Number(room.basePricePerNight) || 0) * nights;
  } else if (bookingType === "offer" && offer) {
    const pkg = Number(offer.packagePrice) || 0;
    if (pkg > 0) {
      roomSubtotal = Math.round(pkg * nights);
    } else {
      const rooms = offer.rooms || [];
      const sum = rooms.reduce((acc, r) => acc + (Number(r.basePricePerNight) || 0), 0);
      roomSubtotal = Math.round(sum * nights);
    }
  }

  let mealPerNight = 0;
  if (breakfast) mealPerNight += MEAL_PER_NIGHT.breakfast;
  if (lunch) mealPerNight += MEAL_PER_NIGHT.lunch;
  if (dinner) mealPerNight += MEAL_PER_NIGHT.dinner;
  const mealSubtotal = mealPerNight * nights;

  const taxable = roomSubtotal + mealSubtotal;
  const taxAmount = Math.round(taxable * TAX_RATE);
  const totalAmount = taxable + taxAmount;
  const remainingAmount = Math.max(0, totalAmount - ADVANCE_LKR);

  return { roomSubtotal, mealSubtotal, taxAmount, totalAmount, remainingAmount };
}

export function defaultCheckout(checkInStr) {
  const d = parseDateOnly(checkInStr);
  if (!d) return "";
  const next = new Date(d.getTime() + 86400000);
  return next.toISOString().slice(0, 10);
}

/** Latest valid check-out (exclusive): check-in + MAX_STAY_NIGHTS calendar days. */
export function maxCheckoutDateStr(checkInStr) {
  const d = parseDateOnly(checkInStr);
  if (!d) return "";
  const out = new Date(d.getTime());
  out.setUTCDate(out.getUTCDate() + MAX_STAY_NIGHTS);
  return out.toISOString().slice(0, 10);
}
