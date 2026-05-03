import { Router } from "express";
import mongoose from "mongoose";
import FoodItem from "../models/FoodItem.js";
import FoodMenuCategory from "../models/FoodMenuCategory.js";
import FoodOrder, { FOOD_ORDER_STATUSES } from "../models/FoodOrder.js";
import Customer from "../models/Customer.js";
import { requireKitchenManager } from "../middleware/auth.js";
import { publicUrlForFoodFilename, uploadFoodPhoto } from "../middleware/foodPhotoUpload.js";
import { unlinkPublicUpload } from "../middleware/roomPhotoUpload.js";
import { serverError } from "../lib/respond.js";

const router = Router();

function handleFoodPhotoUpload(req, res, next) {
  uploadFoodPhoto.single("photo")(req, res, (err) => {
    if (err) {
      const msg = err.code === "LIMIT_FILE_SIZE" ? "Image must be 5 MB or smaller" : err.message || "Upload failed";
      return res.status(400).json({ error: msg });
    }
    next();
  });
}

router.get("/kitchen/food-categories", requireKitchenManager, async (_req, res) => {
  try {
    const list = await FoodMenuCategory.find().sort({ sortOrder: 1, name: 1 }).lean();
    res.json(list);
  } catch (err) {
    serverError(res, err);
  }
});

router.post("/kitchen/food-categories", requireKitchenManager, async (req, res) => {
  try {
    const name = String(req.body?.name ?? "").trim();
    if (!name) {
      return res.status(400).json({ error: "Category name is required" });
    }
    const description = String(req.body?.description ?? "").trim();
    const sortOrder = Math.floor(Number(req.body?.sortOrder));
    const targetSortOrder = Math.max(0, Number.isFinite(sortOrder) ? sortOrder : 0);
    await FoodMenuCategory.updateMany(
      { sortOrder: { $gte: targetSortOrder } },
      { $inc: { sortOrder: 1 } }
    );
    const doc = await FoodMenuCategory.create({
      name,
      description,
      sortOrder: targetSortOrder,
      active: req.body?.active === false ? false : true,
    });
    res.status(201).json(doc.toObject());
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "A category with this name already exists" });
    }
    serverError(res, err);
  }
});

router.patch("/kitchen/food-categories/:id", requireKitchenManager, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const cat = await FoodMenuCategory.findById(id);
    if (!cat) {
      return res.status(404).json({ error: "Category not found" });
    }
    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ error: "Name cannot be empty" });
      cat.name = name;
    }
    if (req.body?.description !== undefined) {
      cat.description = String(req.body.description).trim();
    }
    if (req.body?.sortOrder !== undefined) {
      const sortOrder = Math.floor(Number(req.body.sortOrder));
      if (Number.isFinite(sortOrder)) {
        const currentSort = Math.floor(Number(cat.sortOrder) || 0);
        const nextSort = Math.max(0, sortOrder);
        if (nextSort !== currentSort) {
          if (nextSort < currentSort) {
            await FoodMenuCategory.updateMany(
              {
                _id: { $ne: cat._id },
                sortOrder: { $gte: nextSort, $lt: currentSort },
              },
              { $inc: { sortOrder: 1 } }
            );
          } else {
            await FoodMenuCategory.updateMany(
              {
                _id: { $ne: cat._id },
                sortOrder: { $gt: currentSort, $lte: nextSort },
              },
              { $inc: { sortOrder: -1 } }
            );
          }
          cat.sortOrder = nextSort;
        }
      }
    }
    if (req.body?.active !== undefined) {
      cat.active = Boolean(req.body.active);
    }
    await cat.save();
    res.json(cat.toObject());
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "A category with this name already exists" });
    }
    serverError(res, err);
  }
});

router.delete("/kitchen/food-categories/:id", requireKitchenManager, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const cat = await FoodMenuCategory.findById(id);
    if (!cat) {
      return res.status(404).json({ error: "Category not found" });
    }
    await FoodItem.updateMany({ category: cat._id }, { $set: { category: null } });
    await cat.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    serverError(res, err);
  }
});

router.get("/kitchen/food-items", requireKitchenManager, async (_req, res) => {
  try {
    const list = await FoodItem.find().populate("category", "name active sortOrder").sort({ sortOrder: 1, name: 1 }).lean();
    res.json(list);
  } catch (err) {
    serverError(res, err);
  }
});

