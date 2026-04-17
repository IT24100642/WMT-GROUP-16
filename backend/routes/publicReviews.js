import { Router } from "express";
import Review, { REVIEW_CATEGORIES } from "../models/Review.js";

const router = Router();

router.get("/reviews", async (req, res) => {
  try {
    const category = String(req.query?.category || "").trim().toLowerCase();
    const limit = Math.min(100, Math.max(1, Number(req.query?.limit) || 30));
    const filter = { status: "active" };
    if (category) {
      if (!REVIEW_CATEGORIES.includes(category)) {
        return res.status(400).json({ error: "Invalid category" });
      }
      filter.category = category;
    }
    const list = await Review.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
