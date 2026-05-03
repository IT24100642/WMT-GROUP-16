import { Router } from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import Staff from "../models/Staff.js";
import Role from "../models/Role.js";
import { requireAdmin } from "../middleware/auth.js";
import { serverError } from "../lib/respond.js";

const router = Router();
router.use(requireAdmin);

router.get("/", async (_req, res) => {
  try {
    const list = await Staff.find().populate("role").sort({ name: 1 }).lean();
    for (const s of list) {
      delete s.passwordHash;
    }
    res.json(list);
  } catch (err) {
    serverError(res, err);
  }
});

router.post("/", async (req, res) => {
  try {
    const name = String(req.body?.name ?? "").trim();
    const username = String(req.body?.username ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const phone = String(req.body?.phone ?? "").trim();
    const roleId = String(req.body?.roleId ?? "").trim();

    if (!name || !username || !password || !roleId) {
      return res.status(400).json({ error: "name, username, password, and roleId are required" });
    }
    if (!mongoose.isValidObjectId(roleId)) {
      return res.status(400).json({ error: "Invalid roleId" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    const role = await Role.findById(roleId).lean();
    if (!role) {
      return res.status(404).json({ error: "Role not found" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const created = await Staff.create({
      name,
      username,
      passwordHash,
      email: email || undefined,
      phone: phone || undefined,
      role: role._id,
      active: true,
    });
    const staff = await Staff.findById(created._id).populate("role").lean();
    if (staff) delete staff.passwordHash;
    res.status(201).json(staff);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Username or email already exists" });
    }
    serverError(res, err);
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = String(req.params.id ?? "").trim();
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid staff id" });
    }
    const staff = await Staff.findById(id);
    if (!staff) {
      return res.status(404).json({ error: "Staff not found" });
    }

    if (req.body?.name !== undefined) staff.name = String(req.body.name ?? "").trim();
    if (req.body?.username !== undefined) staff.username = String(req.body.username ?? "").trim().toLowerCase();
    if (req.body?.email !== undefined) {
      const email = String(req.body.email ?? "").trim().toLowerCase();
      staff.email = email || undefined;
    }
    if (req.body?.phone !== undefined) {
      const phone = String(req.body.phone ?? "").trim();
      staff.phone = phone || undefined;
    }
    if (req.body?.active !== undefined) staff.active = Boolean(req.body.active);

    if (req.body?.password !== undefined) {
      const password = String(req.body.password ?? "");
      if (password && password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }
      if (password) {
        staff.passwordHash = await bcrypt.hash(password, 10);
      }
    }

    if (req.body?.roleId !== undefined) {
      const roleId = String(req.body.roleId ?? "").trim();
      if (!mongoose.isValidObjectId(roleId)) {
        return res.status(400).json({ error: "Invalid roleId" });
      }
      const role = await Role.findById(roleId).lean();
      if (!role) {
        return res.status(404).json({ error: "Role not found" });
      }
      staff.role = role._id;
    }

    await staff.save();
    const updated = await Staff.findById(staff._id).populate("role").lean();
    if (updated) delete updated.passwordHash;
    res.json(updated);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Username or email already exists" });
    }
    serverError(res, err);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = String(req.params.id ?? "").trim();
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid staff id" });
    }
    const deleted = await Staff.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: "Staff not found" });
    }
    res.json({ ok: true });
  } catch (err) {
    serverError(res, err);
  }
});

export default router;
