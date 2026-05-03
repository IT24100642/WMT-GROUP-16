import { Router } from "express";
import mongoose from "mongoose";
import { requireCustomer } from "../middleware/auth.js";
import Booking from "../models/Booking.js";
import IssueReport, { ISSUE_PRIORITIES, ISSUE_TYPES } from "../models/IssueReport.js";
import Notification from "../models/Notification.js";
import { notifyAdmin, notifyCustomer, notifyMaintenanceStaff } from "../services/notifications.js";
import { bookingQualifiesForInStayFeatures } from "../lib/customerActiveStay.js";
import { serverError } from "../lib/respond.js";

const router = Router();

const ISSUE_STAY_MSG =
  "Issues can only be reported after reception has checked you in, for that stay (through check-out dates).";

router.get("/issue-reports", requireCustomer, async (req, res) => {
  try {
    const list = await IssueReport.find({ customer: req.customer.id })
      .sort({ createdAt: -1 })
      .populate("room", "roomNumber")
      .populate("assignedStaff", "name username")
      .lean();
    res.json(list);
  } catch (err) {
    serverError(res, err);
  }
});

router.get("/notifications", requireCustomer, async (req, res) => {
  try {
    const list = await Notification.find({ recipientType: "customer", customer: req.customer.id })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json(list);
  } catch (err) {
    serverError(res, err);
  }
});

router.post("/issue-reports", requireCustomer, async (req, res) => {
  try {
    const bookingId = String(req.body?.bookingId || "").trim();
    const issueType = String(req.body?.issueType || "").trim().toLowerCase();
    const priority = String(req.body?.priority || "").trim().toLowerCase();
    const description = String(req.body?.description || "").trim();

    if (!mongoose.isValidObjectId(bookingId)) return res.status(400).json({ error: "Valid booking is required" });
    if (!ISSUE_TYPES.includes(issueType)) return res.status(400).json({ error: "Invalid issue type" });
    if (!ISSUE_PRIORITIES.includes(priority)) return res.status(400).json({ error: "Invalid priority" });

    const booking = await Booking.findOne({ _id: bookingId, customer: req.customer.id }).populate("room", "roomNumber");
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (!bookingQualifiesForInStayFeatures(booking)) {
      return res.status(403).json({ error: ISSUE_STAY_MSG });
    }
    if (!booking.room) return res.status(400).json({ error: "This booking has no assigned room" });
    if (booking.status === "cancelled") return res.status(400).json({ error: "Cannot report issues for cancelled bookings" });

    const issue = await IssueReport.create({
      customer: req.customer.id,
      booking: booking._id,
      room: booking.room._id || booking.room,
      issueType,
      priority,
      description,
    });

    await notifyAdmin(
      "admin",
      "New customer issue reported",
      `Room ${booking.room.roomNumber}: ${issueType} (${priority})`,
      issue._id
    );
    await notifyMaintenanceStaff(
      "New maintenance issue reported",
      `Room ${booking.room.roomNumber}: ${issueType} (${priority}) requires assignment.`,
      issue._id
    );
    await notifyCustomer(
      req.customer.id,
      "Issue submitted",
      `Your ${issueType} issue for room ${booking.room.roomNumber} has been submitted.`,
      issue._id
    );

    const populated = await IssueReport.findById(issue._id)
      .populate("room", "roomNumber")
      .populate("assignedStaff", "name username")
      .lean();
    res.status(201).json(populated);
  } catch (err) {
    serverError(res, err);
  }
});

export default router;
