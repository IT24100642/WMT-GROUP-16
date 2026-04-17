import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useCustomerAuth } from "../context/CustomerAuthContext.jsx";
import { safeReturnTo } from "../lib/customerValidation.js";
import "./PortalLogin.css";

export default function CustomerLogin() {
  const { login, isAuthenticated, ready } = useCustomerAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const returnTo = safeReturnTo(searchParams);

  if (!ready) {
    return (
      <div className="portal-login-page">
        <div className="portal-login-card">
          <p className="portal-login-hint" style={{ margin: 0 }}>
            Loading…
          </p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={returnTo} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="portal-login-page">
      <div className="portal-login-card">
        <h1>Guest sign in</h1>
        <p className="portal-login-hint">
          Sign in to continue booking or to order from the restaurant. New guest? Create an account first.
        </p>
        <form onSubmit={handleSubmit}>
          <label className="portal-login-label">
            Email
            <input
              className="portal-login-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="portal-login-label">
            Password
            <input
              className="portal-login-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <p className="portal-login-error">{error}</p>}
          <button type="submit" className="portal-login-submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <div className="portal-login-links">
          <Link to={`/account/register?returnTo=${encodeURIComponent(returnTo)}`}>Create an account</Link>
          <Link to="/">← Home</Link>
        </div>
      </div>
    </div>
  );
}
