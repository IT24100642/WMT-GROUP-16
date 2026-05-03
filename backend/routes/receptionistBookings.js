import { Router } from "express";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import FoodOrder from "../models/FoodOrder.js";
import Room from "../models/Room.js";
import { requireReceptionist } from "../middleware/auth.js";
import { CANCELLATION_FEE_LKR } from "./customerBookings.js";
import { serverError } from "../lib/respond.js";

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
    serverError(res, err);
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
    const prevStatus = booking.status;
    const hadCheckedInAt = booking.checkedInAt;
    const hadCheckedOutAt = booking.checkedOutAt;

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

    if (booking.room) {
      if (!hadCheckedInAt && booking.checkedInAt && !booking.checkedOutAt) {
        await Room.updateOne(
          { _id: booking.room, status: { $ne: "Maintenance" } },
          { $set: { status: "Occupied" } }
        );
      } else if ((!hadCheckedOutAt && booking.checkedOutAt) || (hadCheckedOutAt && booking.checkedOutAt && new Date(hadCheckedOutAt).getTime() !== new Date(booking.checkedOutAt).getTime())) {
        await Room.updateOne(
          { _id: booking.room, status: { $ne: "Maintenance" } },
          { $set: { status: "Cleaning" } }
        );
      } else if (prevStatus !== "cancelled" && booking.status === "cancelled") {
        await Room.updateOne(
          { _id: booking.room, status: "Reserved" },
          { $set: { status: "Available" } }
        );
      }
    }

    const populated = await Booking.findById(booking._id)
      .populate("customer", "email customerNumber")
      .populate("room", "roomNumber roomType variant")
      .populate("offer", "title packagePrice")
      .lean();
    res.json(populated);
  } catch (err) {
    serverError(res, err);
  }
});

/** Approve guest cancellation: retain fee from advance, refund remainder, cancel booking. */
router.post("/bookings/:id/cancellation-request/approve", requireReceptionist, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }
    if (booking.cancellationRequestStatus !== "pending") {
      return res.status(400).json({ error: "No pending cancellation request for this booking" });
    }
    if (booking.status === "cancelled") {
      return res.status(400).json({ error: "Booking is already cancelled" });
    }

    const now = new Date();
    booking.status = "cancelled";
    booking.cancelledAt = now;
    booking.balancePaid = false;
    booking.remainingAmount = 0;
    booking.cancellationRequestStatus = "approved";
    booking.cancellationReviewedAt = now;

    if (booking.advancePaid) {
      const adv = Math.round(Number(booking.advanceAmount) || 0);
      booking.cancellationFeeLkr = CANCELLATION_FEE_LKR;
      booking.cancellationRefundLkr = Math.max(0, adv - CANCELLATION_FEE_LKR);
    } else {
      booking.cancellationFeeLkr = 0;
      booking.cancellationRefundLkr = 0;
    }

    await booking.save();

    if (booking.room) {
      await Room.updateOne(
        { _id: booking.room, status: "Reserved" },
        { $set: { status: "Available" } }
      );
    }

    await FoodOrder.updateMany({ booking: booking._id }, { $set: { booking: null } });

    const populated = await Booking.findById(booking._id)
      .populate("customer", "email customerNumber")
      .populate("room", "roomNumber roomType variant")
      .populate("offer", "title packagePrice")
      .lean();
    res.json(populated);
  } catch (err) {
    serverError(res, err);
  }
});

/** Reject guest cancellation request; booking stays confirmed. */
router.post("/bookings/:id/cancellation-request/reject", requireReceptionist, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }
    if (booking.cancellationRequestStatus !== "pending") {
      return res.status(400).json({ error: "No pending cancellation request for this booking" });
    }

    const note = String(req.body?.rejectionNote ?? "").trim().slice(0, 500);
    booking.cancellationRequestStatus = "rejected";
    booking.cancellationReviewedAt = new Date();
    booking.cancellationRejectionNote = note;

    await booking.save();

    const populated = await Booking.findById(booking._id)
      .populate("customer", "email customerNumber")
      .populate("room", "roomNumber roomType variant")
      .populate("offer", "title packagePrice")
      .lean();
    res.json(populated);
  } catch (err) {
    serverError(res, err);
  }
});

export default router;
