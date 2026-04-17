import { Router } from "express";
import mongoose from "mongoose";
import { requireReviewManager } from "../middleware/auth.js";
import Review, { REVIEW_CATEGORIES, REVIEW_STATUSES } from "../models/Review.js";

const router = Router();

router.get("/reviews", requireReviewManager, async (req, res) => {
  try {
    const status = String(req.query?.status || "").trim().toLowerCase();
    const category = String(req.query?.category || "").trim().toLowerCase();
    const filter = {};
    if (status) {
      if (!REVIEW_STATUSES.includes(status)) return res.status(400).json({ error: "Invalid status" });
      filter.status = status;
    }
    if (category) {
      if (!REVIEW_CATEGORIES.includes(category)) return res.status(400).json({ error: "Invalid category" });
      filter.category = category;
    }
    const list = await Review.find(filter).sort({ createdAt: -1 }).limit(500).populate("adminReplyByStaff", "name username").lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/reviews/analytics", requireReviewManager, async (_req, res) => {
  try {
    const all = await Review.find().lean();
    const active = all.filter((r) => r.status === "active");
    const total = all.length;
    const activeCount = active.length;
    const removedCount = total - activeCount;
    const avgRating = activeCount > 0 ? Number((active.reduce((s, r) => s + (Number(r.rating) || 0), 0) / activeCount).toFixed(2)) : 0;

    const byCategory = REVIEW_CATEGORIES.map((category) => {
      const rows = active.filter((r) => r.category === category);
      return {
        category,
        count: rows.length,
        avgRating: rows.length ? Number((rows.reduce((s, r) => s + r.rating, 0) / rows.length).toFixed(2)) : 0,
      };
    });

    const roomReviewsCount = active.filter((r) => r.category === "room").length;
    const foodReviewsCount = active.filter((r) => r.category === "food").length;
    const staffReviewsCount = active.filter((r) => r.category === "staff").length;
    const otherReviewsCount = active.filter((r) => r.category === "other").length;

    const sentiment = {
      positive: active.filter((r) => r.sentimentLabel === "positive").length,
      neutral: active.filter((r) => r.sentimentLabel === "neutral").length,
      negative: active.filter((r) => r.sentimentLabel === "negative").length,
    };

    const withPct = active.filter((r) => r.sentimentPositivePct != null);
    const avgSentimentPct = {
      positive:
        withPct.length > 0
          ? Math.round(withPct.reduce((s, r) => s + (Number(r.sentimentPositivePct) || 0), 0) / withPct.length)
          : 0,
      neutral:
        withPct.length > 0
          ? Math.round(withPct.reduce((s, r) => s + (Number(r.sentimentNeutralPct) || 0), 0) / withPct.length)
          : 0,
      negative:
        withPct.length > 0
          ? Math.round(withPct.reduce((s, r) => s + (Number(r.sentimentNegativePct) || 0), 0) / withPct.length)
          : 0,
    };

    const trendMap = new Map();
    for (let i = 29; i >= 0; i -= 1) {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - i);
      const key = day.toISOString().slice(0, 10);
      trendMap.set(key, { date: key, count: 0, avgRating: 0, _sum: 0 });
    }
    for (const row of active) {
      const key = new Date(row.createdAt).toISOString().slice(0, 10);
      const entry = trendMap.get(key);
      if (!entry) continue;
      entry.count += 1;
      entry._sum += Number(row.rating) || 0;
    }
    const trend = [...trendMap.values()].map((d) => ({
      date: d.date,
      count: d.count,
      avgRating: d.count ? Number((d._sum / d.count).toFixed(2)) : 0,
    }));

    res.json({
      total,
      activeCount,
      removedCount,
      avgRating,
      byCategory,
      sentiment,
      trend,
      aiml: {
        roomReviewsCount,
        foodReviewsCount,
        staffReviewsCount,
        otherReviewsCount,
        avgSentimentPct,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/reviews/:id", requireReviewManager, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Invalid review id" });
    const review = await Review.findById(id);
    if (!review) return res.status(404).json({ error: "Review not found" });

    const raw = req.body && typeof req.body === "object" ? req.body : {};
    const keys = Object.keys(raw).filter((k) => raw[k] !== undefined);
    const allowed = new Set(["status", "removedReason"]);
    const forbidden = keys.filter((k) => !allowed.has(k));
    if (forbidden.length) {
      return res.status(403).json({
        error: "Review Manager may only change whether a review is shown on the public site (active or removed).",
      });
    }
    if (keys.length === 0) {
      return res.status(400).json({ error: "Send status (and optional removedReason when hiding a review)." });
    }
    if (raw.status === undefined) {
      return res.status(400).json({ error: "status is required" });
    }

    const { status, removedReason } = raw;
    if (!REVIEW_STATUSES.includes(status)) return res.status(400).json({ error: "Invalid review status" });
    review.status = status;
    if (status === "removed") {
      review.removedByStaff = req.staffAuth.id;
      review.removedReason = String(removedReason || "").trim();
      review.managerUpdatedAt = new Date();
    } else {
      review.removedByStaff = null;
      review.removedReason = "";
      review.managerUpdatedAt = new Date();
    }
    await review.save();
    const out = await Review.findById(review._id).populate("adminReplyByStaff", "name username").lean();
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
