import mongoose from "mongoose";

/** Guest-facing: Rooms, Food, Staff, Other (stored lowercase). */
export const REVIEW_CATEGORIES = ["room", "food", "staff", "other"];
export const REVIEW_SENTIMENTS = ["positive", "neutral", "negative"];
export const REVIEW_STATUSES = ["active", "removed"];

const reviewSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    customerNumber: { type: Number, required: true, index: true },
    customerEmail: { type: String, required: true, trim: true, lowercase: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    category: { type: String, enum: REVIEW_CATEGORIES, required: true, index: true },
    sentimentLabel: { type: String, enum: REVIEW_SENTIMENTS, required: true },
    sentimentScore: { type: Number, required: true, min: -1, max: 1 },
    status: { type: String, enum: REVIEW_STATUSES, default: "active", index: true },
    removedReason: { type: String, default: "", trim: true, maxlength: 500 },
    removedByStaff: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", default: null },
    managerUpdatedAt: { type: Date, default: null },
    /** Review Manager / admin response shown to guests when you expose it publicly. */
    adminReply: { type: String, default: "", trim: true, maxlength: 2000 },
    adminReplyAt: { type: Date, default: null },
    adminReplyByStaff: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", default: null },
    /** Tokens after AIML cleaning (capped in app code). */
    mlTokens: { type: [String], default: [] },
    cleanedPreview: { type: String, default: "", trim: true, maxlength: 500 },
    /** Estimated class distribution after analysis (for dashboards / AIML reporting). */
    sentimentPositivePct: { type: Number, default: null, min: 0, max: 100 },
    sentimentNeutralPct: { type: Number, default: null, min: 0, max: 100 },
    sentimentNegativePct: { type: Number, default: null, min: 0, max: 100 },
  },
  { timestamps: true }
);

reviewSchema.index({ createdAt: -1 });
reviewSchema.index({ category: 1, createdAt: -1 });
reviewSchema.index({ sentimentLabel: 1, createdAt: -1 });

export default mongoose.model("Review", reviewSchema);
