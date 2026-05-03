import { Router } from "express";
import mongoose from "mongoose";
import FoodItem from "../models/FoodItem.js";
import FoodOrder, { FOOD_PAYMENT_METHODS, FOOD_SETTLEMENT_METHODS } from "../models/FoodOrder.js";
import { requireCustomer } from "../middleware/auth.js";
import { customerHasInStayBooking } from "../lib/customerActiveStay.js";
import { serverError } from "../lib/respond.js";

const router = Router();

router.get("/food-orders", requireCustomer, async (req, res) => {
  try {
    const list = await FoodOrder.find({ customer: req.customer.id })
      .sort({ createdAt: -1 })
      .populate("lines.foodItem", "name active")
      .lean();
    res.json(list);
  } catch (err) {
    serverError(res, err);
  }
});

router.post("/food-orders", requireCustomer, async (req, res) => {
  try {
    const rawLines = req.body?.lines;
    const paymentMethod = String(req.body?.paymentMethod ?? "").trim();
    if (!FOOD_PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ error: "Choose how you will pay: room_bill, online, or cash" });
    }
    // Only room-bill charges require an active in-stay booking.
    if (paymentMethod === "room_bill") {
      const inStay = await customerHasInStayBooking(req.customer.id);
      if (!inStay) {
        return res.status(403).json({
          error:
            "Room-bill food ordering is available only after reception records your check-in, during your stay dates. Choose cash/online or order after check-in.",
        });
      }
    }
    if (!Array.isArray(rawLines) || rawLines.length === 0) {
      return res.status(400).json({ error: "Add at least one item to your order" });
    }

    const lines = [];
    for (const row of rawLines) {
      const id = String(row?.foodItemId ?? row?.foodItem ?? "").trim();
      const qty = Math.floor(Number(row?.quantity));
      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ error: "Invalid menu item" });
      }
      if (!Number.isFinite(qty) || qty < 1 || qty > 99) {
        return res.status(400).json({ error: "Each quantity must be between 1 and 99" });
      }
      const item = await FoodItem.findOne({ _id: id, active: true }).lean();
      if (!item) {
        return res.status(400).json({ error: "A menu item is no longer available" });
      }
      const unitPrice = Math.round(Number(item.price) || 0);
      lines.push({
        foodItem: item._id,
        name: item.name,
        unitPrice,
        quantity: qty,
      });
    }

    const subtotal = lines.reduce((sum, L) => sum + L.unitPrice * L.quantity, 0);
    const isImmediatePayment = paymentMethod === "online" || paymentMethod === "cash";
    const paymentStatus = isImmediatePayment ? "paid" : "pending";
    const settledVia = paymentMethod === "online" ? "online" : paymentMethod === "cash" ? "cash" : null;
    const settledAt = isImmediatePayment ? new Date() : null;

    const doc = await FoodOrder.create({
      customer: req.customer.id,
      lines,
      subtotal,
      paymentMethod,
      paymentStatus,
      settledVia,
      settledAt,
      orderStatus: "received",
    });

    const populated = await FoodOrder.findById(doc._id).populate("lines.foodItem", "name").lean();
    res.status(201).json(populated);
  } catch (err) {
    serverError(res, err);
  }
});

/** Mark all pending room-bill food as paid (demo: guest settled at desk / in app). */
router.post("/food-orders/settle-room-bills", requireCustomer, async (req, res) => {
  try {
    const method = String(req.body?.paymentMethod || "").trim().toLowerCase();
    if (!FOOD_SETTLEMENT_METHODS.includes(method)) {
      return res.status(400).json({ error: "Choose a settlement method: cash, card, or online" });
    }
    const result = await FoodOrder.updateMany(
      {
        customer: req.customer.id,
        paymentMethod: "room_bill",
        paymentStatus: "pending",
        orderStatus: { $ne: "cancelled" },
      },
      { $set: { paymentStatus: "paid", settledVia: method, settledAt: new Date() } }
    );
    const list = await FoodOrder.find({ customer: req.customer.id })
      .sort({ createdAt: -1 })
      .populate("lines.foodItem", "name active")
      .lean();
    res.json({ modifiedCount: result.modifiedCount, orders: list });
  } catch (err) {
    serverError(res, err);
  }
});

export default router;
