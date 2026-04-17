import "dotenv/config";
import path from "path";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import Item from "./models/Item.js";
import { bootstrapData } from "./seed/bootstrap.js";
import authRoutes from "./routes/auth.js";
import staffPortalRoutes from "./routes/staffPortal.js";
import roleRoutes from "./routes/roles.js";
import staffAdminRoutes from "./routes/staffAdmin.js";
import shiftRoutes from "./routes/shifts.js";
import reportRoutes from "./routes/reports.js";
import { getPublicRooms } from "./routes/publicRooms.js";
import { getPublicOffers } from "./routes/publicOffers.js";
import roomPortalRoutes from "./routes/roomPortal.js";
import customerAuthRoutes from "./routes/customerAuth.js";
import customerManagerPortalRoutes from "./routes/customerManagerPortal.js";
import customerBookingsRoutes from "./routes/customerBookings.js";
import receptionistBookingsRoutes from "./routes/receptionistBookings.js";
import publicFoodItemsRoutes from "./routes/publicFoodItems.js";
import customerFoodOrdersRoutes from "./routes/customerFoodOrders.js";
import kitchenManagerPortalRoutes from "./routes/kitchenManagerPortal.js";
import publicReviewsRoutes from "./routes/publicReviews.js";
import customerReviewsRoutes from "./routes/customerReviews.js";
import reviewManagerPortalRoutes from "./routes/reviewManagerPortal.js";
import customerIssuesRoutes from "./routes/customerIssues.js";
import adminIssuesRoutes from "./routes/adminIssues.js";

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/simple_app";

app.use(cors({ origin: true }));
app.use(express.json());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, db: mongoose.connection.readyState === 1 });
});

app.use("/api/auth", authRoutes);
app.use("/api/customer-auth", customerAuthRoutes);
app.use("/api/customer-auth", customerBookingsRoutes);
app.use("/api/customer-auth", customerFoodOrdersRoutes);
app.use("/api/customer-auth", customerReviewsRoutes);
app.use("/api/customer-auth", customerIssuesRoutes);
app.use("/api/staff-portal", staffPortalRoutes);
app.use("/api/staff-portal", roomPortalRoutes);
app.use("/api/staff-portal", customerManagerPortalRoutes);
app.use("/api/staff-portal", receptionistBookingsRoutes);
app.use("/api/staff-portal", kitchenManagerPortalRoutes);
app.use("/api/staff-portal", reviewManagerPortalRoutes);
app.get("/api/public/rooms", getPublicRooms);
app.get("/api/public/offers", getPublicOffers);
app.use("/api/public", publicFoodItemsRoutes);
app.use("/api/public", publicReviewsRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/staff", staffAdminRoutes);
app.use("/api/admin", adminIssuesRoutes);
app.use("/api/shifts", shiftRoutes);
app.use("/api/reports", reportRoutes);

app.get("/api/items", async (_req, res) => {
  try {
    res.json(await Item.find().sort({ createdAt: -1 }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/items", async (req, res) => {
  try {
    const text = String(req.body?.text ?? "").trim();
    if (!text) {
      return res.status(400).json({ error: "text is required" });
    }
    res.status(201).json(await Item.create({ text }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/items/:id", async (req, res) => {
  try {
    const deleted = await Item.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "not found" });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function main() {
  await mongoose.connect(MONGODB_URI);
  await bootstrapData();
  app.listen(PORT, () => {
    console.log(`API http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
