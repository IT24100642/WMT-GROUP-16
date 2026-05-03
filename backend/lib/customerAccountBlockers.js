import Booking from "../models/Booking.js";
import FoodOrder from "../models/FoodOrder.js";

export async function getCustomerAccountBlockers(customerId) {
  const [bookings, foodOrders] = await Promise.all([
    Booking.find({ customer: customerId }).lean(),
    FoodOrder.find({ customer: customerId }).lean(),
  ]);

  const reasons = [];

  for (const b of bookings) {
    if (!b || b.status === "cancelled") continue;
    const label = b.summaryLine || "Your stay";
    if (!b.advancePaid) {
      reasons.push(`${label}: pay the compulsory advance.`);
    }
    const rem = Math.round(Number(b.remainingAmount) || 0);
    if (rem > 0 && !b.balancePaid) {
      reasons.push(`${label}: settle remaining balance first.`);
    }
    if (b.checkedInAt && !b.checkedOutAt) {
      reasons.push(`${label}: complete check-out at the front desk first.`);
    }
  }

  const pendingFood = foodOrders.filter(
    (o) => o && o.paymentMethod === "room_bill" && o.paymentStatus === "pending" && o.orderStatus !== "cancelled"
  );
  if (pendingFood.length > 0) {
    reasons.push("Restaurant (room bill): settle outstanding restaurant charges first.");
  }

  return { ok: reasons.length === 0, reasons };
}

