import { Router } from "express";
import bcrypt from "bcryptjs";
import Staff from "../models/Staff.js";
import ShiftSchedule from "../models/ShiftSchedule.js";
import Notification from "../models/Notification.js";
import { requireStaff, signStaffToken } from "../middleware/auth.js";
import { serverError } from "../lib/respond.js";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const username = String(req.body?.username ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }
    const staff = await Staff.findOne({ username, active: true }).populate("role");
    if (!staff || !staff.passwordHash || !(await bcrypt.compare(password, staff.passwordHash))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    res.json({
      token: signStaffToken(staff),
      username: staff.username,
      name: staff.name,
      roleName: staff.role?.name || "",
    });
  } catch (err) {
    serverError(res, err);
  }
});

router.get("/me", requireStaff, async (req, res) => {
  try {
    const staff = await Staff.findById(req.staffAuth.id).populate("role").lean();
    if (!staff || !staff.active) {
      return res.status(404).json({ error: "Staff not found" });
    }
    delete staff.passwordHash;
    res.json(staff);
  } catch (err) {
    serverError(res, err);
  }
});

router.get("/my-shifts", requireStaff, async (req, res) => {
  try {
    const shifts = await ShiftSchedule.find({ staff: req.staffAuth.id })
      .sort({ startAt: 1 })
      .lean();
    res.json(shifts);
  } catch (err) {
    serverError(res, err);
  }
});

router.post("/change-password", requireStaff, async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword ?? "");
    const newPassword = String(req.body?.newPassword ?? "");
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }
    const staff = await Staff.findById(req.staffAuth.id);
    if (!staff || !staff.passwordHash || !(await bcrypt.compare(currentPassword, staff.passwordHash))) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }
    staff.passwordHash = await bcrypt.hash(newPassword, 10);
    await staff.save();
    res.json({ ok: true });
  } catch (err) {
    serverError(res, err);
  }
});

router.get("/notifications", requireStaff, async (req, res) => {
  try {
    const list = await Notification.find({ recipientType: "staff", staff: req.staffAuth.id })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json(list);
  } catch (err) {
    serverError(res, err);
  }
});

export default router;
