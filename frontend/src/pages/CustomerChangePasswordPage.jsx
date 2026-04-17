import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useCustomerAuth } from "../context/CustomerAuthContext.jsx";
import { validateCustomerPassword } from "../lib/customerValidation.js";
import "./PortalLogin.css";

export default function CustomerChangePasswordPage() {
  const { ready, isAuthenticated, changePassword } = useCustomerAuth();
  const [curPwd, setCurPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

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

  if (!isAuthenticated) {
    return <Navigate to={`/account/login?returnTo=${encodeURIComponent("/account/change-password")}`} replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");
    setErr("");
    const pErr = validateCustomerPassword(newPwd);
    if (pErr) {
      setErr(pErr);
      return;
    }
    if (newPwd !== confirmPwd) {
      setErr("New passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await changePassword(curPwd, newPwd);
      setMsg("Password updated successfully.");
      setCurPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } catch (ex) {
      setErr(ex.message || "Update failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="portal-login-page">
      <div className="portal-login-card" style={{ maxWidth: 560 }}>
        <h1>Change password</h1>
        <p className="portal-login-hint">Use at least 8 characters with at least one letter and one number.</p>
        <form onSubmit={onSubmit}>
          <label className="portal-login-label">
            Current password
            <input
              className="portal-login-input"
              type="password"
              autoComplete="current-password"
              value={curPwd}
              onChange={(e) => setCurPwd(e.target.value)}
              required
            />
          </label>
          <label className="portal-login-label">
            New password
            <input
              className="portal-login-input"
              type="password"
              autoComplete="new-password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              required
            />
          </label>
          <label className="portal-login-label">
            Confirm new password
            <input
              className="portal-login-input"
              type="password"
              autoComplete="new-password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              required
            />
          </label>
          {err && <p className="portal-login-error">{err}</p>}
          {msg && <p className="guest-profile-form-ok">{msg}</p>}
          <button type="submit" className="portal-login-submit" disabled={loading}>
            {loading ? "Updating…" : "Update password"}
          </button>
        </form>
        <div className="portal-login-links">
          <Link to="/account/profile">← Back to My profile</Link>
        </div>
      </div>
    </div>
  );
}
