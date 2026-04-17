import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import "./AdminLayout.css";

export default function AdminLayout() {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">Maison Velour</div>
        <p className="admin-sidebar-label">Administrator</p>
        <nav className="admin-nav">
          <NavLink to="/admin/dashboard" className={({ isActive }) => (isActive ? "active" : "")}>
            Dashboard
          </NavLink>
          <NavLink to="/admin/operations" className={({ isActive }) => (isActive ? "active" : "")}>
            Staff &amp; shifts
          </NavLink>
        </nav>
        <div className="admin-sidebar-foot">
          <button
            type="button"
            className="admin-link-btn"
            onClick={() => navigate("/admin/dashboard?openPassword=1")}
          >
            Change password
          </button>
          <button type="button" className="admin-link-btn" onClick={() => navigate("/")}>
            ← Public site
          </button>
          <button
            type="button"
            className="admin-logout"
            onClick={() => {
              logout();
              navigate("/admin/login");
            }}
          >
            Log out
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
