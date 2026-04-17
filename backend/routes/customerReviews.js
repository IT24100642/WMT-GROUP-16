import { Router } from "express";
import mongoose from "mongoose";
import { requireCustomer } from "../middleware/auth.js";
import Review, { REVIEW_CATEGORIES } from "../models/Review.js";
import { analyzeReviewSentiment } from "../services/reviewSentiment.js";

const router = Router();

function normalizeReviewInput(body) {
  const text = String(body?.text ?? "").trim();
  const rating = Number(body?.rating);
  const category = String(body?.category ?? "").trim().toLowerCase();
  return { text, rating, category };
}

function validateReviewInput({ text, rating, category }) {
  if (!text) return "Review text is required";
  if (text.length < 5) return "Review text must be at least 5 characters";
  if (text.length > 2000) return "Review text must be at most 2000 characters";
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return "Rating must be 1 to 5";
  if (!REVIEW_CATEGORIES.includes(category)) return "Invalid review category";
  return "";
}

router.get("/reviews", requireCustomer, async (req, res) => {
  try {
    const list = await Review.find({ customer: req.customer.id, status: "active" })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/reviews", requireCustomer, async (req, res) => {
  try {
    const input = normalizeReviewInput(req.body);
    const validationError = validateReviewInput(input);
    if (validationError) return res.status(400).json({ error: validationError });

    const duplicate = await Review.findOne({
      customer: req.customer.id,
      text: input.text,
      category: input.category,
      status: "active",
      createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) },
    }).lean();
    if (duplicate) {
      return res.status(409).json({ error: "Duplicate review detected. Please edit your existing review." });
    }

    const sentiment = analyzeReviewSentiment(input.text, input.rating);
    const created = await Review.create({
      customer: req.customer.id,
      customerNumber: req.customer.customerNumber,
      customerEmail: req.customer.email,
      rating: input.rating,
      text: input.text,
      category: input.category,
      sentimentLabel: sentiment.label,
      sentimentScore: sentiment.score,
      mlTokens: sentiment.tokens,
      cleanedPreview: sentiment.cleanedPreview,
      sentimentPositivePct: sentiment.sentimentPositivePct,
      sentimentNeutralPct: sentiment.sentimentNeutralPct,
      sentimentNegativePct: sentiment.sentimentNegativePct,
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/reviews/:id", requireCustomer, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Invalid review id" });

    const review = await Review.findById(id);
    if (!review || review.status !== "active") return res.status(404).json({ error: "Review not found" });
    if (String(review.customer) !== req.customer.id) return res.status(403).json({ error: "You can only edit your own review" });

    const rating = Number(req.body?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be 1 to 5" });
    }

    const sentiment = analyzeReviewSentiment(review.text, rating);
    review.rating = rating;
    review.sentimentLabel = sentiment.label;
    review.sentimentScore = sentiment.score;
    review.mlTokens = sentiment.tokens;
    review.cleanedPreview = sentiment.cleanedPreview;
    review.sentimentPositivePct = sentiment.sentimentPositivePct;
    review.sentimentNeutralPct = sentiment.sentimentNeutralPct;
    review.sentimentNegativePct = sentiment.sentimentNegativePct;
    await review.save();
    res.json(review);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/reviews/:id", requireCustomer, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Invalid review id" });
    const review = await Review.findById(id);
    if (!review || review.status !== "active") return res.status(404).json({ error: "Review not found" });
    if (String(review.customer) !== req.customer.id) return res.status(403).json({ error: "You can only delete your own review" });

    review.status = "removed";
    review.removedReason = "Removed by guest";
    await review.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
