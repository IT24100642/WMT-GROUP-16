import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, parseJson } from "../api/client.js";
import { useStaffAuth } from "../context/StaffAuthContext.jsx";
import "../admin/Panel.css";

export default function StaffDashboard() {
  const { token, profile } = useStaffAuth();
  const [shifts, setShifts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loadErr, setLoadErr] = useState("");

  const loadShifts = useCallback(async () => {
    setLoadErr("");
    const res = await api("/api/staff-portal/my-shifts", {}, token);
    const data = await parseJson(res);
    if (!res.ok) {
      setLoadErr(data.error || "Could not load shifts");
      return;
    }
    setShifts(data);
  }, [token]);

  const loadNotifications = useCallback(async () => {
    if (!token) return;
    const res = await api("/api/staff-portal/notifications", {}, token);
    const data = await parseJson(res);
    if (res.ok) setNotifications(Array.isArray(data) ? data : []);
  }, [token]);

  useEffect(() => {
    loadShifts();
    loadNotifications();
  }, [loadShifts, loadNotifications]);

  const nextShift = shifts
    .filter((shift) => new Date(shift.startAt) > Date.now())
    .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))[0];

  const roleName = profile?.roleName || "Staff";
  const isReceptionist = roleName === "Receptionist";
  const isCustomerManager = roleName === "Customer Manager";
  const isRoomManager = roleName === "Room Manager";
  const isKitchenManager = roleName === "Kitchen Manager";
  const isReviewManager = roleName === "Review Manager";

  const heroBadge = roleName;
  const heroTitle = `Welcome back, ${profile?.firstName || profile?.name || roleName}`;
  const heroCopy = isReceptionist
    ? "Manage guest arrivals, check reservations, and keep front desk operations running smoothly."
    : isCustomerManager
    ? "Review guest accounts, verify access, and manage customer profiles efficiently."
    : isRoomManager
    ? "Stay on top of room inventory, maintenance, and housekeeping so every guest arrival is seamless."
    : isReviewManager
    ? "Monitor guest feedback, keep review workflows organized, and help every stay become a five-star experience."
    : "Keep your kitchen flow smooth with the latest shift updates, quick menu access, and guest order tools all in one place.";
  const heroLink = isReceptionist
    ? "/staff/bookings"
    : isCustomerManager
    ? "/staff/customers"
    : isRoomManager
    ? "/staff/rooms"
    : isReviewManager
    ? "/staff/reviews"
    : "/staff/kitchen";
  const heroAction = isReceptionist
    ? "Open bookings"
    : isCustomerManager
    ? "Open guest customers"
    : isRoomManager
    ? "Open room management"
    : isReviewManager
    ? "Open public site"
    : "Open kitchen & menu";
  const statusLabel = isReceptionist
    ? "Reception status"
    : isCustomerManager
    ? "Customer status"
    : isRoomManager
    ? "Room status"
    : isReviewManager
    ? "Review status"
    : "Kitchen status";
  const statusDetail = isReceptionist
    ? "Your front desk is ready for arrivals and guest service."
    : isCustomerManager
    ? "Guest customer operations are available once shifts are assigned."
    : isRoomManager
    ? "Room operations stay aligned with maintenance and housekeeping schedules."
    : isReviewManager
    ? "Guest feedback is waiting to be reviewed and actioned."
    : "Your kitchen team is ready for the next service.";

  return (
    <div className="panel-page">
      <section className="dashboard-hero">
        <div>
          <span className="hero-badge">{heroBadge}</span>
          <h1 className="panel-title">{heroTitle}</h1>
          <p className="hero-copy">{heroCopy}</p>
        </div>
        <div className="hero-actions">
          <Link className="hero-button" to={heroLink}>
            {heroAction}
          </Link>
        </div>
      </section>

      <div className="dash-grid">
        <div className="dash-card">
          <strong>{shifts.length}</strong>
          <span>Total shifts assigned</span>
          <small>All shifts shown here are updated from your staff schedule.</small>
        </div>
        <div className="dash-card">
          <strong>{nextShift ? new Date(nextShift.startAt).toLocaleDateString([], { dateStyle: "medium" }) : "No upcoming shift"}</strong>
          <span>Next shift</span>
          <small>{nextShift ? `${new Date(nextShift.startAt).toLocaleTimeString([], { timeStyle: "short" })} — ${nextShift.label || "Shift"}` : "Await schedule from your manager."}</small>
        </div>
        <div className="dash-card">
          <strong>{shifts.length > 0 ? "Ready" : "Waiting"}</strong>
          <span>{statusLabel}</span>
          <small>{statusDetail}</small>
        </div>
      </div>

      <p className="panel-intro">
        Shifts assigned to you by an administrator appear below. Only your own schedule is shown here.
      </p>
      {profile?.roleName === "Room Manager" && (
        <p className="panel-intro">
          <Link to="/staff/rooms" style={{ color: "var(--mv-gold)" }}>
            Open room management
          </Link>{" "}
          to manage room availability, maintenance updates, housekeeping readiness, and guest-ready inventory.
        </p>
      )}
      {profile?.roleName === "Customer Manager" && (
        <p className="panel-intro">
          <Link to="/staff/customers" style={{ color: "var(--mv-gold)" }}>
            Open guest customers
          </Link>{" "}
          to view public guest accounts, guest IDs, and enable or disable access.
        </p>
      )}
      {profile?.roleName === "Receptionist" && (
        <p className="panel-intro">
          <Link to="/staff/bookings" style={{ color: "var(--mv-gold)" }}>
            Open bookings
          </Link>{" "}
          to view guest reservations, advances (LKR 5,000), remaining balances, and payment status.
        </p>
      )}
      {profile?.roleName === "Review Manager" && (
        <p className="panel-intro">
          <Link to="/staff/reviews" style={{ color: "var(--mv-gold)" }}>
            Open review management
          </Link>{" "}
          to moderate guest feedback, inspect sentiment insights, and monitor quality trends.
        </p>
      )}
      {profile?.roleName === "Kitchen Manager" && (
        <p className="panel-intro">
          <Link to="/staff/kitchen" style={{ color: "var(--mv-gold)" }}>
            Open kitchen &amp; menu
          </Link>{" "}
          to manage food items and guest food orders from the restaurant page.
        </p>
      )}

      <h2 className="panel-subtitle">My shifts</h2>
      {loadErr && <p className="panel-err">{loadErr}</p>}
      {!loadErr && shifts.length === 0 && (
        <p className="panel-muted">No shifts scheduled yet. Your manager will add them from the admin portal.</p>
      )}
      {shifts.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Start</th>
                <th>End</th>
                <th>Label</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s) => (
                <tr key={s._id}>
                  <td>{new Date(s.startAt).toLocaleString()}</td>
                  <td>{new Date(s.endAt).toLocaleString()}</td>
                  <td>{s.label || "—"}</td>
                  <td>{s.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="panel-subtitle">My notifications</h2>
      {notifications.length === 0 ? (
        <p className="panel-muted">No notifications right now.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Title</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {notifications.slice(0, 8).map((n) => (
                <tr key={n._id}>
                  <td>{new Date(n.createdAt).toLocaleString()}</td>
                  <td>{n.title}</td>
                  <td>{n.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
