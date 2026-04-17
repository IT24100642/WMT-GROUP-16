/**
 * Advance payment handler. Replace the body with a real gateway (e.g. Stripe)
 * when you connect production payments.
 */
export function processAdvancePayment(amountLkr, options = {}) {
  const amount = Number(amountLkr);
  if (!Number.isFinite(amount) || amount <= 0) {
    return Promise.reject(new Error("Invalid advance amount"));
  }
  const method = options.method || "card";
  return new Promise((resolve) => {
    window.setTimeout(() => {
      resolve({
        ok: true,
        amountLkr: amount,
        method,
        reference: `ADV-${Date.now().toString(36).toUpperCase()}`,
      });
    }, 450);
  });
}
