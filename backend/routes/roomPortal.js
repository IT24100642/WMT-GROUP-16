import { Router } from "express";
import mongoose from "mongoose";
import Staff from "../models/Staff.js";
import Room, { ROOM_STATUSES } from "../models/Room.js";
import Offer from "../models/Offer.js";
import MaintenanceRecord from "../models/MaintenanceRecord.js";
import HousekeepingRecord from "../models/HousekeepingRecord.js";
import { requireRoomManager } from "../middleware/auth.js";
import { publicUrlForFilename, publicUrlForOfferFilename, unlinkPublicUpload, uploadOfferPhoto, uploadRoomPhoto } from "../middleware/roomPhotoUpload.js";
import { sortRoomsByNumber } from "../seed/fixedRooms.js";
import { serverError } from "../lib/respond.js";

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

function handleOfferPhotoUpload(req, res, next) {
  uploadOfferPhoto.single("photo")(req, res, (err) => {
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
    serverError(res, err);
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
    serverError(res, err);
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
    const assignedRoleRaw = String(req.body?.assignedRole ?? "").trim().toLowerCase();
    const assignedRole = ["plumber", "room_helper", "electrician"].includes(assignedRoleRaw) ? assignedRoleRaw : "";
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
      assignedRole,
    });
    const populated = await MaintenanceRecord.findById(rec._id)
      .populate("assignedStaff", "name username")
      .lean();
    res.status(201).json(populated);
  } catch (err) {
    serverError(res, err);
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
    const { title, notes, status, scheduledFor, assignedStaff, assignedRole } = req.body || {};
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
    if (assignedRole !== undefined) {
      const role = String(assignedRole || "").trim().toLowerCase();
      rec.assignedRole = ["plumber", "room_helper", "electrician"].includes(role) ? role : "";
    }
    await rec.save();
    const populated = await MaintenanceRecord.findById(rec._id)
      .populate("assignedStaff", "name username")
      .lean();
    res.json(populated);
  } catch (err) {
    serverError(res, err);
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
    serverError(res, err);
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
    serverError(res, err);
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
    const assignedGroupRaw = String(req.body?.assignedGroup ?? "").trim().toLowerCase();
    const assignedGroup = ["group-01", "group-02", "group-03", "group-04", "group-05"].includes(assignedGroupRaw)
      ? assignedGroupRaw
      : "";
    if (assignedStaff && !mongoose.isValidObjectId(String(assignedStaff))) {
      assignedStaff = null;
    }
    const rec = await HousekeepingRecord.create({
      room: roomId,
      task,
      notes,
      status: ["pending", "in_progress", "completed", "cancelled"].includes(status) ? status : "pending",
      assignedStaff: assignedStaff || null,
      assignedGroup,
    });
    if (rec.status === "completed") {
      await Room.updateOne(
        { _id: roomId, status: "Cleaning" },
        { $set: { status: "Available" } }
      );
    }
    const populated = await HousekeepingRecord.findById(rec._id)
      .populate("assignedStaff", "name username")
      .lean();
    res.status(201).json(populated);
  } catch (err) {
    serverError(res, err);
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
    const { task, notes, status, assignedStaff, assignedGroup } = req.body || {};
    if (task !== undefined) rec.task = String(task).trim();
    if (notes !== undefined) rec.notes = String(notes).trim();
    if (status !== undefined && ["pending", "in_progress", "completed", "cancelled"].includes(status)) {
      rec.status = status;
    }
    if (assignedStaff !== undefined) {
      rec.assignedStaff =
        assignedStaff && mongoose.isValidObjectId(String(assignedStaff)) ? assignedStaff : null;
    }
    if (assignedGroup !== undefined) {
      const group = String(assignedGroup || "").trim().toLowerCase();
      rec.assignedGroup = ["group-01", "group-02", "group-03", "group-04", "group-05"].includes(group) ? group : "";
    }
    await rec.save();
    if (rec.status === "completed") {
      await Room.updateOne(
        { _id: rec.room, status: "Cleaning" },
        { $set: { status: "Available" } }
      );
    }
    const populated = await HousekeepingRecord.findById(rec._id)
      .populate("assignedStaff", "name username")
      .lean();
    res.json(populated);
  } catch (err) {
    serverError(res, err);
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
    serverError(res, err);
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
      if (room.status === "Reserved" || room.status === "Occupied") {
        await unlinkPublicUpload(publicUrlForFilename(req.file.filename));
        return res.status(400).json({ error: "Cannot modify room photos while the room is reserved or occupied" });
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
      serverError(res, err);
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
    if (room.status === "Reserved" || room.status === "Occupied") {
      return res.status(400).json({ error: "Cannot modify room photos while the room is reserved or occupied" });
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
    serverError(res, err);
  }
});

router.post("/rooms/:roomId/photos-by-url", requireRoomManager, async (req, res) => {
  try {
    const { roomId } = req.params;
    if (!mongoose.isValidObjectId(roomId)) {
      return res.status(400).json({ error: "Invalid room id" });
    }
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }
    if (room.status === "Reserved" || room.status === "Occupied") {
      return res.status(400).json({ error: "Cannot modify room photos while the room is reserved or occupied" });
    }
    const url = String(req.body?.url ?? "").trim();
    if (!/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: "A valid http/https photo URL is required" });
    }
    room.photos.push({
      url,
      originalName: String(req.body?.originalName ?? "external-photo").trim(),
    });
    await room.save();
    const added = room.photos[room.photos.length - 1];
    res.status(201).json(added.toObject());
  } catch (err) {
    serverError(res, err);
  }
});

