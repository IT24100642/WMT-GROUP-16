import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import "./PortalLogin.css";

export default function AdminLogin() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username.trim(), password);
      navigate("/admin/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="portal-login-page">
      <div className="portal-login-card">
        <h1>Admin sign in</h1>
        <p className="portal-login-hint">Full hotel operations — default <code>admin</code> / <code>admin123</code></p>
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
          <Link to="/staff/login">Staff login</Link>
          <Link to="/">← Public site</Link>
        </div>
      </div>
    </div>
  );
}
