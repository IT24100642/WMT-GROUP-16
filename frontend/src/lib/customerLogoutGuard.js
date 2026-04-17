import { api, parseJson } from "../api/client.js";
import { formatLkr } from "./formatLkr.js";

/**
 * Guest sign-out rules: no unpaid advance, no unpaid remaining balance, no open room-bill food,
 * and if checked in at the hotel, reception must record check-out first.
 * @returns {Promise<{ ok: true } | { ok: false, reasons: string[] }>}
 */
export async function checkCustomerLogoutBlockers(token) {
  if (!token) return { ok: true };

  let bookings = [];
  let foodOrders = [];
  try {
    const [resB, resF] = await Promise.all([
      api("/api/customer-auth/bookings", {}, token),
      api("/api/customer-auth/food-orders", {}, token),
    ]);
    const dataB = await parseJson(resB);
    const dataF = await parseJson(resF);
    if (!resB.ok || !resF.ok) {
      return {
        ok: false,
        reasons: ["We could not load your bookings or bills. Check your connection, then try signing out again."],
      };
    }
    bookings = Array.isArray(dataB) ? dataB : [];
    foodOrders = Array.isArray(dataF) ? dataF : [];
  } catch {
    return {
      ok: false,
      reasons: ["We could not verify your account. Check your connection, then try signing out again."],
    };
  }

  const reasons = [];

  for (const b of bookings) {
    if (b.status === "cancelled") continue;
    const label = b.summaryLine || "Your stay";
    if (!b.advancePaid) {
      reasons.push(`${label}: pay the compulsory advance under My bookings.`);
    }
    const rem = Math.round(Number(b.remainingAmount) || 0);
    if (rem > 0 && !b.balancePaid) {
      reasons.push(`${label}: settle ${formatLkr(rem)} remaining balance (Pay remaining balance in My profile).`);
    }
    if (b.checkedInAt && !b.checkedOutAt) {
      reasons.push(`${label}: complete check-out at the front desk before signing out.`);
    }
  }

  const pendingFood = foodOrders.filter(
    (o) => o.paymentMethod === "room_bill" && o.paymentStatus === "pending" && o.orderStatus !== "cancelled"
  );
  if (pendingFood.length > 0) {
    const sum = pendingFood.reduce((s, o) => s + (Number(o.subtotal) || 0), 0);
    reasons.push(`Restaurant (room bill): settle ${formatLkr(sum)} — use Settle restaurant charges in My profile.`);
  }

  if (reasons.length) return { ok: false, reasons };
  return { ok: true };
}
