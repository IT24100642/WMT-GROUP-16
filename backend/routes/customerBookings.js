import { Router } from "express";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import FoodOrder from "../models/FoodOrder.js";
import FoodItem from "../models/FoodItem.js";
import Room from "../models/Room.js";
import Offer from "../models/Offer.js";
import { requireCustomer } from "../middleware/auth.js";
import { getCustomerStayContext } from "../lib/customerActiveStay.js";
import { serverError } from "../lib/respond.js";

const router = Router();

router.get("/stay-status", requireCustomer, async (req, res) => {
  try {
    const ctx = await getCustomerStayContext(req.customer.id);
    res.json(ctx);
  } catch (err) {
    serverError(res, err);
  }
});

export const ADVANCE_LKR = 5000;
/** Retained from advance when a cancellation is approved (LKR 1,000); remainder refunded if reason approved. */
export const CANCELLATION_FEE_LKR = 1000;
export const TAX_RATE = 0.12;
export const MAX_STAY_NIGHTS = 60;

/** Build validated food order lines from guest booking payload (room folio before stay). */
async function buildFoodLinesFromPendingRequest(rawLines) {
  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    return { error: "Restaurant selection is empty" };
  }
  const qtyById = new Map();
  for (const row of rawLines) {
    const id = String(row?.foodItemId ?? row?.foodItem ?? "").trim();
    const qty = Math.floor(Number(row?.quantity));
    if (!mongoose.isValidObjectId(id)) {
      return { error: "Invalid menu item in restaurant selection" };
    }
    if (!Number.isFinite(qty) || qty < 1) {
      return { error: "Each food quantity must be between 1 and 99" };
    }
    qtyById.set(id, Math.min(99, (qtyById.get(id) || 0) + qty));
  }
  const lines = [];
  for (const [id, qty] of qtyById.entries()) {
    if (!Number.isFinite(qty) || qty < 1 || qty > 99) {
      return { error: "Each food quantity must be between 1 and 99" };
    }
    const item = await FoodItem.findOne({ _id: id, active: true }).lean();
    if (!item) {
      return { error: "A menu item is no longer available" };
    }
    const unitPrice = Math.round(Number(item.price) || 0);
    lines.push({
      foodItem: item._id,
      name: item.name,
      unitPrice,
      quantity: qty,
    });
  }
  if (lines.length === 0) {
    return { error: "Restaurant selection is empty" };
  }
  const subtotal = lines.reduce((sum, L) => sum + L.unitPrice * L.quantity, 0);
  return { lines, subtotal };
}

