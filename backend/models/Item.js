import mongoose from "mongoose";

const itemSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export default mongoose.model("Item", itemSchema);
