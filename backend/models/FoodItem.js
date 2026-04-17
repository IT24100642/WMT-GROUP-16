import mongoose from "mongoose";

const foodPhotoSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    originalName: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

const foodItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    price: { type: Number, required: true, min: 0 },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "FoodMenuCategory", default: null, index: true },
    photos: { type: [foodPhotoSchema], default: [] },
  },
  { timestamps: true }
);

foodItemSchema.index({ active: 1, category: 1, sortOrder: 1, name: 1 });

export default mongoose.model("FoodItem", foodItemSchema);
