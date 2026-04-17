import { useEffect, useState } from "react";
import { useStaffAuth } from "../context/StaffAuthContext.jsx";
import "./StaffChangePasswordModal.css";

export default function StaffChangePasswordModal({ onClose }) {
  const { changePassword, profile } = useStaffAuth();
  const [curPwd, setCurPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg("");
    setErr("");
    setBusy(true);
    try {
      await changePassword(curPwd, newPwd);
      setMsg("Password updated. Use it next time you sign in.");
      setCurPwd("");
      setNewPwd("");
    } catch (ex) {
      setErr(ex.message || "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="staff-pwd-overlay"
      role="presentation"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="staff-pwd-modal"
        role="dialog"
        aria-labelledby="staff-pwd-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="staff-pwd-modal__head">
          <h2 id="staff-pwd-title" className="staff-pwd-modal__title">
            Change password
          </h2>
          <button
            type="button"
            className="staff-pwd-modal__close"
            onClick={() => !busy && onClose()}
            disabled={busy}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <p className="staff-pwd-modal__hint">
          Signed in as <code>{profile?.username}</code>. New password at least 6 characters.
        </p>
        <form className="staff-pwd-modal__form" onSubmit={handleSubmit}>
          <label className="staff-pwd-modal__label">
            Current password
            <input
              type="password"
              autoComplete="current-password"
              value={curPwd}
              onChange={(e) => setCurPwd(e.target.value)}
              required
              disabled={busy}
            />
          </label>
          <label className="staff-pwd-modal__label">
            New password
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Min 6 characters"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              minLength={6}
              required
              disabled={busy}
            />
          </label>
          {err && <p className="staff-pwd-modal__err">{err}</p>}
          {msg && <p className="staff-pwd-modal__ok">{msg}</p>}
          <div className="staff-pwd-modal__actions">
            <button type="button" className="staff-pwd-modal__btn staff-pwd-modal__btn--ghost" disabled={busy} onClick={onClose}>
              Close
            </button>
            <button type="submit" className="staff-pwd-modal__btn staff-pwd-modal__btn--primary" disabled={busy}>
              {busy ? "Updating…" : "Update password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
