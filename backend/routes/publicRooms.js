import Room from "../models/Room.js";
import { sortRoomsByNumber } from "../seed/fixedRooms.js";

/** Public catalog — all rooms maintained in the system (guest-facing). */
export async function getPublicRooms(_req, res) {
  try {
    const rooms = sortRoomsByNumber(await Room.find().lean());
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