router.get("/rooms", requireRoomManager, async (_req, res) => {
  try {
    const rooms = sortRoomsByNumber(await Room.find().lean());
    res.json(rooms);
  } catch (err) {
    serverError(res, err);
  }
});

router.post("/rooms", requireRoomManager, async (req, res) => {
  try {
    const roomNumber = String(req.body?.roomNumber ?? "").trim();
    const floor = Number(req.body?.floor ?? 1);
    const variant = String(req.body?.variant ?? "").trim();
    const roomType = String(req.body?.roomType ?? "").trim() || "Standard Room";
    const capacity = Number(req.body?.capacity ?? 2);
    const basePricePerNight = Math.max(0, Number(req.body?.basePricePerNight ?? 0));
    const description = String(req.body?.description ?? "").trim();
    const status = String(req.body?.status ?? "Available");
    const airConditioned =
      req.body?.airConditioned === undefined ? true : Boolean(req.body?.airConditioned);
    const amenities = Array.isArray(req.body?.amenities)
      ? req.body.amenities.map((a) => String(a).trim()).filter(Boolean)
      : [];

    if (!roomNumber) {
      return res.status(400).json({ error: "roomNumber is required" });
    }
    if (!variant) {
      return res.status(400).json({ error: "variant is required" });
    }
    if (capacity < 1) {
      return res.status(400).json({ error: "capacity must be at least 1" });
    }
    if (!ROOM_STATUSES.includes(status)) {
      return res.status(400).json({ error: "Invalid room status" });
    }

    const created = await Room.create({
      roomNumber,
      floor: Number.isFinite(floor) ? floor : 1,
      variant,
      roomType,
      capacity,
      basePricePerNight,
      description,
      status,
      airConditioned,
      amenities,
    });
    res.status(201).json(created.toObject());
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Room number already exists" });
    }
    if (err?.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    serverError(res, err);
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
    serverError(res, err);
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
    const isBookingLockedRoom = room.status === "Reserved" || room.status === "Occupied";
    if (isBookingLockedRoom && (description !== undefined || basePricePerNight !== undefined)) {
      return res.status(400).json({ error: "Cannot update description or room price while the room is reserved or occupied" });
    }
    if (isBookingLockedRoom && status !== undefined) {
      return res.status(400).json({ error: "Cannot change room status while the room is reserved or occupied" });
    }
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
    serverError(res, err);
  }
});

router.delete("/rooms/:id", requireRoomManager, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const room = await Room.findById(id);
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }
    if (room.status === "Reserved" || room.status === "Occupied") {
      return res.status(400).json({ error: "Cannot delete room while reserved or occupied" });
    }
    await MaintenanceRecord.deleteMany({ room: room._id });
    await HousekeepingRecord.deleteMany({ room: room._id });
    await room.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    serverError(res, err);
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
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected. Start MongoDB and try again." });
    }
    const list = await Offer.find()
      .populate("rooms", "roomNumber variant roomType basePricePerNight status")
      .sort({ updatedAt: -1 })
      .lean();
    res.json(list);
  } catch (err) {
    serverError(res, err);
  }
});

router.post("/offers", requireRoomManager, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected. Start MongoDB and try again." });
    }
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
    serverError(res, err);
  }
});

router.patch("/offers/:id", requireRoomManager, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected. Start MongoDB and try again." });
    }
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
    serverError(res, err);
  }
});

router.delete("/offers/:id", requireRoomManager, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected. Start MongoDB and try again." });
    }
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
    serverError(res, err);
  }
});

router.post(
  "/offers/:offerId/photos",
  requireRoomManager,
  handleOfferPhotoUpload,
  async (req, res) => {
    try {
      const { offerId } = req.params;
      if (!mongoose.isValidObjectId(offerId)) {
        return res.status(400).json({ error: "Invalid offer id" });
      }
      if (!req.file) {
        return res.status(400).json({ error: "No image file (field name: photo)" });
      }
      const offer = await Offer.findById(offerId);
      if (!offer) {
        await unlinkPublicUpload(publicUrlForOfferFilename(req.file.filename));
        return res.status(404).json({ error: "Offer not found" });
      }
      const url = publicUrlForOfferFilename(req.file.filename);
      offer.photos.push({
        url,
        originalName: req.file.originalname || "",
      });
      await offer.save();
      const added = offer.photos[offer.photos.length - 1];
      res.status(201).json(added.toObject());
    } catch (err) {
      serverError(res, err);
    }
  }
);

router.delete("/offers/:offerId/photos/:photoId", requireRoomManager, async (req, res) => {
  try {
    const { offerId, photoId } = req.params;
    if (!mongoose.isValidObjectId(offerId) || !mongoose.isValidObjectId(photoId)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const offer = await Offer.findById(offerId);
    if (!offer) {
      return res.status(404).json({ error: "Offer not found" });
    }
    const photo = offer.photos.id(photoId);
    if (!photo) {
      return res.status(404).json({ error: "Photo not found" });
    }
    const url = photo.url;
    photo.deleteOne();
    await offer.save();
    await unlinkPublicUpload(url);
    res.json({ ok: true });
  } catch (err) {
    serverError(res, err);
  }
});

export default router;
