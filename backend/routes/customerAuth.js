/**
 * Guest (customer) registration & JWT auth — mounted at /api/customer-auth
 *
 * Registration & login (public — no Bearer token):
 *   POST /register — validates body; bcrypt.hash(password, 10); Customer.create / reactivate; returns JWT via signCustomerToken
 *   POST /login — bcrypt.compare(password, passwordHash); returns JWT + customerPublic payload
 *
 * Protected routes (Authorization: Bearer <token>; requireCustomer middleware):
 *   GET/PATCH /me, POST /me/photo, POST /delete-account, POST /change-password
 *
 * Other guest APIs using the same JWT (mounted under /api/customer-auth in index.js):
 *   routes/customerBookings.js (requireCustomer)
 *   routes/customerFoodOrders.js (requireCustomer)
 *   routes/customerReviews.js (requireCustomer)
 *   routes/customerIssues.js (requireCustomer)
 */

import { Router } from "express";
import bcrypt from "bcryptjs";
import Customer from "../models/Customer.js";
import Counter from "../models/Counter.js";
import { requireCustomer, signCustomerToken } from "../middleware/auth.js";
import { getCustomerAccountBlockers } from "../lib/customerAccountBlockers.js";
import { uploadCustomerPhoto, publicUrlForCustomerFilename } from "../middleware/customerPhotoUpload.js";
import { unlinkPublicUpload } from "../middleware/roomPhotoUpload.js";
import { serverError } from "../lib/respond.js";

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

function validateName(raw) {
  const name = String(raw ?? "").trim();
  if (!name) return { error: "Name is required" };
  if (name.length < 2) return { error: "Name must be at least 2 characters" };
  if (name.length > 120) return { error: "Name is too long" };
  return { name };
}

function normalizePhoneDigits(raw) {
  let phone = String(raw ?? "").replace(/\D/g, "");
  // Sri Lanka mobiles are often typed as 9 digits without the leading 0 (e.g. 711012465).
  if (phone.length === 9 && /^7\d{8}$/.test(phone)) {
    phone = `0${phone}`;
  }
  return phone;
}

function validatePhone(raw) {
  const phone = normalizePhoneDigits(raw);
  if (!phone) return { error: "Phone is required" };
  if (phone.length !== 10) {
    return {
      error: "Phone must be 10 digits including leading 0 (e.g. 0712345678)",
    };
  }
  return { phone };
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
    name: c.name,
    phone: c.phone,
    email: c.email,
    profileFirstName: c.profileFirstName || "",
    profileLastName: c.profileLastName || "",
    profileMobile: c.profileMobile || "",
    profileServiceUrl: c.profileServiceUrl || "",
    profilePhotoUrl: c.profilePhotoUrl || "",
    preferredRoomType: c.preferredRoomType || "",
    preferredFood: c.preferredFood || "",
    loyaltyPoints: Number(c.loyaltyPoints) || 0,
    createdAt: c.createdAt,
  };
}

router.post("/register", async (req, res) => {
  try {
    const vn = validateName(req.body?.name);
    if (vn.error) {
      return res.status(400).json({ error: vn.error });
    }
    const vp = validatePhone(req.body?.phone);
    if (vp.error) {
      return res.status(400).json({ error: vp.error });
    }
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
    if (exists?.active) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(String(req.body.password), 10);

    if (exists && !exists.active) {
      exists.name = vn.name;
      exists.phone = vp.phone;
      exists.passwordHash = passwordHash;
      exists.active = true;
      exists.deletedAt = null;
      exists.deletedReason = "";
      await exists.save();
      const token = signCustomerToken(exists);
      return res.status(201).json({
        token,
        customer: customerPublic(exists),
      });
    }

    const customerNumber = await nextCustomerNumber();
    const customer = await Customer.create({
      name: vn.name,
      phone: vp.phone,
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
    serverError(res, err);
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
    serverError(res, err);
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
    serverError(res, err);
  }
});

router.patch("/me", requireCustomer, async (req, res) => {
  try {
    const customer = await Customer.findById(req.customer.id);
    if (!customer || !customer.active) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (req.body?.name !== undefined) {
      const vn = validateName(req.body?.name);
      if (vn.error) return res.status(400).json({ error: vn.error });
      customer.name = vn.name;
    }
    if (req.body?.phone !== undefined) {
      const vp = validatePhone(req.body?.phone);
      if (vp.error) return res.status(400).json({ error: vp.error });
      customer.phone = vp.phone;
    }
    if (req.body?.email !== undefined) {
      const ve = validateEmail(req.body?.email);
      if (ve.error) return res.status(400).json({ error: ve.error });

      // Prevent email collisions for other active customers.
      const exists = await Customer.findOne({ email: ve.email, _id: { $ne: customer._id } }).lean();
      if (exists) {
        return res.status(409).json({ error: "An account with this email already exists" });
      }
      customer.email = ve.email;
    }

    if (req.body?.profileFirstName !== undefined) {
      customer.profileFirstName = String(req.body.profileFirstName ?? "").trim().slice(0, 80);
    }
    if (req.body?.profileLastName !== undefined) {
      customer.profileLastName = String(req.body.profileLastName ?? "").trim().slice(0, 80);
    }
    if (req.body?.profileMobile !== undefined) {
      customer.profileMobile = String(req.body.profileMobile ?? "").trim().slice(0, 30);
    }
    if (req.body?.profileServiceUrl !== undefined) {
      customer.profileServiceUrl = String(req.body.profileServiceUrl ?? "").trim().slice(0, 500);
    }
    if (req.body?.preferredRoomType !== undefined) {
      customer.preferredRoomType = String(req.body.preferredRoomType ?? "").trim().slice(0, 80);
    }
    if (req.body?.preferredFood !== undefined) {
      customer.preferredFood = String(req.body.preferredFood ?? "").trim().slice(0, 120);
    }

    await customer.save();
    res.json(customerPublic(customer));
  } catch (err) {
    serverError(res, err);
  }
});

router.post("/me/photo", requireCustomer, uploadCustomerPhoto.single("photo"), async (req, res) => {
  try {
    const customer = await Customer.findById(req.customer.id);
    if (!customer || !customer.active) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const filename = req.file?.filename;
    if (!filename) {
      return res.status(400).json({ error: "Photo file is required" });
    }
    const nextUrl = publicUrlForCustomerFilename(filename);
    const prevUrl = customer.profilePhotoUrl;
    customer.profilePhotoUrl = nextUrl;
    await customer.save();
    if (prevUrl && prevUrl !== nextUrl) {
      await unlinkPublicUpload(prevUrl);
    }
    res.json({ ok: true, profilePhotoUrl: nextUrl, customer: customerPublic(customer) });
  } catch (err) {
    serverError(res, err);
  }
});

router.post("/delete-account", requireCustomer, async (req, res) => {
  try {
    const customer = await Customer.findById(req.customer.id);
    if (!customer || !customer.active) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const gate = await getCustomerAccountBlockers(customer._id);
    if (!gate.ok) {
      return res.status(409).json({
        error: "Account cannot be deleted until all balances are settled and any checked-in stay is checked out.",
        reasons: gate.reasons,
      });
    }

    customer.active = false;
    customer.deletedAt = new Date();
    customer.deletedReason = "guest_request";
    await customer.save();
    res.json({ ok: true });
  } catch (err) {
    serverError(res, err);
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
    serverError(res, err);
  }
});

export default router;
