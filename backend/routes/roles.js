import { Router } from "express";
import Role from "../models/Role.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAdmin);

router.get("/", async (_req, res) => {
  try {
    res.json(await Role.find().sort({ name: 1 }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
