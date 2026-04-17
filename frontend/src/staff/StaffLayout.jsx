import { useState } from "react";
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useStaffAuth } from "../context/StaffAuthContext.jsx";
import StaffChangePasswordModal from "./StaffChangePasswordModal.jsx";
import "./StaffLayout.css";

export default function StaffLayout() {
  const { isAuthenticated, logout, profile } = useStaffAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  if (!isAuthenticated) {
    return <Navigate to="/staff/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <div className="staff-shell">
      <header className="staff-topbar">
        <div>
          <div className="staff-brand">Maison Velour</div>
          {profile && (
            <p className="staff-greeting">
              {profile.name}
              {profile.roleName ? ` · ${profile.roleName}` : ""}
            </p>
          )}
        </div>
        <div className="staff-top-actions">
          <NavLink
            to="/staff/dashboard"
            className={({ isActive }) => "staff-nav-link" + (isActive ? " staff-nav-link--active" : "")}
            end
          >
            Dashboard
          </NavLink>
          {profile?.roleName === "Room Manager" && (
            <NavLink
              to="/staff/rooms"
              className={({ isActive }) => "staff-nav-link" + (isActive ? " staff-nav-link--active" : "")}
            >
              Room management
            </NavLink>
          )}
          {profile?.roleName === "Customer Manager" && (
            <NavLink
              to="/staff/customers"
              className={({ isActive }) => "staff-nav-link" + (isActive ? " staff-nav-link--active" : "")}
            >
              Customers
            </NavLink>
          )}
          {profile?.roleName === "Receptionist" && (
            <NavLink
              to="/staff/bookings"
              className={({ isActive }) => "staff-nav-link" + (isActive ? " staff-nav-link--active" : "")}
            >
              Bookings
            </NavLink>
          )}
          {profile?.roleName === "Kitchen Manager" && (
            <NavLink
              to="/staff/kitchen"
              className={({ isActive }) => "staff-nav-link" + (isActive ? " staff-nav-link--active" : "")}
            >
              Kitchen &amp; menu
            </NavLink>
          )}
          {profile?.roleName === "Review Manager" && (
            <NavLink
              to="/staff/reviews"
              className={({ isActive }) => "staff-nav-link" + (isActive ? " staff-nav-link--active" : "")}
            >
              Reviews
            </NavLink>
          )}
          <button type="button" className="staff-link" onClick={() => navigate("/")}>
            Public site
          </button>
          <button type="button" className="staff-link" onClick={() => setPasswordModalOpen(true)}>
            Change password
          </button>
          <button
            type="button"
            className="staff-logout"
            onClick={() => {
              logout();
              navigate("/staff/login");
            }}
          >
            Log out
          </button>
        </div>
      </header>
      <main
        className={`staff-main${
          location.pathname.startsWith("/staff/rooms") ||
          location.pathname.startsWith("/staff/customers") ||
          location.pathname.startsWith("/staff/bookings") ||
          location.pathname.startsWith("/staff/kitchen") ||
          location.pathname.startsWith("/staff/reviews")
            ? " staff-main--wide"
            : ""
        }`}
      >
        <Outlet />
      </main>
      {passwordModalOpen ? <StaffChangePasswordModal onClose={() => setPasswordModalOpen(false)} /> : null}
    </div>
  );
}
