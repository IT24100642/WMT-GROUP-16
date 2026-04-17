import { Router } from "express";
import Staff from "../models/Staff.js";
import Role from "../models/Role.js";
import ShiftSchedule from "../models/ShiftSchedule.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAdmin);

router.get("/summary", async (_req, res) => {
  try {
    const [staffTotal, staffActive, roleCount, shiftCount] = await Promise.all([
      Staff.countDocuments(),
      Staff.countDocuments({ active: true }),
      Role.countDocuments(),
      ShiftSchedule.countDocuments(),
    ]);
    res.json({
      staff: { total: staffTotal, active: staffActive },
      roles: roleCount,
      shifts: shiftCount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
