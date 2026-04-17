import { Router } from "express";
import mongoose from "mongoose";
import Customer from "../models/Customer.js";
import IssueReport, { ISSUE_STATUSES } from "../models/IssueReport.js";
import { requireCustomerManager } from "../middleware/auth.js";

const router = Router();

router.get("/customers", requireCustomerManager, async (_req, res) => {
  try {
    const list = await Customer.find().select("-passwordHash").sort({ customerNumber: 1 }).lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/customers/:id", requireCustomerManager, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    if (req.body?.active !== undefined) {
      customer.active = Boolean(req.body.active);
    }
    await customer.save();
    const lean = await Customer.findById(customer._id).select("-passwordHash").lean();
    res.json(lean);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/issues", requireCustomerManager, async (_req, res) => {
  try {
    const list = await IssueReport.find()
      .sort({ createdAt: -1 })
      .populate("customer", "email customerNumber")
      .populate("room", "roomNumber")
      .populate("assignedStaff", "name username")
      .lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/issues/:id", requireCustomerManager, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Invalid id" });
    const issue = await IssueReport.findById(id);
    if (!issue) return res.status(404).json({ error: "Issue not found" });
    const status = String(req.body?.status || "").trim();
    if (!ISSUE_STATUSES.includes(status)) return res.status(400).json({ error: "Invalid status" });
    issue.status = status;
    if (status === "resolved") issue.resolvedAt = new Date();
    if (status !== "resolved") issue.resolvedAt = null;
    await issue.save();
    const populated = await IssueReport.findById(issue._id)
      .populate("customer", "email customerNumber")
      .populate("room", "roomNumber")
      .populate("assignedStaff", "name username")
      .lean();
    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
