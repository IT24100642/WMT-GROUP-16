import { Router } from "express";
import mongoose from "mongoose";
import Role from "../models/Role.js";
import Staff from "../models/Staff.js";
import { requireAdmin } from "../middleware/auth.js";
import { serverError } from "../lib/respond.js";

const router = Router();
router.use(requireAdmin);

router.get("/", async (_req, res) => {
  try {
    res.json(await Role.find().sort({ name: 1 }));
  } catch (err) {
    serverError(res, err);
  }
});

router.post("/", async (req, res) => {
  try {
    const name = String(req.body?.name ?? "").trim();
    const description = String(req.body?.description ?? "").trim();
    if (!name) {
      return res.status(400).json({ error: "Role name is required" });
    }
    const role = await Role.create({ name, description });
    res.status(201).json(role);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Role name already exists" });
    }
    serverError(res, err);
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = String(req.params.id ?? "").trim();
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid role id" });
    }
    const updates = {};
    if (req.body?.name !== undefined) updates.name = String(req.body.name ?? "").trim();
    if (req.body?.description !== undefined) updates.description = String(req.body.description ?? "").trim();
    const role = await Role.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!role) {
      return res.status(404).json({ error: "Role not found" });
    }
    res.json(role);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Role name already exists" });
    }
    serverError(res, err);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = String(req.params.id ?? "").trim();
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid role id" });
    }
    const assignedCount = await Staff.countDocuments({ role: id });
    if (assignedCount > 0) {
      return res.status(409).json({ error: "Cannot delete role while staff are assigned to it" });
    }
    const deleted = await Role.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: "Role not found" });
    }
    res.json({ ok: true });
  } catch (err) {
    serverError(res, err);
  }
});

export default router;
