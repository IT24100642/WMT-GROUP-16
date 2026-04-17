import mongoose from "mongoose";

const housekeepingSchema = new mongoose.Schema(
  {
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
    assignedStaff: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", default: null },
    task: { type: String, required: true, trim: true },
    notes: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: true }
);

housekeepingSchema.index({ room: 1, createdAt: -1 });

export default mongoose.model("HousekeepingRecord", housekeepingSchema);
