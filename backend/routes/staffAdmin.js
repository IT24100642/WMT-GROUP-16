import { Router } from "express";
import Staff from "../models/Staff.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAdmin);

router.get("/", async (_req, res) => {
  try {
    const list = await Staff.find().populate("role").sort({ name: 1 }).lean();
    for (const s of list) {
      delete s.passwordHash;
    }
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
