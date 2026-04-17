import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api, parseJson } from "../api/client.js";
import { processAdvancePayment } from "../lib/advancePayment.js";
import { formatLkr } from "../lib/formatLkr.js";
import "./PayAdvanceModal.css";

function bookingRoomLabel(b) {
  if (b.room && typeof b.room === "object" && b.room.roomNumber != null) {
    const v = b.room.variant ? ` (${b.room.variant})` : "";
    return `Room ${b.room.roomNumber}${v}`;
  }
  if (b.offer && typeof b.offer === "object" && b.offer.title) return b.offer.title;
  const s = String(b.summaryLine || "").replace(/\s*·\s*\d+\s*night.*/i, "").trim();
  return s || "Stay";
}

function formatStayRange(b) {
  if (!b.checkIn || !b.checkOut) return "—";
  const a = new Date(b.checkIn).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  const c = new Date(b.checkOut).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  const n = b.nights ?? 1;
  return `${a} → ${c} (${n} night${n === 1 ? "" : "s"})`;
}

function invoiceRef(bookingId) {
  const id = String(bookingId || "").replace(/\W/g, "");
  const tail = id.slice(-8).toUpperCase() || "00000000";
  return `INV-${tail}`;
}

const METHODS = [
  { id: "cash", label: "Cash", icon: "cash" },
  { id: "card", label: "Card", icon: "card" },
  { id: "online", label: "Online", icon: "online" },
];

function MethodIcon({ name }) {
  if (name === "cash") {
    return (
      <svg className="pay-advance-modal__method-icon" viewBox="0 0 24 24" aria-hidden>
        <rect x="3" y="6" width="18" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 10h18" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  if (name === "card") {
    return (
      <svg className="pay-advance-modal__method-icon" viewBox="0 0 24 24" aria-hidden>
        <rect x="2" y="5" width="20" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <rect x="2" y="9" width="20" height="3" fill="currentColor" opacity="0.35" />
      </svg>
    );
  }
  return (
    <svg className="pay-advance-modal__method-icon" viewBox="0 0 24 24" aria-hidden>
      <rect x="4" y="4" width="7" height="7" rx="1" fill="currentColor" opacity="0.5" />
      <rect x="13" y="4" width="7" height="7" rx="1" fill="currentColor" opacity="0.35" />
      <rect x="4" y="13" width="7" height="7" rx="1" fill="currentColor" opacity="0.35" />
      <rect x="13" y="13" width="7" height="7" rx="1" fill="currentColor" opacity="0.25" />
    </svg>
  );
}

export default function PayAdvanceModal({ booking, token, onClose, onPaid }) {
  const [method, setMethod] = useState("card");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const roomSub = Math.round(Number(booking.roomSubtotal) || 0);
  const mealSub = Math.round(Number(booking.mealSubtotal) || 0);
  const taxAmt = Math.round(Number(booking.taxAmount) || 0);
  const totalBooking = Math.round(Number(booking.totalAmount) || 0);
  const advance = Math.round(Number(booking.advanceAmount) || 0);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape" && !submitting) onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submitting, onClose]);

  async function handlePay() {
    setError("");
    setSubmitting(true);
    try {
      await processAdvancePayment(advance, { method });
      const res = await api(`/api/customer-auth/bookings/${booking._id}/advance-payment`, { method: "POST" }, token);
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data.error || "Could not record advance payment");
      onPaid?.();
      onClose?.();
    } catch (err) {
      setError(err.message || "Payment failed");
    } finally {
      setSubmitting(false);
    }
  }

  const overlay = (
    <div
      className="pay-advance-modal-overlay"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && !submitting && onClose?.()}
    >
      <div className="pay-advance-modal" role="dialog" aria-labelledby="pay-advance-modal-title" aria-modal="true">
        <div className="pay-advance-modal__head">
          <div>
            <h2 id="pay-advance-modal-title" className="pay-advance-modal__title">
              Process Payment
            </h2>
            <p className="pay-advance-modal__subtitle">
              {invoiceRef(booking._id)} · {booking.fullName || "Guest"}
            </p>
          </div>
          <button type="button" className="pay-advance-modal__close" onClick={() => !submitting && onClose?.()} aria-label="Close">
            ×
          </button>
        </div>

        <div className="pay-advance-modal__summary">
          <div className="pay-advance-modal__summary-block">
            <div className="pay-advance-modal__summary-main">
              <div>
                <div className="pay-advance-modal__summary-room">{bookingRoomLabel(booking)}</div>
                <div className="pay-advance-modal__summary-dates">{formatStayRange(booking)}</div>
              </div>
              <span className="pay-advance-modal__summary-amt">{formatLkr(roomSub)}</span>
            </div>
            {mealSub > 0 && (
              <div className="pay-advance-modal__summary-row">
                <span>Meal packages</span>
                <span>{formatLkr(mealSub)}</span>
              </div>
            )}
            <div className="pay-advance-modal__summary-row">
              <span>Tax (12%)</span>
              <span>{formatLkr(taxAmt)}</span>
            </div>
            <div className="pay-advance-modal__summary-row pay-advance-modal__summary-row--muted">
              <span>Booking total</span>
              <span>{formatLkr(totalBooking)}</span>
            </div>
          </div>

          <div className="pay-advance-modal__summary-total">
            <span>Advance due</span>
            <strong>{formatLkr(advance)}</strong>
          </div>
        </div>

        <p className="pay-advance-modal__methods-label">Select payment method</p>
        <div className="pay-advance-modal__methods" role="group" aria-label="Payment method">
          {METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`pay-advance-modal__method${method === m.id ? " pay-advance-modal__method--active" : ""}`}
              onClick={() => setMethod(m.id)}
              disabled={submitting}
            >
              <MethodIcon name={m.icon} />
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        {error && <p className="pay-advance-modal__error">{error}</p>}

        <button type="button" className="pay-advance-modal__pay" disabled={submitting} onClick={handlePay}>
          {submitting ? "Processing…" : `Pay ${formatLkr(advance)}`}
        </button>
      </div>
    </div>
  );

  if (typeof document === "undefined" || !document.body) return null;
  return createPortal(overlay, document.body);
}
