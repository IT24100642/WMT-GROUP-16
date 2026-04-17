/** True if the booking already has the compulsory advance recorded (handles API quirks). */
export function isBookingAdvancePaid(booking) {
  const v = booking?.advancePaid;
  if (v === true || v === 1) return true;
  if (v === false || v == null) return false;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "false" || s === "0" || s === "") return false;
    return s === "true" || s === "1";
  }
  return Boolean(v);
}