function parseDateOnly(s) {
  const str = String(s ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const d = new Date(`${str}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function nightsBetween(checkIn, checkOut) {
  const ms = checkOut.getTime() - checkIn.getTime();
  const days = Math.round(ms / 86400000);
  return Math.max(1, days);
}

router.get("/bookings", requireCustomer, async (req, res) => {
  try {
    const list = await Booking.find({ customer: req.customer.id })
      .sort({ createdAt: -1 })
      .populate("room", "roomNumber roomType variant basePricePerNight")
      .populate("offer", "title packagePrice")
      .lean();
    res.json(list);
  } catch (err) {
    serverError(res, err);
  }
});

router.post("/bookings", requireCustomer, async (req, res) => {
  try {
    const roomId = req.body?.roomId ? String(req.body.roomId).trim() : "";
    const offerId = req.body?.offerId ? String(req.body.offerId).trim() : "";
    if ((!roomId && !offerId) || (roomId && offerId)) {
      return res.status(400).json({ error: "Provide exactly one of roomId or offerId" });
    }

    const checkInD = parseDateOnly(req.body?.checkIn);
    const checkOutD = parseDateOnly(req.body?.checkOut);
    if (!checkInD || !checkOutD) {
      return res.status(400).json({ error: "Valid checkIn and checkOut dates (YYYY-MM-DD) are required" });
    }
    if (checkOutD <= checkInD) {
      return res.status(400).json({ error: "Check-out must be after check-in" });
    }

    const nights = nightsBetween(checkInD, checkOutD);
    if (nights > MAX_STAY_NIGHTS) {
      return res.status(400).json({
        error: `Maximum stay is ${MAX_STAY_NIGHTS} nights. Choose an earlier check-out date.`,
      });
    }
    const fullName = String(req.body?.fullName ?? "").trim();
    const contactEmail = String(req.body?.contactEmail ?? "").trim().toLowerCase();
    const phoneRaw = String(req.body?.phone ?? "").trim();
    const phoneDigits = phoneRaw.replace(/\D/g, "");
    if (!/^\d{10}$/.test(phoneDigits)) {
      return res.status(400).json({ error: "Phone must be exactly 10 digits (numbers only)" });
    }
    const phone = phoneDigits;
    const address = String(req.body?.address ?? "").trim();
    const specialRequests = String(req.body?.specialRequests ?? "").trim();

    if (!fullName) return res.status(400).json({ error: "Full name is required" });
    if (!contactEmail) return res.status(400).json({ error: "Email is required" });
    if (!phone) return res.status(400).json({ error: "Phone is required" });

    const mealsAddLater = Boolean(req.body?.mealsAddLater);
    /** New bookings no longer send meal intent flags; keep schema fields false. */
    const mealIntentRequired = false;
    const mealIntentOtherOptions = false;
    const mealIntentUnsure = false;

    const advanceAck = req.body?.advanceAcknowledged === true || req.body?.advanceAcknowledged === "true";
    if (!advanceAck) {
      return res.status(400).json({ error: "You must confirm the compulsory advance payment of LKR 5,000" });
    }

    const advancePaymentCompleted =
      req.body?.advancePaymentCompleted === true || req.body?.advancePaymentCompleted === "true";

    let bookingType;
    let room = null;
    let offer = null;
    let roomSubtotal = 0;
    let summaryLine = "";

    if (roomId) {
      if (!mongoose.isValidObjectId(roomId)) {
        return res.status(400).json({ error: "Invalid room" });
      }
      room = await Room.findById(roomId).lean();
      if (!room) return res.status(404).json({ error: "Room not found" });
      if (room.status !== "Available") {
        return res.status(400).json({ error: `Room ${room.roomNumber} is currently ${room.status} and cannot be reserved.` });
      }

      const overlap = await Booking.exists({
        room: room._id,
        status: { $ne: "cancelled" },
        checkIn: { $lt: checkOutD },
        checkOut: { $gt: checkInD },
      });
      if (overlap) {
        return res.status(400).json({ error: "This room is already reserved for the selected dates." });
      }

      bookingType = "room";
      roomSubtotal = Math.round(Number(room.basePricePerNight) || 0) * nights;
      summaryLine = `Room ${room.roomNumber} · ${nights} night(s)`;
    } else {
      if (!mongoose.isValidObjectId(offerId)) {
        return res.status(400).json({ error: "Invalid offer" });
      }
      offer = await Offer.findOne({ _id: offerId, active: true }).populate("rooms", "basePricePerNight").lean();
      if (!offer) return res.status(404).json({ error: "Offer not found or inactive" });
      bookingType = "offer";
      const pkg = Number(offer.packagePrice) || 0;
      if (pkg > 0) {
        roomSubtotal = Math.round(pkg * nights);
      } else {
        const rooms = offer.rooms || [];
        const sumNightly = rooms.reduce((acc, r) => acc + (Number(r.basePricePerNight) || 0), 0);
        roomSubtotal = Math.round(sumNightly * nights);
      }
      summaryLine = `${offer.title} · ${nights} night(s)`;
    }

    const mealSubtotal = 0;
    const taxable = roomSubtotal + mealSubtotal;
    const taxAmount = Math.round(taxable * TAX_RATE);
    const roomPackageTotal = taxable + taxAmount;

    const restaurantFolio = Math.round(Number(req.body?.restaurantFolioSubtotal)) || 0;
    if (restaurantFolio < 0 || restaurantFolio > 5_000_000) {
      return res.status(400).json({ error: "Invalid restaurant folio amount" });
    }

    const rawLinked = req.body?.linkedFoodOrderIds;
    let linkedIds = Array.isArray(rawLinked)
      ? [
          ...new Set(
            rawLinked
              .map((x) => String(x ?? "").trim())
              .filter((id) => mongoose.isValidObjectId(id))
          ),
        ]
      : [];

    const rawPendingFood = req.body?.pendingFoodLines;
    if (Array.isArray(rawPendingFood) && rawPendingFood.length > 0) {
      if (linkedIds.length > 0) {
        return res.status(400).json({ error: "Use either linked food order ids or pending restaurant lines, not both" });
      }
      const built = await buildFoodLinesFromPendingRequest(rawPendingFood);
      if (built.error) {
        return res.status(400).json({ error: built.error });
      }
      if (Math.round(Number(built.subtotal)) !== restaurantFolio) {
        return res.status(400).json({ error: "Restaurant folio total must match the menu prices for your selections" });
      }
      const doc = await FoodOrder.create({
        customer: req.customer.id,
        lines: built.lines,
        subtotal: built.subtotal,
        paymentMethod: "room_bill",
        paymentStatus: "pending",
        settledVia: null,
        settledAt: null,
        orderStatus: "received",
      });
      linkedIds = [String(doc._id)];
    }

    if (restaurantFolio > 0 && linkedIds.length === 0) {
      return res.status(400).json({ error: "Linked food orders are required when including restaurant charges" });
    }
    if (restaurantFolio === 0 && linkedIds.length > 0) {
      return res.status(400).json({ error: "Remove linked food orders or set a restaurant folio total" });
    }

    let linkedOrderSum = 0;
    if (linkedIds.length > 0) {
      const orders = await FoodOrder.find({ _id: { $in: linkedIds } }).lean();
      if (orders.length !== linkedIds.length) {
        return res.status(400).json({ error: "One or more food orders were not found" });
      }
      for (const o of orders) {
        if (String(o.customer) !== String(req.customer.id)) {
          return res.status(403).json({ error: "Invalid food order reference" });
        }
        if (o.paymentMethod !== "room_bill") {
          return res.status(400).json({ error: "Only room-bill food orders can be attached to a booking" });
        }
        if (o.booking) {
          return res.status(400).json({ error: "A food order is already linked to another booking" });
        }
        linkedOrderSum += Math.round(Number(o.subtotal) || 0);
      }
      if (linkedOrderSum !== restaurantFolio) {
        return res.status(400).json({ error: "Restaurant total must match the sum of linked food orders" });
      }
    }

    const totalAmount = roomPackageTotal + restaurantFolio;
    const advanceAmount = ADVANCE_LKR;
    const remainingAmount = Math.max(0, totalAmount - advanceAmount);

    const doc = await Booking.create({
      customer: req.customer.id,
      bookingType,
      room: room ? room._id : null,
      offer: offer ? offer._id : null,
      checkIn: checkInD,
      checkOut: checkOutD,
      nights,
      fullName,
      contactEmail,
      phone,
      address,
      mealBreakfast: false,
      mealLunch: false,
      mealDinner: false,
      mealIntentRequired,
      mealIntentOtherOptions,
      mealIntentUnsure,
      mealsAddLater,
      specialRequests,
      roomSubtotal,
      mealSubtotal,
      taxRate: TAX_RATE,
      taxAmount,
      totalAmount,
      advanceAmount,
      remainingAmount,
      advancePaid: Boolean(advancePaymentCompleted),
      summaryLine,
      status: Boolean(advancePaymentCompleted) ? "confirmed" : "pending",
      restaurantFolioSubtotal: restaurantFolio,
    });

    if (room) {
      await Room.updateOne(
        { _id: room._id, status: "Available" },
        { $set: { status: "Reserved" } }
      );
    }

    if (linkedIds.length > 0) {
      await FoodOrder.updateMany(
        { _id: { $in: linkedIds }, customer: req.customer.id },
        { $set: { booking: doc._id } }
      );
    }

    const populated = await Booking.findById(doc._id)
      .populate("room", "roomNumber roomType variant basePricePerNight")
      .populate("offer", "title packagePrice")
      .lean();
    res.status(201).json(populated);
  } catch (err) {
    serverError(res, err);
  }
});

/** Record compulsory advance after a simulated or real gateway charge (e.g. retry from profile). */
router.post("/bookings/:bookingId/advance-payment", requireCustomer, async (req, res) => {
  try {
    const bookingId = String(req.params.bookingId ?? "").trim();
    if (!mongoose.isValidObjectId(bookingId)) {
      return res.status(400).json({ error: "Invalid booking" });
    }
    const booking = await Booking.findOne({ _id: bookingId, customer: req.customer.id });
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }
    if (booking.advancePaid) {
      return res.status(400).json({ error: "Advance is already recorded for this booking" });
    }
    booking.advancePaid = true;
    if (booking.status !== "cancelled") {
      booking.status = "confirmed";
    }
    await booking.save();
    const populated = await Booking.findById(booking._id)
      .populate("room", "roomNumber roomType variant basePricePerNight")
      .populate("offer", "title packagePrice")
      .lean();
    res.json(populated);
  } catch (err) {
    serverError(res, err);
  }
});

/** Demo: guest settles remaining room/package balance after advance (e.g. at check-out). */
router.post("/bookings/:bookingId/settle-balance", requireCustomer, async (req, res) => {
  try {
    const bookingId = String(req.params.bookingId ?? "").trim();
    if (!mongoose.isValidObjectId(bookingId)) {
      return res.status(400).json({ error: "Invalid booking" });
    }
    const booking = await Booking.findOne({ _id: bookingId, customer: req.customer.id });
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }
    if (booking.status === "cancelled") {
      return res.status(400).json({ error: "Cancelled bookings have no balance to settle here" });
    }
    if (!booking.advancePaid) {
      return res.status(400).json({ error: "Pay the compulsory advance before settling the remaining balance" });
    }
    const rem = Math.round(Number(booking.remainingAmount) || 0);
    if (rem <= 0) {
      return res.status(400).json({ error: "No remaining balance to settle" });
    }
    if (booking.balancePaid) {
      return res.status(400).json({ error: "This balance is already recorded as paid" });
    }
    booking.balancePaid = true;
    booking.remainingAmount = 0;
    await booking.save();
    const populated = await Booking.findById(booking._id)
      .populate("room", "roomNumber roomType variant basePricePerNight")
      .populate("offer", "title packagePrice")
      .lean();
    res.json(populated);
  } catch (err) {
    serverError(res, err);
  }
});

/**
 * Guest updates dates (before check-in), notes/special requests, or both.
 * Recalculates totals when check-in/out change; cannot change dates after check-in.
 *
 * Exposed as POST `/booking-update` (bookingId in JSON — survives fussy proxies),
 * plus PATCH, PUT, and POST …/bookings/:bookingId/update.
 */
function bookingIdFromGuestUpdateRequest(req) {
  const fromParams = req.params?.bookingId ?? req.params?.id;
  if (fromParams != null && String(fromParams).trim()) {
    return String(fromParams).trim();
  }
  return String(req.body?.bookingId ?? "").trim();
}

async function updateGuestBooking(req, res) {
  try {
    const bookingId = bookingIdFromGuestUpdateRequest(req);
    if (!mongoose.isValidObjectId(bookingId)) {
      return res.status(400).json({ error: "Invalid booking" });
    }
    const booking = await Booking.findOne({ _id: bookingId, customer: req.customer.id });
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }
    if (booking.status === "cancelled") {
      return res.status(400).json({ error: "Cancelled bookings cannot be updated" });
    }
    if (booking.cancellationRequestStatus === "pending") {
      return res.status(400).json({
        error: "This booking has a pending cancellation request. Wait for staff to review it.",
      });
    }

    const rawBody = req.body && typeof req.body === "object" ? req.body : {};
    const hasSpecial = rawBody.specialRequests !== undefined;
    const hasCheckIn = rawBody.checkIn !== undefined;
    const hasCheckOut = rawBody.checkOut !== undefined;
    const hasDates = hasCheckIn || hasCheckOut;

    if (!hasSpecial && !hasDates) {
      return res.status(400).json({ error: "Nothing to update (send specialRequests and/or checkIn + checkOut)" });
    }

    if (hasDates && (!hasCheckIn || !hasCheckOut)) {
      return res.status(400).json({ error: "Provide both checkIn and checkOut (YYYY-MM-DD) to change dates" });
    }

    if (hasDates) {
      if (booking.checkedInAt) {
        return res.status(400).json({
          error: "Dates cannot be changed after check-in. You can still update special requests.",
        });
      }
      const checkInD = parseDateOnly(rawBody.checkIn);
      const checkOutD = parseDateOnly(rawBody.checkOut);
      if (!checkInD || !checkOutD || checkOutD <= checkInD) {
        return res.status(400).json({
          error: "Valid check-in and check-out are required; check-out must be after check-in",
        });
      }
      const nights = nightsBetween(checkInD, checkOutD);
      if (nights > MAX_STAY_NIGHTS) {
        return res.status(400).json({
          error: `Maximum stay is ${MAX_STAY_NIGHTS} nights.`,
        });
      }

      let roomSubtotal = 0;
      let summaryLine = "";

      if (booking.bookingType === "room") {
        if (!booking.room) {
          return res.status(400).json({ error: "This booking has no room assigned" });
        }
        const room = await Room.findById(booking.room).lean();
        if (!room) {
          return res.status(404).json({ error: "Room not found" });
        }
        const overlap = await Booking.exists({
          _id: { $ne: booking._id },
          room: booking.room,
          status: { $ne: "cancelled" },
          checkIn: { $lt: checkOutD },
          checkOut: { $gt: checkInD },
        });
        if (overlap) {
          return res.status(400).json({ error: "This room is already reserved for the selected dates." });
        }
        roomSubtotal = Math.round(Number(room.basePricePerNight) || 0) * nights;
        summaryLine = `Room ${room.roomNumber} · ${nights} night(s)`;
      } else if (booking.bookingType === "offer") {
        const offer = await Offer.findOne({ _id: booking.offer, active: true })
          .populate("rooms", "basePricePerNight")
          .lean();
        if (!offer) {
          return res.status(404).json({ error: "Offer not found or inactive" });
        }
        const pkg = Number(offer.packagePrice) || 0;
        if (pkg > 0) {
          roomSubtotal = Math.round(pkg * nights);
        } else {
          const offerRooms = offer.rooms || [];
          const sumNightly = offerRooms.reduce((acc, r) => acc + (Number(r.basePricePerNight) || 0), 0);
          roomSubtotal = Math.round(sumNightly * nights);
        }
        summaryLine = `${offer.title} · ${nights} night(s)`;
      } else {
        return res.status(400).json({ error: "Unsupported booking type" });
      }

      const mealSubtotal = 0;
      const taxable = roomSubtotal + mealSubtotal;
      const taxAmount = Math.round(taxable * TAX_RATE);
      const roomPackageTotal = taxable + taxAmount;
      const restaurantFolio = Math.round(Number(booking.restaurantFolioSubtotal) || 0);
      const totalAmount = roomPackageTotal + restaurantFolio;
      const advanceAmount = Math.round(Number(booking.advanceAmount) || ADVANCE_LKR);
      const remainingAmount = Math.max(0, totalAmount - advanceAmount);

      booking.checkIn = checkInD;
      booking.checkOut = checkOutD;
      booking.nights = nights;
      booking.roomSubtotal = roomSubtotal;
      booking.mealSubtotal = mealSubtotal;
      booking.taxAmount = taxAmount;
      booking.totalAmount = totalAmount;
      booking.remainingAmount = remainingAmount;
      booking.summaryLine = summaryLine;
    }

    if (hasSpecial) {
      const sr = String(rawBody.specialRequests ?? "").trim();
      if (sr.length > 2000) {
        return res.status(400).json({ error: "Special requests must be at most 2000 characters" });
      }
      booking.specialRequests = sr;
    }

    await booking.save();
    const populated = await Booking.findById(booking._id)
      .populate("room", "roomNumber roomType variant basePricePerNight")
      .populate("offer", "title packagePrice")
      .lean();
    res.json(populated);
  } catch (err) {
    serverError(res, err);
  }
}

router.post("/booking-update", requireCustomer, updateGuestBooking);
router.patch("/bookings/:bookingId", requireCustomer, updateGuestBooking);
router.put("/bookings/:bookingId", requireCustomer, updateGuestBooking);
router.post("/bookings/:bookingId/update", requireCustomer, updateGuestBooking);

/**
 * Guest submits a cancellation request (booking stays active until reception approves).
 * If approved, LKR 1,000 is retained from advance and the rest is refunded (e.g. LKR 4,000 on a LKR 5,000 advance).
 */
router.post("/bookings/:bookingId/cancel", requireCustomer, async (req, res) => {
  try {
    const bookingId = String(req.params.bookingId ?? "").trim();
    if (!mongoose.isValidObjectId(bookingId)) {
      return res.status(400).json({ error: "Invalid booking" });
    }
    const booking = await Booking.findOne({ _id: bookingId, customer: req.customer.id });
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }
    if (booking.status === "cancelled") {
      return res.status(400).json({ error: "This booking is already cancelled" });
    }
    if (booking.checkedInAt) {
      return res.status(400).json({ error: "Cancellation cannot be requested after you have been checked in at the hotel." });
    }
    if (booking.cancellationRequestStatus === "pending") {
      return res.status(400).json({ error: "A cancellation request is already waiting for review." });
    }

    const reason = String(req.body?.cancellationReason ?? "").trim();
    if (reason.length < 5) {
      return res.status(400).json({
        error: "Please tell us why you are cancelling (at least 5 characters).",
      });
    }
    if (reason.length > 2000) {
      return res.status(400).json({ error: "Cancellation reason is too long" });
    }

    const now = new Date();
    booking.cancellationRequestStatus = "pending";
    booking.cancellationRequestedAt = now;
    booking.cancellationReason = reason;
    booking.cancellationRejectionNote = "";
    booking.cancellationReviewedAt = null;

    await booking.save();

    const populated = await Booking.findById(booking._id)
      .populate("room", "roomNumber roomType variant basePricePerNight")
      .populate("offer", "title packagePrice")
      .lean();
    res.json(populated);
  } catch (err) {
    serverError(res, err);
  }
});

export default router;
