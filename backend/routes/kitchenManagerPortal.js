import { Router } from "express";
import mongoose from "mongoose";
import FoodItem from "../models/FoodItem.js";
import FoodMenuCategory from "../models/FoodMenuCategory.js";
import FoodOrder, { FOOD_ORDER_STATUSES } from "../models/FoodOrder.js";
import { requireKitchenManager } from "../middleware/auth.js";
import { publicUrlForFoodFilename, uploadFoodPhoto } from "../middleware/foodPhotoUpload.js";
import { unlinkPublicUpload } from "../middleware/roomPhotoUpload.js";

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
    res.status(500).json({ error: err.message });
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
    const doc = await FoodMenuCategory.create({
      name,
      description,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
      active: req.body?.active === false ? false : true,
    });
    res.status(201).json(doc.toObject());
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "A category with this name already exists" });
    }
    res.status(500).json({ error: err.message });
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
      if (Number.isFinite(sortOrder)) cat.sortOrder = sortOrder;
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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
});

router.get("/kitchen/food-items", requireKitchenManager, async (_req, res) => {
  try {
    const list = await FoodItem.find().populate("category", "name active sortOrder").sort({ sortOrder: 1, name: 1 }).lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    const doc = await FoodItem.create({
      name,
      description,
      price,
      active: req.body?.active === false ? false : true,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
      category,
    });
    const out = await FoodItem.findById(doc._id).populate("category", "name active sortOrder").lean();
    res.status(201).json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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
      res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
});

export default router;
