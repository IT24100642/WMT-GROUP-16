import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api, parseJson } from "../api/client.js";
import { useStaffAuth } from "../context/StaffAuthContext.jsx";
import { formatLkr } from "../lib/formatLkr.js";
import "../admin/Panel.css";
import "./ReceptionistBookings.css";

function toDatetimeLocalValue(dateOrIso) {
  const d = dateOrIso instanceof Date ? dateOrIso : new Date(dateOrIso);
  if (Number.isNaN(d.getTime())) {
    return toDatetimeLocalValue(new Date());
  }
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function DeskArrivalColumn({ booking, onPatch, busy }) {
  const cancelled = booking.status === "cancelled";
  const [inVal, setInVal] = useState(() => toDatetimeLocalValue(new Date()));
  const [outVal, setOutVal] = useState(() => toDatetimeLocalValue(new Date()));

  useEffect(() => {
    if (booking.checkedInAt) {
      setInVal(toDatetimeLocalValue(booking.checkedInAt));
    } else {
      setInVal(toDatetimeLocalValue(new Date()));
    }
  }, [booking._id, booking.checkedInAt]);

  useEffect(() => {
    if (!booking.checkedOutAt) {
      setOutVal(toDatetimeLocalValue(new Date()));
    }
  }, [booking._id, booking.checkedInAt, booking.checkedOutAt]);

  if (cancelled) {
    return <span className="receptionist-desk-muted">—</span>;
  }

  const inRecorded = Boolean(booking.checkedInAt);
  const outRecorded = Boolean(booking.checkedOutAt);
  const roomBalanceBlocksCheckout =
    Math.round(Number(booking.remainingAmount) || 0) > 0 && !booking.balancePaid;

  function submitCheckIn() {
    const t = new Date(inVal).getTime();
    if (Number.isNaN(t)) return;
    onPatch(booking._id, { checkedInAt: new Date(inVal).toISOString() });
  }

  function submitCheckOut() {
    const t = new Date(outVal).getTime();
    if (Number.isNaN(t)) return;
    onPatch(booking._id, { checkedOutAt: new Date(outVal).toISOString() });
  }

  function submitUpdateCheckIn() {
    const t = new Date(inVal).getTime();
    if (Number.isNaN(t)) return;
    onPatch(booking._id, { checkedInAt: new Date(inVal).toISOString() });
  }

  return (
    <div className="receptionist-desk">
      {!inRecorded ? (
        <>
          <label className="receptionist-desk-label" htmlFor={`desk-in-${booking._id}`}>
            Check-in time
          </label>
          <input
            id={`desk-in-${booking._id}`}
            type="datetime-local"
            className="receptionist-desk-input"
            value={inVal}
            onChange={(e) => setInVal(e.target.value)}
            disabled={busy}
          />
          <button
            type="button"
            className="receptionist-desk-btn receptionist-desk-btn--primary"
            disabled={busy}
            onClick={submitCheckIn}
          >
            Record check-in
          </button>
        </>
      ) : !outRecorded ? (
        <>
          <p className="receptionist-desk-recorded">
            <span className="receptionist-desk-kicker">Checked in</span>
            {new Date(booking.checkedInAt).toLocaleString()}
          </p>
          <label className="receptionist-desk-label" htmlFor={`desk-in-edit-${booking._id}`}>
            Adjust check-in
          </label>
          <input
            id={`desk-in-edit-${booking._id}`}
            type="datetime-local"
            className="receptionist-desk-input"
            value={inVal}
            onChange={(e) => setInVal(e.target.value)}
            disabled={busy}
          />
          <button
            type="button"
            className="receptionist-desk-btn receptionist-desk-btn--ghost"
            disabled={busy}
            onClick={submitUpdateCheckIn}
          >
            Update check-in
          </button>
          <label className="receptionist-desk-label receptionist-desk-label--spaced" htmlFor={`desk-out-${booking._id}`}>
            Check-out time
          </label>
          <input
            id={`desk-out-${booking._id}`}
            type="datetime-local"
            className="receptionist-desk-input"
            value={outVal}
            onChange={(e) => setOutVal(e.target.value)}
            disabled={busy}
          />
          <button
            type="button"
            className="receptionist-desk-btn receptionist-desk-btn--primary"
            disabled={busy}
            onClick={submitCheckOut}
          >
            Record check-out
          </button>
          <p className="receptionist-desk-checkout-hint">
            Check-out only succeeds if the room balance is clear and this guest has no open restaurant room-bill. When it
            succeeds, <strong>balance paid</strong> is set automatically and remaining goes to <strong>LKR 0</strong>.
          </p>
          {roomBalanceBlocksCheckout ? (
            <p className="receptionist-desk-warn">
              Outstanding room balance: {formatLkr(booking.remainingAmount)} — guest must pay in{" "}
              <strong>My profile</strong> or at the desk first.
            </p>
          ) : null}
        </>
      ) : (
        <>
          <p className="receptionist-desk-recorded">
            <span className="receptionist-desk-kicker">Checked in</span>
            {new Date(booking.checkedInAt).toLocaleString()}
          </p>
          <p className="receptionist-desk-recorded">
            <span className="receptionist-desk-kicker">Checked out</span>
            {new Date(booking.checkedOutAt).toLocaleString()}
          </p>
        </>
      )}
    </div>
  );
}

export default function ReceptionistBookings() {
  const { token, profile } = useStaffAuth();
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [patchingId, setPatchingId] = useState(null);

  const load = useCallback(async () => {
    setErr("");
    const res = await api("/api/staff-portal/bookings", {}, token);
    const data = await parseJson(res);
    if (!res.ok) {
      setErr(data.error || "Could not load bookings");
      setRows([]);
      return;
    }
    setRows(Array.isArray(data) ? data : []);
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function patchBooking(id, body) {
    setErr("");
    setPatchingId(id);
    try {
      const res = await api(`/api/staff-portal/bookings/${id}`, { method: "PATCH", body: JSON.stringify(body) }, token);
      const data = await parseJson(res);
      if (!res.ok) {
        setErr(data.error || "Update failed");
        return;
      }
      await load();
    } finally {
      setPatchingId(null);
    }
  }

  if (profile?.roleName !== "Receptionist") {
    return <Navigate to="/staff/dashboard" replace />;
  }

  return (
    <div className="panel-page panel-page--wide receptionist-bookings-page">
      <h1 className="panel-title">Bookings</h1>
      <p className="panel-intro">
        Guest reservations from the website. When a guest completes <strong>Book now</strong> and pays the compulsory{" "}
        <strong>LKR 5,000</strong> advance online, the booking is <strong>confirmed automatically</strong> — no desk steps
        are required. Guests can cancel from <strong>My profile</strong>; the advance is refunded minus a{" "}
        <strong>LKR 1,000</strong> service fee (demo). Use <strong>Record check-in</strong> and <strong>Record check-out</strong>{" "}
        with the actual date and time when the guest arrives and leaves. <strong>Record check-out</strong> is blocked until the
        guest&apos;s remaining room total is settled and any open restaurant room-bill items are paid; completing check-out
        then marks <strong>balance paid</strong> and clears remaining automatically.
      </p>
      {err && <p className="panel-err">{err}</p>}
      {loading && <p className="panel-muted">Loading…</p>}
      {!loading && rows.length === 0 && !err && <p className="panel-muted">No bookings yet.</p>}
      {!loading && rows.length > 0 && (
        <div className="table-wrap receptionist-bookings-table">
          <table className="data-table">
            <thead>
              <tr>
                <th>Guest</th>
                <th>Stay</th>
                <th>Summary</th>
                <th>Total</th>
                <th>Advance</th>
                <th>Remaining</th>
                <th>Advance paid</th>
                <th>Balance paid</th>
                <th>Arrival &amp; departure</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const specialTrimmed = typeof b.specialRequests === "string" ? b.specialRequests.trim() : "";
                return (
                  <tr key={b._id}>
                    <td>
                      <div>{b.fullName}</div>
                      <div className="receptionist-bookings-meta">{b.contactEmail}</div>
                      <div className="receptionist-bookings-meta">
                        Guest #{b.customer?.customerNumber ?? "—"} · {b.phone}
                      </div>
                      {b.mealsAddLater && (
                        <div className="receptionist-bookings-meta receptionist-bookings-meals">
                          Meals: will add or decide later
                        </div>
                      )}
                      {!b.mealsAddLater &&
                        (b.mealIntentRequired || b.mealIntentOtherOptions || b.mealIntentUnsure) && (
                          <div className="receptionist-bookings-meta receptionist-bookings-meals">
                            Meals note:{" "}
                            {[
                              b.mealIntentRequired && "Meals required",
                              b.mealIntentOtherOptions && "Other options",
                              b.mealIntentUnsure && "Still not sure",
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        )}
                    </td>
                    <td>
                      {b.checkIn && b.checkOut ? (
                        <>
                          {new Date(b.checkIn).toLocaleDateString()} → {new Date(b.checkOut).toLocaleDateString()}
                          <div className="receptionist-bookings-meta">{b.nights} night(s)</div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <div className="receptionist-bookings-summary-line">{b.summaryLine || "—"}</div>
                      {specialTrimmed ? (
                        <div className="receptionist-bookings-special">
                          <span className="receptionist-bookings-special-label">Special requests</span>
                          <p className="receptionist-bookings-special-text">{specialTrimmed}</p>
                        </div>
                      ) : null}
                    </td>
                    <td>{formatLkr(b.totalAmount)}</td>
                    <td>{formatLkr(b.advanceAmount)}</td>
                    <td>{b.status === "cancelled" ? "—" : formatLkr(b.remainingAmount)}</td>
                    <td>{b.advancePaid ? "Yes" : "No"}</td>
                    <td>{b.balancePaid ? "Yes" : "No"}</td>
                    <td className="receptionist-bookings-desk-cell">
                      <DeskArrivalColumn booking={b} onPatch={patchBooking} busy={patchingId === b._id} />
                    </td>
                    <td>
                      <span className={`recv-booking-status recv-booking-status--${b.status}`}>{b.status}</span>
                      {b.status === "cancelled" && b.cancelledAt ? (
                        <div className="receptionist-bookings-meta receptionist-bookings-cancel-meta">
                          <div>
                            Cancelled {new Date(b.cancelledAt).toLocaleString()}
                            {(Number(b.cancellationRefundLkr) || 0) > 0 && (
                              <span>
                                {" "}
                                · Refund {formatLkr(b.cancellationRefundLkr)} (fee {formatLkr(b.cancellationFeeLkr)})
                              </span>
                            )}
                          </div>
                          {typeof b.cancellationReason === "string" && b.cancellationReason.trim() ? (
                            <p className="receptionist-bookings-cancel-reason">
                              <span className="receptionist-bookings-cancel-reason-label">Guest reason</span>
                              {b.cancellationReason.trim()}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
