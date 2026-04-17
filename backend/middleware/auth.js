import jwt from "jsonwebtoken";
import Staff from "../models/Staff.js";
import Customer from "../models/Customer.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-change-in-production";

export function signAdminToken(admin) {
  return jwt.sign(
    { sub: String(admin._id), username: admin.username, type: "admin" },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export function signCustomerToken(customer) {
  return jwt.sign(
    {
      sub: String(customer._id),
      type: "customer",
      email: customer.email,
      customerNumber: customer.customerNumber,
    },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
}

export function signStaffToken(staff) {
  const roleName =
    staff.role && typeof staff.role === "object" && staff.role.name ? staff.role.name : "";
  return jwt.sign(
    {
      sub: String(staff._id),
      username: staff.username,
      type: "staff",
      name: staff.name,
      roleName,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function parseBearer(req) {
  const header = req.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

export function requireAdmin(req, res, next) {
  const token = parseBearer(req);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.type !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    req.admin = { id: payload.sub, username: payload.username };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireStaff(req, res, next) {
  const token = parseBearer(req);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.type !== "staff") {
      return res.status(403).json({ error: "Staff access required" });
    }
    req.staffAuth = { id: payload.sub, username: payload.username, name: payload.name };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/** Guest JWT + active Customer account */
export async function requireCustomer(req, res, next) {
  const token = parseBearer(req);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.type !== "customer") {
      return res.status(403).json({ error: "Guest sign-in required" });
    }
    const customer = await Customer.findById(payload.sub).lean();
    if (!customer || !customer.active) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.customer = {
      id: String(customer._id),
      email: customer.email,
      customerNumber: customer.customerNumber,
    };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/** Staff JWT + Role name must be exactly "Customer Manager" */
export async function requireCustomerManager(req, res, next) {
  const token = parseBearer(req);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.type !== "staff") {
      return res.status(403).json({ error: "Staff access required" });
    }
    const staff = await Staff.findById(payload.sub).populate("role");
    if (!staff || !staff.active) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (staff.role?.name !== "Customer Manager") {
      return res.status(403).json({ error: "Customer Manager access required" });
    }
    req.staffAuth = { id: String(staff._id), username: staff.username, name: staff.name };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/** Staff JWT + Role name must be exactly "Kitchen Manager" */
export async function requireKitchenManager(req, res, next) {
  const token = parseBearer(req);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.type !== "staff") {
      return res.status(403).json({ error: "Staff access required" });
    }
    const staff = await Staff.findById(payload.sub).populate("role");
    if (!staff || !staff.active) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (staff.role?.name !== "Kitchen Manager") {
      return res.status(403).json({ error: "Kitchen Manager access required" });
    }
    req.staffAuth = { id: String(staff._id), username: staff.username, name: staff.name };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/** Staff JWT + Role name must be exactly "Receptionist" */
export async function requireReceptionist(req, res, next) {
  const token = parseBearer(req);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.type !== "staff") {
      return res.status(403).json({ error: "Staff access required" });
    }
    const staff = await Staff.findById(payload.sub).populate("role");
    if (!staff || !staff.active) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (staff.role?.name !== "Receptionist") {
      return res.status(403).json({ error: "Receptionist access required" });
    }
    req.staffAuth = { id: String(staff._id), username: staff.username, name: staff.name };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export async function requireRoomManager(req, res, next) {
  const token = parseBearer(req);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.type !== "staff") {
      return res.status(403).json({ error: "Staff access required" });
    }
    const staff = await Staff.findById(payload.sub).populate("role");
    if (!staff || !staff.active) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (staff.role?.name !== "Room Manager") {
      return res.status(403).json({ error: "Room Manager access required" });
    }
    req.staffAuth = { id: String(staff._id), username: staff.username, name: staff.name };
    req.roomManagerStaff = staff;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/** Staff JWT + Role name must be exactly "Review Manager" */
export async function requireReviewManager(req, res, next) {
  const token = parseBearer(req);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.type !== "staff") {
      return res.status(403).json({ error: "Staff access required" });
    }
    const staff = await Staff.findById(payload.sub).populate("role");
    if (!staff || !staff.active) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (staff.role?.name !== "Review Manager") {
      return res.status(403).json({ error: "Review Manager access required" });
    }
    req.staffAuth = { id: String(staff._id), username: staff.username, name: staff.name };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export { JWT_SECRET };
