import { Router } from "express";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import FoodOrder from "../models/FoodOrder.js";
import { requireReceptionist } from "../middleware/auth.js";

const router = Router();

router.get("/bookings", requireReceptionist, async (_req, res) => {
  try {
    const list = await Booking.find()
      .sort({ createdAt: -1 })
      .populate("customer", "email customerNumber")
      .populate("room", "roomNumber roomType variant")
      .populate("offer", "title packagePrice")
      .lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/bookings/:id", requireReceptionist, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }
    const { status, checkedInAt, checkedOutAt } = req.body || {};

    if (status !== undefined && ["pending", "confirmed", "cancelled"].includes(status)) {
      booking.status = status;
    }

    if (checkedInAt !== undefined || checkedOutAt !== undefined) {
      if (booking.status === "cancelled") {
        return res.status(400).json({ error: "Cannot record check-in or check-out for a cancelled booking" });
      }
    }

    if (checkedInAt !== undefined) {
      if (checkedInAt === null) {
        booking.checkedInAt = null;
        booking.checkedOutAt = null;
      } else {
        const d = new Date(checkedInAt);
        if (Number.isNaN(d.getTime())) {
          return res.status(400).json({ error: "Invalid check-in date and time" });
        }
        booking.checkedInAt = d;
        if (booking.checkedOutAt && new Date(booking.checkedOutAt).getTime() < d.getTime()) {
          booking.checkedOutAt = null;
        }
      }
    }

    if (checkedOutAt !== undefined) {
      if (checkedOutAt === null) {
        booking.checkedOutAt = null;
      } else {
        const d = new Date(checkedOutAt);
        if (Number.isNaN(d.getTime())) {
          return res.status(400).json({ error: "Invalid check-out date and time" });
        }
        if (!booking.checkedInAt) {
          return res.status(400).json({ error: "Record check-in before check-out" });
        }
        if (d.getTime() < new Date(booking.checkedInAt).getTime()) {
          return res.status(400).json({ error: "Check-out must be on or after check-in" });
        }

        const rem = Math.round(Number(booking.remainingAmount) || 0);
        if (rem > 0 && !booking.balancePaid) {
          return res.status(400).json({
            error: "Cannot check out: remaining room balance is not settled. Guest must pay in the app or at the desk first.",
          });
        }

        const openFolioFood = await FoodOrder.exists({
          customer: booking.customer,
          paymentMethod: "room_bill",
          paymentStatus: "pending",
          orderStatus: { $ne: "cancelled" },
        });
        if (openFolioFood) {
          return res.status(400).json({
            error: "Cannot check out: open restaurant charges on the room bill. Settle food in the guest profile or at the desk first.",
          });
        }

        booking.checkedOutAt = d;
        booking.balancePaid = true;
        booking.remainingAmount = 0;
      }
    }

    await booking.save();
    const populated = await Booking.findById(booking._id)
      .populate("customer", "email customerNumber")
      .populate("room", "roomNumber roomType variant")
      .populate("offer", "title packagePrice")
      .lean();
    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
