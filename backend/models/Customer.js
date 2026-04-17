import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    customerNumber: { type: Number, required: true, unique: true, index: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    passwordHash: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Customer", customerSchema);
