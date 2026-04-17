import { Router } from "express";
import mongoose from "mongoose";
import Staff from "../models/Staff.js";
import Room, { ROOM_STATUSES } from "../models/Room.js";
import Offer from "../models/Offer.js";
import MaintenanceRecord from "../models/MaintenanceRecord.js";
import HousekeepingRecord from "../models/HousekeepingRecord.js";
import { requireRoomManager } from "../middleware/auth.js";
import { publicUrlForFilename, unlinkPublicUpload, uploadRoomPhoto } from "../middleware/roomPhotoUpload.js";
import { sortRoomsByNumber } from "../seed/fixedRooms.js";

const router = Router();

function handlePhotoUpload(req, res, next) {
  uploadRoomPhoto.single("photo")(req, res, (err) => {
    if (err) {
      const msg = err.code === "LIMIT_FILE_SIZE" ? "Image must be 5 MB or smaller" : err.message || "Upload failed";
      return res.status(400).json({ error: msg });
    }
    next();
  });
}

router.get("/assignable-staff", requireRoomManager, async (_req, res) => {
  try {
    const list = await Staff.find({ active: true }).populate("role").sort({ name: 1 }).lean();
    res.json(
      list.map((s) => ({
        _id: s._id,
        name: s.name,
        username: s.username,
        roleName: s.role?.name || "",
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/rooms/:roomId/maintenance", requireRoomManager, async (req, res) => {
  try {
    const { roomId } = req.params;
    if (!mongoose.isValidObjectId(roomId)) {
      return res.status(400).json({ error: "Invalid room id" });
    }
    const list = await MaintenanceRecord.find({ room: roomId })
      .populate("assignedStaff", "name username")
      .sort({ createdAt: -1 })
      .lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/rooms/:roomId/maintenance", requireRoomManager, async (req, res) => {
  try {
    const { roomId } = req.params;
    if (!mongoose.isValidObjectId(roomId)) {
      return res.status(400).json({ error: "Invalid room id" });
    }
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }
    const title = String(req.body?.title ?? "").trim();
    if (!title) {
      return res.status(400).json({ error: "title is required" });
    }
    const notes = String(req.body?.notes ?? "").trim();
    const status = req.body?.status;
    const scheduledFor = req.body?.scheduledFor ? new Date(req.body.scheduledFor) : null;
    let assignedStaff = req.body?.assignedStaff || null;
    if (assignedStaff && !mongoose.isValidObjectId(String(assignedStaff))) {
      assignedStaff = null;
    }
    const rec = await MaintenanceRecord.create({
      room: roomId,
      title,
      notes,
      status: ["scheduled", "in_progress", "completed", "cancelled"].includes(status) ? status : "scheduled",
      scheduledFor: scheduledFor && !Number.isNaN(scheduledFor.getTime()) ? scheduledFor : null,
      assignedStaff: assignedStaff || null,
    });
    const populated = await MaintenanceRecord.findById(rec._id)
      .populate("assignedStaff", "name username")
      .lean();
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/maintenance/:id", requireRoomManager, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const rec = await MaintenanceRecord.findById(id);
    if (!rec) {
      return res.status(404).json({ error: "Not found" });
    }
    const { title, notes, status, scheduledFor, assignedStaff } = req.body || {};
    if (title !== undefined) rec.title = String(title).trim();
    if (notes !== undefined) rec.notes = String(notes).trim();
    if (status !== undefined && ["scheduled", "in_progress", "completed", "cancelled"].includes(status)) {
      rec.status = status;
    }
    if (scheduledFor !== undefined) {
      const d = scheduledFor ? new Date(scheduledFor) : null;
      rec.scheduledFor = d && !Number.isNaN(d.getTime()) ? d : null;
    }
    if (assignedStaff !== undefined) {
      rec.assignedStaff =
        assignedStaff && mongoose.isValidObjectId(String(assignedStaff)) ? assignedStaff : null;
    }
    await rec.save();
    const populated = await MaintenanceRecord.findById(rec._id)
      .populate("assignedStaff", "name username")
      .lean();
    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/maintenance/:id", requireRoomManager, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const deleted = await MaintenanceRecord.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: "Not found" });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/rooms/:roomId/housekeeping", requireRoomManager, async (req, res) => {
  try {
    const { roomId } = req.params;
    if (!mongoose.isValidObjectId(roomId)) {
      return res.status(400).json({ error: "Invalid room id" });
    }
    const list = await HousekeepingRecord.find({ room: roomId })
      .populate("assignedStaff", "name username")
      .sort({ createdAt: -1 })
      .lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/rooms/:roomId/housekeeping", requireRoomManager, async (req, res) => {
  try {
    const { roomId } = req.params;
    if (!mongoose.isValidObjectId(roomId)) {
      return res.status(400).json({ error: "Invalid room id" });
    }
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }
    const task = String(req.body?.task ?? "").trim();
    if (!task) {
      return res.status(400).json({ error: "task is required" });
    }
    const notes = String(req.body?.notes ?? "").trim();
    const status = req.body?.status;
    let assignedStaff = req.body?.assignedStaff || null;
    if (assignedStaff && !mongoose.isValidObjectId(String(assignedStaff))) {
      assignedStaff = null;
    }
    const rec = await HousekeepingRecord.create({
      room: roomId,
      task,
      notes,
      status: ["pending", "in_progress", "completed", "cancelled"].includes(status) ? status : "pending",
      assignedStaff: assignedStaff || null,
    });
    const populated = await HousekeepingRecord.findById(rec._id)
      .populate("assignedStaff", "name username")
      .lean();
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/housekeeping/:id", requireRoomManager, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const rec = await HousekeepingRecord.findById(id);
    if (!rec) {
      return res.status(404).json({ error: "Not found" });
    }
    const { task, notes, status, assignedStaff } = req.body || {};
    if (task !== undefined) rec.task = String(task).trim();
    if (notes !== undefined) rec.notes = String(notes).trim();
    if (status !== undefined && ["pending", "in_progress", "completed", "cancelled"].includes(status)) {
      rec.status = status;
    }
    if (assignedStaff !== undefined) {
      rec.assignedStaff =
        assignedStaff && mongoose.isValidObjectId(String(assignedStaff)) ? assignedStaff : null;
    }
    await rec.save();
    const populated = await HousekeepingRecord.findById(rec._id)
      .populate("assignedStaff", "name username")
      .lean();
    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/housekeeping/:id", requireRoomManager, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const deleted = await HousekeepingRecord.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: "Not found" });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  "/rooms/:roomId/photos",
  requireRoomManager,
  handlePhotoUpload,
  async (req, res) => {
    try {
      const { roomId } = req.params;
      if (!mongoose.isValidObjectId(roomId)) {
        return res.status(400).json({ error: "Invalid room id" });
      }
      if (!req.file) {
        return res.status(400).json({ error: "No image file (field name: photo)" });
      }
      const room = await Room.findById(roomId);
      if (!room) {
        await unlinkPublicUpload(publicUrlForFilename(req.file.filename));
        return res.status(404).json({ error: "Room not found" });
      }
      const url = publicUrlForFilename(req.file.filename);
      room.photos.push({
        url,
        originalName: req.file.originalname || "",
      });
      await room.save();
      const added = room.photos[room.photos.length - 1];
      res.status(201).json(added.toObject());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.delete("/rooms/:roomId/photos/:photoId", requireRoomManager, async (req, res) => {
  try {
    const { roomId, photoId } = req.params;
    if (!mongoose.isValidObjectId(roomId) || !mongoose.isValidObjectId(photoId)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }
    const photo = room.photos.id(photoId);
    if (!photo) {
      return res.status(404).json({ error: "Photo not found" });
    }
    const url = photo.url;
    photo.deleteOne();
    await room.save();
    await unlinkPublicUpload(url);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/rooms", requireRoomManager, async (_req, res) => {
  try {
    const rooms = sortRoomsByNumber(await Room.find().lean());
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/rooms/:id", requireRoomManager, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const room = await Room.findById(id).lean();
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }
    const [maintenance, housekeeping] = await Promise.all([
      MaintenanceRecord.find({ room: id }).populate("assignedStaff", "name username").sort({ createdAt: -1 }).lean(),
      HousekeepingRecord.find({ room: id }).populate("assignedStaff", "name username").sort({ createdAt: -1 }).lean(),
    ]);
    res.json({ ...room, maintenance, housekeeping });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/rooms/:id", requireRoomManager, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const room = await Room.findById(id);
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }
    const { description, basePricePerNight, status, amenities } = req.body || {};
    if (description !== undefined) {
      room.description = String(description).trim();
    }
    if (basePricePerNight !== undefined) {
      room.basePricePerNight = Math.max(0, Number(basePricePerNight) || 0);
    }
    if (status !== undefined && ROOM_STATUSES.includes(status)) {
      room.status = status;
    }
    if (amenities !== undefined && Array.isArray(amenities)) {
      room.amenities = amenities.map((a) => String(a).trim()).filter(Boolean);
    }
    await room.save();
    res.json(room.toObject());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function normalizeRoomIds(body) {
  const raw = body?.roomIds ?? body?.rooms;
  if (!Array.isArray(raw)) return [];
  const ids = [...new Set(raw.map((id) => String(id).trim()).filter(Boolean))];
  return ids.filter((id) => mongoose.isValidObjectId(id));
}

async function assertRoomsExist(roomIds) {
  if (roomIds.length < 2) {
    return { ok: false, error: "Select at least two rooms for this offer" };
  }
  const count = await Room.countDocuments({ _id: { $in: roomIds } });
  if (count !== roomIds.length) {
    return { ok: false, error: "One or more room ids are invalid" };
  }
  return { ok: true };
}

router.get("/offers", requireRoomManager, async (_req, res) => {
  try {
    const list = await Offer.find()
      .populate("rooms", "roomNumber variant roomType basePricePerNight status")
      .sort({ updatedAt: -1 })
      .lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/offers", requireRoomManager, async (req, res) => {
  try {
    const title = String(req.body?.title ?? "").trim();
    if (!title) {
      return res.status(400).json({ error: "title is required" });
    }
    const roomIds = normalizeRoomIds(req.body);
    const check = await assertRoomsExist(roomIds);
    if (!check.ok) {
      return res.status(400).json({ error: check.error });
    }
    const description = String(req.body?.description ?? "").trim();
    const packagePrice = Math.max(0, Number(req.body?.packagePrice) || 0);
    const active = req.body?.active !== false;
    const doc = await Offer.create({
      title,
      description,
      rooms: roomIds,
      packagePrice,
      active,
    });
    const populated = await Offer.findById(doc._id)
      .populate("rooms", "roomNumber variant roomType basePricePerNight status")
      .lean();
    res.status(201).json(populated);
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

router.patch("/offers/:id", requireRoomManager, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const offer = await Offer.findById(id);
    if (!offer) {
      return res.status(404).json({ error: "Offer not found" });
    }
    const { title, description, packagePrice, active } = req.body || {};
    if (title !== undefined) {
      const t = String(title).trim();
      if (!t) {
        return res.status(400).json({ error: "title cannot be empty" });
      }
      offer.title = t;
    }
    if (description !== undefined) {
      offer.description = String(description).trim();
    }
    if (packagePrice !== undefined) {
      offer.packagePrice = Math.max(0, Number(packagePrice) || 0);
    }
    if (active !== undefined) {
      offer.active = Boolean(active);
    }
    const roomIds = normalizeRoomIds(req.body);
    if (roomIds.length > 0) {
      const check = await assertRoomsExist(roomIds);
      if (!check.ok) {
        return res.status(400).json({ error: check.error });
      }
      offer.rooms = roomIds;
    }
    await offer.save();
    const populated = await Offer.findById(offer._id)
      .populate("rooms", "roomNumber variant roomType basePricePerNight status")
      .lean();
    res.json(populated);
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete("/offers/:id", requireRoomManager, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const deleted = await Offer.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: "Offer not found" });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
