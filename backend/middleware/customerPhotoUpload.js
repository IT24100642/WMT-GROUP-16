import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import multer from "multer";

const UPLOAD_SUBDIR = path.join("uploads", "customers");
const MAX_BYTES = 5 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const dir = path.join(process.cwd(), UPLOAD_SUBDIR);
    await fs.mkdir(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext) ? ext : ".jpg";
    const id = String(req.customer?.id || "guest");
    const name = `${id}-${Date.now()}-${crypto.randomBytes(6).toString("hex")}${safeExt}`;
    cb(null, name);
  },
});

function fileFilter(_req, file, cb) {
  if (/^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, WebP, and GIF images are allowed"));
  }
}

export const uploadCustomerPhoto = multer({
  storage,
  limits: { fileSize: MAX_BYTES },
  fileFilter,
});

export function publicUrlForCustomerFilename(filename) {
  return `/uploads/customers/${filename}`;
}

