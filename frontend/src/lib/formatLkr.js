/** Display amounts in Sri Lankan Rupees (LKR). */
export function formatLkr(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) {
    return new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency: "LKR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(0);
  }
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}
