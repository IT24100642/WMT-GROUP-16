import Offer from "../models/Offer.js";

const roomSummary =
  "roomNumber variant roomType basePricePerNight status";

/** Active multi-room offers for the public Reservations “Offers” dialog. */
export async function getPublicOffers(_req, res) {
  try {
    const list = await Offer.find({ active: true })
      .populate("rooms", roomSummary)
      .sort({ updatedAt: -1 })
      .lean();

    const shaped = list.map((o) => ({
      _id: o._id,
      title: o.title,
      description: o.description,
      packagePrice: o.packagePrice,
      rooms: (o.rooms || []).filter(Boolean),
    }));

    res.json(shaped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
