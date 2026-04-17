import mongoose from "mongoose";

const foodMenuCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

foodMenuCategorySchema.index({ active: 1, sortOrder: 1, name: 1 });
foodMenuCategorySchema.index({ name: 1 }, { unique: true });

export default mongoose.model("FoodMenuCategory", foodMenuCategorySchema);
