import { Router } from "express";
import bcrypt from "bcryptjs";
import Customer from "../models/Customer.js";
import Counter from "../models/Counter.js";
import { requireCustomer, signCustomerToken } from "../middleware/auth.js";

const router = Router();

const EMAIL_MAX = 254;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(raw) {
  const email = String(raw ?? "").trim().toLowerCase();
  if (!email) return { error: "Email is required" };
  if (email.length > EMAIL_MAX) return { error: "Email is too long" };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address" };
  return { email };
}

function validatePassword(password) {
  const p = String(password ?? "");
  if (p.length < 8) return "Password must be at least 8 characters";
  if (p.length > 128) return "Password must be at most 128 characters";
  if (!/[a-zA-Z]/.test(p)) return "Password must include at least one letter";
  if (!/[0-9]/.test(p)) return "Password must include at least one number";
  return null;
}

async function nextCustomerNumber() {
  const doc = await Counter.findOneAndUpdate(
    { _id: "customer" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
}

function customerPublic(c) {
  return {
    _id: c._id,
    customerNumber: c.customerNumber,
    email: c.email,
    createdAt: c.createdAt,
  };
}

router.post("/register", async (req, res) => {
  try {
    const ve = validateEmail(req.body?.email);
    if (ve.error) {
      return res.status(400).json({ error: ve.error });
    }
    const pwdErr = validatePassword(req.body?.password);
    if (pwdErr) {
      return res.status(400).json({ error: pwdErr });
    }
    if (String(req.body?.confirmPassword ?? "") !== String(req.body?.password ?? "")) {
      return res.status(400).json({ error: "Passwords do not match" });
    }

    const exists = await Customer.findOne({ email: ve.email });
    if (exists) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const customerNumber = await nextCustomerNumber();
    const passwordHash = await bcrypt.hash(String(req.body.password), 10);
    const customer = await Customer.create({
      email: ve.email,
      passwordHash,
      customerNumber,
    });

    const token = signCustomerToken(customer);
    res.status(201).json({
      token,
      customer: customerPublic(customer),
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }
    res.status(500).json({ error: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const ve = validateEmail(req.body?.email);
    if (ve.error) {
      return res.status(400).json({ error: ve.error });
    }
    const password = String(req.body?.password ?? "");
    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }

    const customer = await Customer.findOne({ email: ve.email });
    if (!customer || !(await bcrypt.compare(password, customer.passwordHash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    if (!customer.active) {
      return res.status(403).json({ error: "This account has been disabled. Contact the hotel." });
    }

    const token = signCustomerToken(customer);
    res.json({
      token,
      customer: customerPublic(customer),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/me", requireCustomer, async (req, res) => {
  try {
    const customer = await Customer.findById(req.customer.id).lean();
    if (!customer || !customer.active) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    res.json(customerPublic(customer));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/change-password", requireCustomer, async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword ?? "");
    const newPassword = String(req.body?.newPassword ?? "");
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password are required" });
    }
    const pwdErr = validatePassword(newPassword);
    if (pwdErr) {
      return res.status(400).json({ error: pwdErr });
    }
    if (newPassword === currentPassword) {
      return res.status(400).json({ error: "New password must be different from your current password" });
    }

    const customer = await Customer.findById(req.customer.id);
    if (!customer || !customer.active) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!(await bcrypt.compare(currentPassword, customer.passwordHash))) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    customer.passwordHash = await bcrypt.hash(newPassword, 10);
    await customer.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