router.post("/kitchen/food-items", requireKitchenManager, async (req, res) => {
  try {
    const name = String(req.body?.name ?? "").trim();
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }
    const description = String(req.body?.description ?? "").trim();
    const price = Math.round(Number(req.body?.price));
    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({ error: "Valid price (LKR) is required" });
    }
    const sortOrder = Math.floor(Number(req.body?.sortOrder));
    const targetSortOrder = Math.max(0, Number.isFinite(sortOrder) ? sortOrder : 0);
    let category = null;
    const catId = String(req.body?.categoryId ?? req.body?.category ?? "").trim();
    if (catId) {
      if (!mongoose.isValidObjectId(catId)) {
        return res.status(400).json({ error: "Invalid category" });
      }
      const catDoc = await FoodMenuCategory.findOne({ _id: catId, active: true }).lean();
      if (!catDoc) {
        return res.status(400).json({ error: "Category not found or inactive" });
      }
      category = catDoc._id;
    }
    await FoodItem.updateMany(
      { sortOrder: { $gte: targetSortOrder } },
      { $inc: { sortOrder: 1 } }
    );
    const doc = await FoodItem.create({
      name,
      description,
      price,
      active: req.body?.active === false ? false : true,
      sortOrder: targetSortOrder,
      category,
    });
    const out = await FoodItem.findById(doc._id).populate("category", "name active sortOrder").lean();
    res.status(201).json(out);
  } catch (err) {
    serverError(res, err);
  }
});

router.patch("/kitchen/food-items/:id", requireKitchenManager, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const item = await FoodItem.findById(id);
    if (!item) {
      return res.status(404).json({ error: "Not found" });
    }
    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ error: "Name cannot be empty" });
      item.name = name;
    }
    if (req.body?.description !== undefined) {
      item.description = String(req.body.description).trim();
    }
    if (req.body?.price !== undefined) {
      const price = Math.round(Number(req.body.price));
      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({ error: "Invalid price" });
      }
      item.price = price;
    }
    if (req.body?.active !== undefined) {
      item.active = Boolean(req.body.active);
    }
    if (req.body?.sortOrder !== undefined) {
      const sortOrder = Math.floor(Number(req.body.sortOrder));
      if (Number.isFinite(sortOrder)) item.sortOrder = sortOrder;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "categoryId") || Object.prototype.hasOwnProperty.call(req.body || {}, "category")) {
      const body = req.body || {};
      const val = Object.prototype.hasOwnProperty.call(body, "categoryId") ? body.categoryId : body.category;
      if (val === null || val === "") {
        item.category = null;
      } else {
        const raw = String(val).trim();
        if (!mongoose.isValidObjectId(raw)) {
          return res.status(400).json({ error: "Invalid category" });
        }
        const catDoc = await FoodMenuCategory.findOne({ _id: raw, active: true }).lean();
        if (!catDoc) {
          return res.status(400).json({ error: "Category not found or inactive" });
        }
        item.category = catDoc._id;
      }
    }
    await item.save();
    const out = await FoodItem.findById(item._id).populate("category", "name active sortOrder").lean();
    res.json(out);
  } catch (err) {
    serverError(res, err);
  }
});

router.delete("/kitchen/food-items/:id", requireKitchenManager, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const item = await FoodItem.findById(id);
    if (!item) {
      return res.status(404).json({ error: "Not found" });
    }
    const photoUrls = (item.photos || []).map((p) => p.url).filter(Boolean);
    await item.deleteOne();
    await Promise.all(photoUrls.map((url) => unlinkPublicUpload(url)));
    res.json({ ok: true });
  } catch (err) {
    serverError(res, err);
  }
});

router.post(
  "/kitchen/food-items/:foodItemId/photos",
  requireKitchenManager,
  handleFoodPhotoUpload,
  async (req, res) => {
    try {
      const { foodItemId } = req.params;
      if (!mongoose.isValidObjectId(foodItemId)) {
        return res.status(400).json({ error: "Invalid food item id" });
      }
      if (!req.file) {
        return res.status(400).json({ error: "No image file (field name: photo)" });
      }
      const item = await FoodItem.findById(foodItemId);
      if (!item) {
        await unlinkPublicUpload(publicUrlForFoodFilename(req.file.filename));
        return res.status(404).json({ error: "Food item not found" });
      }
      const url = publicUrlForFoodFilename(req.file.filename);
      item.photos.push({
        url,
        originalName: req.file.originalname || "",
      });
      await item.save();
      const added = item.photos[item.photos.length - 1];
      res.status(201).json(added.toObject());
    } catch (err) {
      serverError(res, err);
    }
  }
);

