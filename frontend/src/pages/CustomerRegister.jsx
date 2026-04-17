import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useCustomerAuth } from "../context/CustomerAuthContext.jsx";
import { safeReturnTo, validateCustomerEmail, validateCustomerPassword } from "../lib/customerValidation.js";
import "./PortalLogin.css";

export default function CustomerRegister() {
  const { register, isAuthenticated, ready } = useCustomerAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [createdProfile, setCreatedProfile] = useState(null);

  const returnTo = useMemo(() => safeReturnTo(searchParams), [searchParams]);

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

  if (isAuthenticated && !createdProfile) {
    return <Navigate to={returnTo} replace />;
  }

  function validateForm() {
    const next = {};
    const ve = validateCustomerEmail(email);
    if (ve.error) next.email = ve.error;
    const pwdErr = validateCustomerPassword(password);
    if (pwdErr) next.password = pwdErr;
    if (password !== confirmPassword) next.confirmPassword = "Passwords do not match";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!validateForm()) return;
    setLoading(true);
    try {
      const customer = await register(email, password, confirmPassword);
      setCreatedProfile(customer);
    } catch (err) {
      setError(err.message || "Could not create account");
    } finally {
      setLoading(false);
    }
  }

  if (createdProfile) {
    return (
      <div className="portal-login-page">
        <div className="portal-login-card">
          <h1>Welcome</h1>
          <p className="portal-login-hint">
            Your account is ready. Save your <strong>guest ID</strong> for phone or email correspondence with the hotel.
          </p>
          <p className="portal-register-success-id">
            Guest ID <span className="portal-register-id-value">#{createdProfile.customerNumber}</span>
          </p>
          <p className="portal-login-hint" style={{ marginBottom: "1.25rem" }}>
            Signed in as <strong>{createdProfile.email}</strong>
          </p>
          <button type="button" className="portal-login-submit" onClick={() => navigate(returnTo, { replace: true })}>
            Continue
          </button>
          <div className="portal-login-links">
            <Link to="/">← Home</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-login-page">
      <div className="portal-login-card">
        <h1>Create guest account</h1>
        <p className="portal-login-hint">
          Use a valid email and a password with at least 8 characters, including a letter and a number. You will receive a
          guest ID after registration.
        </p>
        <form onSubmit={handleSubmit} noValidate>
          <label className="portal-login-label">
            Email
            <input
              className="portal-login-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFieldErrors((f) => ({ ...f, email: undefined }));
              }}
            />
            {fieldErrors.email && <p className="portal-login-error portal-login-error--field">{fieldErrors.email}</p>}
          </label>
          <label className="portal-login-label">
            Password
            <input
              className="portal-login-input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setFieldErrors((f) => ({ ...f, password: undefined }));
              }}
            />
            {fieldErrors.password && (
              <p className="portal-login-error portal-login-error--field">{fieldErrors.password}</p>
            )}
          </label>
          <label className="portal-login-label">
            Confirm password
            <input
              className="portal-login-input"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setFieldErrors((f) => ({ ...f, confirmPassword: undefined }));
              }}
            />
            {fieldErrors.confirmPassword && (
              <p className="portal-login-error portal-login-error--field">{fieldErrors.confirmPassword}</p>
            )}
          </label>
          {error && <p className="portal-login-error">{error}</p>}
          <button type="submit" className="portal-login-submit" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>
        <div className="portal-login-links">
          <Link to={`/account/login?returnTo=${encodeURIComponent(returnTo)}`}>Already have an account? Sign in</Link>
          <Link to="/">← Home</Link>
        </div>
      </div>
    </div>
  );
}
