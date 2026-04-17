import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useStaffAuth } from "../context/StaffAuthContext.jsx";
import "./PortalLogin.css";

export default function StaffLogin() {
  const { login, isAuthenticated } = useStaffAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/staff/dashboard" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username.trim(), password);
      navigate("/staff/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="portal-login-page">
      <div className="portal-login-card">
        <h1>Staff sign in</h1>
        <form onSubmit={handleSubmit}>
          <label className="portal-login-label">
            Username
            <input
              className="portal-login-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="portal-login-label">
            Password
            <input
              className="portal-login-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && <p className="portal-login-error">{error}</p>}
          <button type="submit" className="portal-login-submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <div className="portal-login-links">
          <Link to="/admin/login">Admin sign in</Link>
          <Link to="/">← Public site</Link>
        </div>
      </div>
    </div>
  );
}
