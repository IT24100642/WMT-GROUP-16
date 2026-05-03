import { Router } from "express";
import FoodItem from "../models/FoodItem.js";
import FoodMenuCategory from "../models/FoodMenuCategory.js";
import { serverError } from "../lib/respond.js";

const router = Router();

/** Public menu for the food ordering page (guests see prices; checkout requires guest login). */
router.get("/food-items", async (_req, res) => {
  try {
    const list = await FoodItem.find({ active: true }).populate("category").sort({ sortOrder: 1, name: 1 }).lean();
    const visible = list.filter((row) => !row.category || row.category.active);
    visible.sort((a, b) => {
      const ca = a.category?.sortOrder ?? 9999;
      const cb = b.category?.sortOrder ?? 9999;
      if (ca !== cb) return ca - cb;
      const na = a.category?.name || "\uffff";
      const nb = b.category?.name || "\uffff";
      if (na !== nb) return na.localeCompare(nb);
      return (a.sortOrder || 0) - (b.sortOrder || 0) || String(a.name).localeCompare(String(b.name));
    });
    res.json(visible);
  } catch (err) {
    serverError(res, err);
  }
});

router.get("/food-categories", async (_req, res) => {
  try {
    const list = await FoodMenuCategory.find({ active: true }).sort({ sortOrder: 1, name: 1 }).lean();
    res.json(list);
  } catch (err) {
    serverError(res, err);
  }
});

export default router;