router.delete("/kitchen/food-items/:foodItemId/photos/:photoId", requireKitchenManager, async (req, res) => {
  try {
    const { foodItemId, photoId } = req.params;
    if (!mongoose.isValidObjectId(foodItemId) || !mongoose.isValidObjectId(photoId)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const item = await FoodItem.findById(foodItemId);
    if (!item) {
      return res.status(404).json({ error: "Food item not found" });
    }
    const photo = item.photos.id(photoId);
    if (!photo) {
      return res.status(404).json({ error: "Photo not found" });
    }
    const url = photo.url;
    photo.deleteOne();
    await item.save();
    await unlinkPublicUpload(url);
    res.json({ ok: true });
  } catch (err) {
    serverError(res, err);
  }
});

router.get("/kitchen/food-orders", requireKitchenManager, async (_req, res) => {
  try {
    const list = await FoodOrder.find()
      .sort({ createdAt: -1 })
      .populate("customer", "email customerNumber")
      .populate("lines.foodItem", "name category photos")
      .lean();
    res.json(list);
  } catch (err) {
    serverError(res, err);
  }
});

router.patch("/kitchen/food-orders/:id", requireKitchenManager, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const order = await FoodOrder.findById(id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    if (req.body?.orderStatus !== undefined) {
      const next = String(req.body.orderStatus).trim();
      if (!FOOD_ORDER_STATUSES.includes(next)) {
        return res.status(400).json({ error: "Invalid order status" });
      }
      order.orderStatus = next;
    }
    await order.save();
    const populated = await FoodOrder.findById(order._id)
      .populate("customer", "email customerNumber")
      .populate("lines.foodItem", "name category photos")
      .lean();
    res.json(populated);
  } catch (err) {
    serverError(res, err);
  }
});

router.post("/kitchen/food-orders", requireKitchenManager, async (req, res) => {
  try {
    const customerId = String(req.body?.customerId ?? "").trim();
    if (!mongoose.isValidObjectId(customerId)) {
      return res.status(400).json({ error: "Valid customerId is required" });
    }
    const customer = await Customer.findById(customerId).lean();
    if (!customer || !customer.active) {
      return res.status(404).json({ error: "Customer not found" });
    }
    const rawLines = req.body?.lines;
    if (!Array.isArray(rawLines) || rawLines.length === 0) {
      return res.status(400).json({ error: "Add at least one item to your order" });
    }

    const lines = [];
    for (const row of rawLines) {
      const id = String(row?.foodItemId ?? row?.foodItem ?? "").trim();
      const qty = Math.floor(Number(row?.quantity));
      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ error: "Invalid menu item" });
      }
      if (!Number.isFinite(qty) || qty < 1 || qty > 99) {
        return res.status(400).json({ error: "Each quantity must be between 1 and 99" });
      }
      const item = await FoodItem.findOne({ _id: id, active: true }).lean();
      if (!item) {
        return res.status(400).json({ error: "A menu item is no longer available" });
      }
      lines.push({
        foodItem: item._id,
        name: item.name,
        unitPrice: Math.round(Number(item.price) || 0),
        quantity: qty,
      });
    }

    const subtotal = lines.reduce((sum, L) => sum + L.unitPrice * L.quantity, 0);
    const paymentMethod = String(req.body?.paymentMethod ?? "cash").trim();
    const immediatePaid = paymentMethod === "cash" || paymentMethod === "online";

    const doc = await FoodOrder.create({
      customer: customer._id,
      lines,
      subtotal,
      paymentMethod: paymentMethod === "room_bill" ? "room_bill" : immediatePaid ? paymentMethod : "cash",
      paymentStatus: immediatePaid ? "paid" : "pending",
      settledVia: immediatePaid ? (paymentMethod === "cash" ? "cash" : "online") : null,
      settledAt: immediatePaid ? new Date() : null,
      orderStatus: "received",
    });

    const populated = await FoodOrder.findById(doc._id)
      .populate("customer", "email customerNumber")
      .populate("lines.foodItem", "name category photos")
      .lean();
    res.status(201).json(populated);
  } catch (err) {
    serverError(res, err);
  }
});

router.get("/kitchen/billing-history", requireKitchenManager, async (_req, res) => {
  try {
    const list = await FoodOrder.find({ paymentStatus: "paid" })
      .sort({ settledAt: -1, createdAt: -1 })
      .populate("customer", "email customerNumber")
      .lean();
    res.json(list);
  } catch (err) {
    serverError(res, err);
  }
});

router.get("/kitchen/reports/daily-sales", requireKitchenManager, async (_req, res) => {
  try {
    const paid = await FoodOrder.find({ paymentStatus: "paid" }).lean();
    const byDate = new Map();
    for (const o of paid) {
      const d = o.settledAt ? new Date(o.settledAt) : new Date(o.createdAt);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      const prev = byDate.get(key) || { date: key, revenue: 0, orders: 0 };
      prev.revenue += Math.round(Number(o.subtotal) || 0);
      prev.orders += 1;
      byDate.set(key, prev);
    }
    const rows = Array.from(byDate.values()).sort((a, b) => (a.date < b.date ? 1 : -1));
    res.json(rows);
  } catch (err) {
    serverError(res, err);
  }
});

export default router;
