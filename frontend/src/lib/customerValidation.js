const EMAIL_MAX = 254;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCustomerEmail(raw) {
  const email = String(raw ?? "").trim().toLowerCase();
  if (!email) return { error: "Email is required" };
  if (email.length > EMAIL_MAX) return { error: "Email is too long" };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address" };
  return { email };
}

/** Local mobile-style number: exactly 10 digits, numeric only (no country code in the field). */
export function validateCustomerPhone(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return { error: "Phone is required" };
  if (digits.length !== 10) return { error: "Phone must be exactly 10 digits" };
  return { phone: digits };
}

export function validateCustomerPassword(password) {
  const p = String(password ?? "");
  if (p.length < 8) return "Password must be at least 8 characters";
  if (p.length > 128) return "Password must be at most 128 characters";
  if (!/[a-zA-Z]/.test(p)) return "Password must include at least one letter";
  if (!/[0-9]/.test(p)) return "Password must include at least one number";
  return null;
}

export function safeReturnTo(searchParams) {
  const raw = searchParams.get("returnTo");
  if (!raw) return "/";
  let path = raw;
  try {
    path = decodeURIComponent(raw);
  } catch {
    return "/";
  }
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  return path;
}
