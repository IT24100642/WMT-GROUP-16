import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api, parseJson } from "../api/client.js";
import PayAdvanceModal from "../components/PayAdvanceModal.jsx";
import PayRemainingModal from "../components/PayRemainingModal.jsx";
import { useCustomerAuth } from "../context/CustomerAuthContext.jsx";
import { isBookingAdvancePaid } from "../lib/bookingAdvancePaid.js";
import { formatLkr } from "../lib/formatLkr.js";
import { ADVANCE_LKR, CANCELLATION_FEE_LKR } from "../lib/bookingPricing.js";
import "./Reservations.css";
import "./GuestProfilePage.css";

export default function GuestProfilePage() {
  const { ready, isAuthenticated, user, logout, token } = useCustomerAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [foodOrders, setFoodOrders] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [issues, setIssues] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [issueForm, setIssueForm] = useState({ bookingId: "", issueType: "plumbing", priority: "medium", description: "" });
  const [issueBusy, setIssueBusy] = useState(false);
  const [accountExtrasLoading, setAccountExtrasLoading] = useState(true);
  const [payAdvanceBooking, setPayAdvanceBooking] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelErr, setCancelErr] = useState("");
  const [payRemainingBooking, setPayRemainingBooking] = useState(null);
  const [settleFoodBusy, setSettleFoodBusy] = useState(false);
  const [logoutBlockedReasons, setLogoutBlockedReasons] = useState(null);
  const [activeSection, setActiveSection] = useState("bookings");
  const [bookingFilter, setBookingFilter] = useState("all");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [settleGatewayOpen, setSettleGatewayOpen] = useState(false);
  const [settleMethod, setSettleMethod] = useState("cash");
  const [settleGatewayErr, setSettleGatewayErr] = useState("");
  const [settleGatewayForm, setSettleGatewayForm] = useState({
    cardholderName: "",
    cardNumber: "",
    expiry: "",
    cvv: "",
    bankName: "",
    billingEmail: "",
  });
  const [reviewBusyId, setReviewBusyId] = useState("");
  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    mobile: "",
    serviceUrl: "",
  });
  const [profileMsg, setProfileMsg] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    const key = `guest_profile_meta_${user.id}`;
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(key) || "{}");
    } catch {
      saved = {};
    }
    const emailLeft = String(user.email || "").split("@")[0] || "";
    const tokens = emailLeft.split(/[._-]+/).filter(Boolean);
    const guessFirst = tokens[0] ? tokens[0][0].toUpperCase() + tokens[0].slice(1) : "Guest";
    const guessLast = tokens[1] ? tokens[1][0].toUpperCase() + tokens[1].slice(1) : "";
    setProfileForm({
      firstName: String(saved.firstName || guessFirst),
      lastName: String(saved.lastName || guessLast),
      mobile: String(saved.mobile || ""),
      serviceUrl: String(saved.serviceUrl || ""),
    });
    setProfileMsg("");
  }, [user?.id, user?.email]);

  if (!ready) {
    return (
      <div className="reservations-page guest-profile-page">
        <header className="res-header">
          <Link to="/" className="res-back">
            ← Maison Velour
          </Link>
        </header>
        <main className="res-main guest-profile-main">
          <p className="res-muted">Loading…</p>
        </main>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={`/account/login?returnTo=${encodeURIComponent("/account/profile")}`} replace />;
  }

  const pendingBillFoodOrders = useMemo(
    () =>
      foodOrders.filter(
        (o) =>
          o.paymentMethod === "room_bill" &&
          o.paymentStatus === "pending" &&
          o.orderStatus !== "cancelled"
      ),
    [foodOrders]
  );

  const pendingBillFoodTotal = useMemo(
    () => pendingBillFoodOrders.reduce((sum, o) => sum + (Number(o.subtotal) || 0), 0),
    [pendingBillFoodOrders]
  );
  const activeBookings = useMemo(
    () => bookings.filter((b) => b.status !== "cancelled"),
    [bookings]
  );
  const cancelledBookings = useMemo(
    () => bookings.filter((b) => b.status === "cancelled"),
    [bookings]
  );
  const totalRemainingActive = useMemo(() => {
    const bookingRemaining = activeBookings.reduce((sum, b) => {
      if (b.balancePaid) return sum;
      return sum + (Math.round(Number(b.remainingAmount) || 0) || 0);
    }, 0);
    return bookingRemaining + pendingBillFoodTotal;
  }, [activeBookings, pendingBillFoodTotal]);
  const bookingRemainingOnly = useMemo(
    () =>
      activeBookings.reduce((sum, b) => {
        if (b.balancePaid) return sum;
        return sum + (Math.round(Number(b.remainingAmount) || 0) || 0);
      }, 0),
    [activeBookings]
  );
  const displayedBookings = useMemo(() => {
    if (bookingFilter === "active") return activeBookings;
    if (bookingFilter === "cancelled") return cancelledBookings;
    return bookings;
  }, [bookingFilter, bookings, activeBookings, cancelledBookings]);

  useEffect(() => {
    if (!token) {
      setBookings([]);
      setFoodOrders([]);
      setReviews([]);
      setIssues([]);
      setNotifications([]);
      setAccountExtrasLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setAccountExtrasLoading(true);
      const [resB, resF, resR, resI, resN] = await Promise.all([
        api("/api/customer-auth/bookings", {}, token),
        api("/api/customer-auth/food-orders", {}, token),
        api("/api/customer-auth/reviews", {}, token),
        api("/api/customer-auth/issue-reports", {}, token),
        api("/api/customer-auth/notifications", {}, token),
      ]);
      const dataB = await parseJson(resB);
      const dataF = await parseJson(resF);
      const dataR = await parseJson(resR);
      const dataI = await parseJson(resI);
      const dataN = await parseJson(resN);
      if (cancelled) return;
      if (resB.ok) setBookings(Array.isArray(dataB) ? dataB : []);
      else setBookings([]);
      if (resF.ok) setFoodOrders(Array.isArray(dataF) ? dataF : []);
      else setFoodOrders([]);
      if (resR.ok) setReviews(Array.isArray(dataR) ? dataR : []);
      else setReviews([]);
      if (resI.ok) setIssues(Array.isArray(dataI) ? dataI : []);
      else setIssues([]);
      if (resN.ok) setNotifications(Array.isArray(dataN) ? dataN : []);
      else setNotifications([]);
      setAccountExtrasLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const reloadFoodOrdersOnly = useCallback(async () => {
    if (!token) return;
    const res = await api("/api/customer-auth/food-orders", {}, token);
    const data = await parseJson(res);
    if (res.ok) setFoodOrders(Array.isArray(data) ? data : []);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const refreshFoodOrders = () => {
      reloadFoodOrdersOnly();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshFoodOrders();
    };
    const intervalId = setInterval(refreshFoodOrders, 2000);
    window.addEventListener("focus", refreshFoodOrders);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", refreshFoodOrders);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [token, reloadFoodOrdersOnly]);

  async function reloadAccountExtras() {
    if (!token) return;
    const [resB, resF, resR, resI, resN] = await Promise.all([
      api("/api/customer-auth/bookings", {}, token),
      api("/api/customer-auth/food-orders", {}, token),
      api("/api/customer-auth/reviews", {}, token),
      api("/api/customer-auth/issue-reports", {}, token),
      api("/api/customer-auth/notifications", {}, token),
    ]);
    const dataB = await parseJson(resB);
    const dataF = await parseJson(resF);
    const dataR = await parseJson(resR);
    const dataI = await parseJson(resI);
    const dataN = await parseJson(resN);
    if (resB.ok) setBookings(Array.isArray(dataB) ? dataB : []);
    if (resF.ok) setFoodOrders(Array.isArray(dataF) ? dataF : []);
    if (resR.ok) setReviews(Array.isArray(dataR) ? dataR : []);
    if (resI.ok) setIssues(Array.isArray(dataI) ? dataI : []);
    if (resN.ok) setNotifications(Array.isArray(dataN) ? dataN : []);
  }

  async function submitIssueReport(e) {
    e.preventDefault();
    if (!token || !issueForm.bookingId) return;
    setIssueBusy(true);
    setLogoutBlockedReasons(null);
    try {
      const res = await api(
        "/api/customer-auth/issue-reports",
        { method: "POST", body: JSON.stringify(issueForm) },
        token
      );
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data.error || "Could not submit issue");
      setIssueForm((prev) => ({ ...prev, description: "" }));
      await reloadAccountExtras();
    } catch (err) {
      setLogoutBlockedReasons([err.message || "Could not submit issue"]);
    } finally {
      setIssueBusy(false);
    }
  }

  function closeCancelModal() {
    setCancelTarget(null);
    setCancelReason("");
    setCancelErr("");
  }

  async function confirmCancelBooking(e) {
    e?.preventDefault?.();
    if (!cancelTarget || !token) return;
    const trimmed = cancelReason.trim();
    if (trimmed.length < 5) {
      setCancelErr("Please enter a reason of at least 5 characters.");
      return;
    }
    setCancelBusy(true);
    setCancelErr("");
    try {
      const res = await api(
        `/api/customer-auth/bookings/${cancelTarget._id}/cancel`,
        { method: "POST", body: JSON.stringify({ cancellationReason: trimmed }) },
        token
      );
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data.error || "Could not cancel");
      closeCancelModal();
      await reloadAccountExtras();
    } catch (e) {
      setCancelErr(e.message || "Could not cancel");
    } finally {
      setCancelBusy(false);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined" || accountExtrasLoading) return;
    if (window.location.hash === "#my-bookings") {
      document.getElementById("my-bookings")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (window.location.hash === "#restaurant-bill") {
      document.getElementById("restaurant-bill")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [accountExtrasLoading, bookings.length, pendingBillFoodOrders.length]);

  function updateSettleGatewayField(field, value) {
    if (field === "cardNumber") {
      const digits = String(value || "").replace(/\D/g, "").slice(0, 16);
      const grouped = digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
      setSettleGatewayForm((prev) => ({ ...prev, cardNumber: grouped }));
      return;
    }
    if (field === "expiry") {
      const digits = String(value || "").replace(/\D/g, "").slice(0, 4);
      const formatted = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
      setSettleGatewayForm((prev) => ({ ...prev, expiry: formatted }));
      return;
    }
    if (field === "cvv") {
      const digits = String(value || "").replace(/\D/g, "").slice(0, 4);
      setSettleGatewayForm((prev) => ({ ...prev, cvv: digits }));
      return;
    }
    setSettleGatewayForm((prev) => ({ ...prev, [field]: value }));
  }

  function validateSettleGatewayForm() {
    const cardholderName = String(settleGatewayForm.cardholderName || "").trim();
    const cardNumberDigits = String(settleGatewayForm.cardNumber || "").replace(/\D/g, "");
    const expiry = String(settleGatewayForm.expiry || "").trim();
    const cvv = String(settleGatewayForm.cvv || "").trim();
    const bankName = String(settleGatewayForm.bankName || "").trim();
    const billingEmail = String(settleGatewayForm.billingEmail || "").trim();
    if (!cardholderName) return "Cardholder name is required.";
    if (cardNumberDigits.length !== 16) return "Card number must have 16 digits.";
    if (!/^\d{2}\/\d{2}$/.test(expiry)) return "Expiry must be in MM/YY format.";
    const [mmRaw, yyRaw] = expiry.split("/");
    const month = Number(mmRaw);
    const year = 2000 + Number(yyRaw);
    if (!Number.isFinite(month) || month < 1 || month > 12) return "Expiry month must be between 01 and 12.";
    const expiryDate = new Date(year, month, 0, 23, 59, 59, 999);
    if (Number.isNaN(expiryDate.getTime()) || expiryDate < new Date()) return "Card has expired.";
    if (!/^\d{3,4}$/.test(cvv)) return "CVV must be 3 or 4 digits.";
    if (!bankName) return "Issuing bank is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingEmail)) return "A valid billing email is required.";
    return "";
  }

  async function handleSettleRestaurantCharges(methodOverride = null) {
    if (!token || pendingBillFoodOrders.length === 0 || settleFoodBusy) return;
    const methodToUse = methodOverride || settleMethod;
    setSettleFoodBusy(true);
    setLogoutBlockedReasons(null);
    try {
      const res = await api(
        "/api/customer-auth/food-orders/settle-room-bills",
        { method: "POST", body: JSON.stringify({ paymentMethod: methodToUse }) },
        token
      );
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data.error || "Could not settle charges");
      await reloadAccountExtras();
      setSettleModalOpen(false);
      setSettleGatewayOpen(false);
      setSettleGatewayErr("");
    } catch (e) {
      setLogoutBlockedReasons([e.message || "Could not settle restaurant charges"]);
    } finally {
      setSettleFoodBusy(false);
    }
  }

  function startSettlePayment() {
    if (settleMethod === "online") {
      if (!settleGatewayOpen) {
        setSettleGatewayErr("");
        setSettleGatewayOpen(true);
        return;
      }
      submitOnlineSettlePayment();
      return;
    }
    if (settleMethod === "card") {
      setSettleGatewayErr("");
    }
    handleSettleRestaurantCharges();
  }

  function submitOnlineSettlePayment() {
    const err = validateSettleGatewayForm();
    if (err) {
      setSettleGatewayErr(err);
      return;
    }
    setSettleGatewayErr("");
    handleSettleRestaurantCharges("online");
  }

  async function handleSignOut() {
    setLogoutBlockedReasons(null);
    const r = await logout();
    if (!r.ok) {
      setLogoutBlockedReasons(r.reasons || ["Sign out is not available right now."]);
      document.getElementById("guest-profile-logout-hint")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    navigate("/", { replace: true });
  }

  function handleSaveProfileInfo(e) {
    e.preventDefault();
    if (!user?.id) return;
    const key = `guest_profile_meta_${user.id}`;
    localStorage.setItem(key, JSON.stringify(profileForm));
    setProfileMsg("Profile details saved.");
    setTimeout(() => setProfileMsg(""), 1800);
  }

  async function updateOwnReviewRating(reviewId, rating) {
    if (!token) return;
    const n = Number(rating);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      setLogoutBlockedReasons(["Rating must be between 1 and 5 stars."]);
      return;
    }
    setReviewBusyId(reviewId);
    setLogoutBlockedReasons(null);
    try {
      const res = await api(`/api/customer-auth/reviews/${reviewId}`, { method: "PATCH", body: JSON.stringify({ rating: n }) }, token);
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data.error || "Could not update review rating");
      await reloadAccountExtras();
    } catch (err) {
      setLogoutBlockedReasons([err.message || "Could not update review rating"]);
    } finally {
      setReviewBusyId("");
    }
  }

  async function deleteOwnReview(reviewId) {
    if (!token) return;
    setReviewBusyId(reviewId);
    setLogoutBlockedReasons(null);
    try {
      const res = await api(`/api/customer-auth/reviews/${reviewId}`, { method: "DELETE" }, token);
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data.error || "Could not delete review");
      await reloadAccountExtras();
    } catch (err) {
      setLogoutBlockedReasons([err.message || "Could not delete review"]);
    } finally {
      setReviewBusyId("");
    }
  }

  return (
    <div className="reservations-page guest-profile-page">
      <header className="res-header">
        <Link to="/" className="res-back">
          ← Maison Velour
        </Link>
      </header>
      <main className="res-main guest-profile-main">
        <div className="guest-profile-shell">
          <aside className="guest-profile-sidebar">
            <div className="guest-profile-sidebar-header">
              <div className="guest-profile-avatar">{(profileForm.firstName || "G")[0]?.toUpperCase()}</div>
              <div className="guest-profile-sidebar-name">{profileForm.firstName || "Guest"} {profileForm.lastName || ""}</div>
              <div className="guest-profile-sidebar-sub">{user.email} · Guest #{user.customerNumber}</div>
            </div>
            <div className="guest-profile-sidebar-section">
              <div className="guest-profile-sidebar-title">Outstanding balance</div>
              <div className="guest-profile-bill-banner">
                <div className="guest-profile-bill-banner-text">
                  <span className="guest-profile-bill-banner-label">Restaurant folio</span>
                  <span className="guest-profile-bill-banner-hint">Settle before sign out</span>
                </div>
                <strong className="guest-profile-bill-banner-total">{formatLkr(pendingBillFoodTotal)}</strong>
              </div>
              <button type="button" className="guest-profile-settle-food-btn" onClick={() => setSettleModalOpen(true)} disabled={settleFoodBusy || pendingBillFoodOrders.length === 0}>
                {settleFoodBusy ? "Processing…" : "Settle now"}
              </button>
            </div>
            <div className="guest-profile-sidebar-section">
              <div className="guest-profile-sidebar-title">Booking summary</div>
              <div className="guest-profile-stat-row"><span>Active / Pending</span><strong>{activeBookings.length}</strong></div>
              <div className="guest-profile-stat-row"><span>Cancelled</span><strong>{cancelledBookings.length}</strong></div>
              <div className="guest-profile-stat-row"><span>Booking remaining</span><strong>{formatLkr(bookingRemainingOnly)}</strong></div>
              <div className="guest-profile-stat-row"><span>Restaurant outstanding</span><strong>{formatLkr(pendingBillFoodTotal)}</strong></div>
              <div className="guest-profile-stat-row guest-profile-stat-row--total"><span>Total due</span><strong>{formatLkr(totalRemainingActive)}</strong></div>
            </div>
            <div className="guest-profile-sidebar-nav">
              <button type="button" className={`guest-profile-nav-item${activeSection === "bookings" ? " active" : ""}`} onClick={() => setActiveSection("bookings")}>Bookings</button>
              <button type="button" className={`guest-profile-nav-item${activeSection === "restaurant" ? " active" : ""}`} onClick={() => setActiveSection("restaurant")}>Restaurant orders</button>
              <button type="button" className={`guest-profile-nav-item${activeSection === "reviews" ? " active" : ""}`} onClick={() => setActiveSection("reviews")}>Reviews</button>
              <button type="button" className={`guest-profile-nav-item${activeSection === "support" ? " active" : ""}`} onClick={() => setActiveSection("support")}>Support</button>
            </div>
            <div className="guest-profile-sidebar-actions">
              <Link to="/reservations">Browse rooms</Link>
              <Link to="/offers">View offers</Link>
              <button type="button" className="guest-profile-settings-btn" onClick={() => setSettingsOpen((v) => !v)}>
                Settings {settingsOpen ? "▾" : "▸"}
              </button>
              {settingsOpen ? (
                <div className="guest-profile-settings-menu">
                  <p className="guest-profile-settings-name">
                    {(profileForm.firstName || "Guest") + (profileForm.lastName ? ` ${profileForm.lastName}` : "")}
                  </p>
                  <Link to="/account/change-password">Change password</Link>
                </div>
              ) : null}
              <button type="button" className="danger" onClick={handleSignOut}>Sign out</button>
            </div>
          </aside>

          <section className="guest-profile-main-panel">
            {logoutBlockedReasons && logoutBlockedReasons.length > 0 ? (
              <div id="guest-profile-logout-hint" className="guest-profile-logout-block" role="alert">
                <strong>Can&apos;t sign out yet</strong>
                <p className="guest-profile-logout-block-intro">Please resolve the following, then try again:</p>
                <ul className="guest-profile-logout-block-list">
                  {logoutBlockedReasons.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {activeSection === "bookings" && (
              <>
                <div className="guest-profile-main-head">
                  <h2 className="guest-profile-section-title">My bookings</h2>
                  <div className="guest-profile-tabs">
                    <button type="button" className={`guest-profile-tab${bookingFilter === "all" ? " guest-profile-tab--active" : ""}`} onClick={() => setBookingFilter("all")}>All</button>
                    <button type="button" className={`guest-profile-tab${bookingFilter === "active" ? " guest-profile-tab--active" : ""}`} onClick={() => setBookingFilter("active")}>Active</button>
                    <button type="button" className={`guest-profile-tab${bookingFilter === "cancelled" ? " guest-profile-tab--active" : ""}`} onClick={() => setBookingFilter("cancelled")}>Cancelled</button>
                  </div>
                </div>
                <div className="guest-profile-kpis">
                  <div className="guest-profile-kpi-card"><span>Active</span><strong>{activeBookings.length}</strong></div>
                  <div className="guest-profile-kpi-card"><span>Total remaining</span><strong>{formatLkr(totalRemainingActive)}</strong></div>
                </div>
                {accountExtrasLoading && <p className="res-muted">Loading bookings…</p>}
                {!accountExtrasLoading && displayedBookings.length === 0 && <p className="res-muted">No bookings in this view.</p>}
                {!accountExtrasLoading && displayedBookings.length > 0 && (
                  <ul className="guest-profile-bookings-list">
                    {displayedBookings.map((b) => (
                <li key={b._id} className="guest-profile-booking-card">
                  <div className="guest-profile-booking-head">
                    <strong>{b.summaryLine || "Booking"}</strong>
                    <span className={`guest-profile-booking-status guest-profile-booking-status--${b.status}`}>
                      {b.status}
                    </span>
                  </div>
                  <p className="guest-profile-booking-dates">
                    {b.checkIn && b.checkOut
                      ? `${new Date(b.checkIn).toLocaleDateString()} → ${new Date(b.checkOut).toLocaleDateString()} · ${
                          b.nights
                        } night(s)`
                      : "—"}
                  </p>
                  <p className="guest-profile-booking-guest">{b.fullName}</p>
                  {b.mealsAddLater && (
                    <p className="guest-profile-booking-meals">Meals: will add or decide later</p>
                  )}
                  {!b.mealsAddLater &&
                    (b.mealIntentRequired || b.mealIntentOtherOptions || b.mealIntentUnsure) && (
                      <p className="guest-profile-booking-meals">
                        Meals:{" "}
                        {[
                          b.mealIntentRequired && "Meals required",
                          b.mealIntentOtherOptions && "Other options",
                          b.mealIntentUnsure && "Still not sure",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  {b.status !== "cancelled" ? <dl className="guest-profile-booking-totals">
                    {(Number(b.restaurantFolioSubtotal) || 0) > 0 && (
                      <div>
                        <dt>Restaurant (folio)</dt>
                        <dd>{formatLkr(b.restaurantFolioSubtotal)}</dd>
                      </div>
                    )}
                    <div>
                      <dt>Total</dt>
                      <dd>{formatLkr(b.totalAmount)}</dd>
                    </div>
                    <div>
                      <dt>Advance</dt>
                      <dd>{formatLkr(b.advanceAmount)}</dd>
                    </div>
                    <div>
                      <dt>Advance paid</dt>
                      <dd>{isBookingAdvancePaid(b) ? "Yes" : "No"}</dd>
                    </div>
                    <div>
                      <dt>Remaining</dt>
                      <dd>{formatLkr(b.remainingAmount)}</dd>
                    </div>
                    <div>
                      <dt>Balance paid</dt>
                      <dd>{b.balancePaid ? "Yes" : "No"}</dd>
                    </div>
                  </dl> : (
                    <p className="guest-profile-booking-guest">
                      Refund {formatLkr(b.cancellationRefundLkr || 0)} (fee {formatLkr(b.cancellationFeeLkr || CANCELLATION_FEE_LKR)})
                    </p>
                  )}
                  {b.status !== "cancelled" && (
                    <div className="guest-profile-booking-actions">
                      {!isBookingAdvancePaid(b) && (
                        <button
                          type="button"
                          className="guest-profile-pay-advance-btn"
                          onClick={() => setPayAdvanceBooking(b)}
                        >
                          Pay advance {formatLkr(b.advanceAmount ?? ADVANCE_LKR)}
                        </button>
                      )}
                      {isBookingAdvancePaid(b) &&
                        (Math.round(Number(b.remainingAmount) || 0) > 0) &&
                        !b.balancePaid && (
                          <button
                            type="button"
                            className="guest-profile-pay-remaining-btn"
                            onClick={() => setPayRemainingBooking(b)}
                          >
                            Pay remaining balance {formatLkr(b.remainingAmount)}
                          </button>
                        )}
                      <button
                        type="button"
                        className="guest-profile-cancel-booking-btn"
                        onClick={() => {
                          setCancelErr("");
                          setCancelReason("");
                          setCancelTarget(b);
                        }}
                      >
                        Cancel booking
                      </button>
                    </div>
                  )}
                </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {activeSection === "restaurant" && (
              <>
                <div className="guest-profile-main-head">
                  <h2 className="guest-profile-section-title">Restaurant orders</h2>
                </div>
                <div className="guest-profile-kpis">
                  <div className="guest-profile-kpi-card"><span>Total orders</span><strong>{foodOrders.length}</strong></div>
                  <div className="guest-profile-kpi-card"><span>Owed</span><strong>{formatLkr(pendingBillFoodTotal)}</strong></div>
                </div>
                {foodOrders.length === 0 ? <p className="res-muted">No restaurant orders yet.</p> : (
                  <ul className="guest-profile-bookings-list">
                    {foodOrders.map((o) => (
                      <li key={o._id} className="guest-profile-booking-card">
                        <div className="guest-profile-booking-head">
                          <strong>{new Date(o.createdAt).toLocaleString()}</strong>
                          <span className={`guest-profile-booking-status guest-profile-booking-status--${o.orderStatus === "cancelled" ? "cancelled" : o.paymentStatus === "paid" ? "confirmed" : "pending"}`}>{o.orderStatus}</span>
                        </div>
                        <ul className="guest-profile-food-bill-lines">
                          {(o.lines || []).map((ln, i) => (
                            <li key={i}>
                              <span className="guest-profile-food-bill-line-label">{ln.quantity}× {ln.name}</span>
                              <span className="guest-profile-food-bill-line-amt">{formatLkr((Number(ln.unitPrice) || 0) * (Number(ln.quantity) || 0))}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="guest-profile-food-bill-subtotal"><span>Total</span><strong>{formatLkr(o.subtotal)}</strong></div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {activeSection === "reviews" && (
              <>
                <div className="guest-profile-main-head">
                  <h2 className="guest-profile-section-title">My reviews</h2>
                </div>
                {reviews.length === 0 ? <p className="res-muted">You have not submitted any reviews yet.</p> : (
                  <ul className="guest-profile-bookings-list">
                    {reviews.map((r) => (
                      <li key={r._id} className="guest-profile-booking-card">
                        <div className="guest-profile-booking-head">
                          <strong>{r.text}</strong>
                          <span className={`guest-profile-booking-status guest-profile-booking-status--${r.status}`}>{r.status}</span>
                        </div>
                        <p className="guest-profile-booking-dates">{new Date(r.createdAt).toLocaleString()}</p>
                        <p className="guest-profile-booking-guest">Rating: {r.rating}/5</p>
                        <div className="guest-profile-booking-actions">
                          <label className="guest-profile-label" style={{ margin: 0, textTransform: "none", letterSpacing: "normal" }}>
                            Edit stars only
                            <select
                              value={r.rating}
                              onChange={(e) => updateOwnReviewRating(r._id, e.target.value)}
                              disabled={reviewBusyId === r._id}
                            >
                              {[1, 2, 3, 4, 5].map((n) => (
                                <option key={n} value={n}>{n} star{n > 1 ? "s" : ""}</option>
                              ))}
                            </select>
                          </label>
                          <button
                            type="button"
                            className="guest-profile-cancel-booking-btn"
                            onClick={() => deleteOwnReview(r._id)}
                            disabled={reviewBusyId === r._id}
                          >
                            {reviewBusyId === r._id ? "Working…" : "Delete review"}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {activeSection === "support" && (
              <>
                <div className="guest-profile-main-head">
                  <h2 className="guest-profile-section-title">Room support</h2>
                </div>
                <p className="guest-profile-section-hint">Report a room issue. Your room is auto-linked from your booking.</p>
                <form className="guest-profile-pwd-form guest-profile-support-form" onSubmit={submitIssueReport}>
            <label className="guest-profile-label">
              Booking / Room
              <select
                value={issueForm.bookingId}
                onChange={(e) => setIssueForm((p) => ({ ...p, bookingId: e.target.value }))}
                required
              >
                <option value="">Select booking</option>
                {bookings
                  .filter((b) => b.status !== "cancelled" && b.room?._id)
                  .map((b) => (
                    <option key={b._id} value={b._id}>
                      Room {b.room?.roomNumber} · {b.summaryLine || "Booking"}
                    </option>
                  ))}
              </select>
            </label>
            <label className="guest-profile-label">
              Issue type
              <select
                value={issueForm.issueType}
                onChange={(e) => setIssueForm((p) => ({ ...p, issueType: e.target.value }))}
                required
              >
                <option value="plumbing">Plumbing</option>
                <option value="ac">AC</option>
                <option value="electrical">Electrical</option>
              </select>
            </label>
            <label className="guest-profile-label">
              Priority
              <select
                value={issueForm.priority}
                onChange={(e) => setIssueForm((p) => ({ ...p, priority: e.target.value }))}
                required
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label className="guest-profile-label">
              Description (optional)
              <textarea
                rows={3}
                value={issueForm.description}
                onChange={(e) => setIssueForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Briefly describe the issue"
              />
            </label>
            <button type="submit" className="res-book-now guest-profile-pwd-submit" disabled={issueBusy}>
              {issueBusy ? "Submitting…" : "Submit issue"}
            </button>
          </form>
                {issues.length === 0 ? <p className="res-muted">No issues reported yet.</p> : (
                  <ul className="guest-profile-bookings-list">
                    {issues.map((i) => (
                      <li key={i._id} className="guest-profile-booking-card">
                        <div className="guest-profile-booking-head">
                          <strong>{i.issueType}</strong>
                          <span className={`guest-profile-booking-status guest-profile-booking-status--${i.status}`}>{i.status}</span>
                        </div>
                        <p className="guest-profile-booking-dates">Room {i.room?.roomNumber || "—"} · Priority {i.priority}</p>
                        <p className="guest-profile-booking-guest">{i.description || "No description provided."}</p>
                      </li>
                    ))}
                  </ul>
                )}
                {notifications.length > 0 && (
                  <ul className="guest-profile-bookings-list">
                    {notifications.slice(0, 8).map((n) => (
                      <li key={n._id} className="guest-profile-booking-card">
                        <div className="guest-profile-booking-head"><strong>{n.title}</strong><span>{new Date(n.createdAt).toLocaleString()}</span></div>
                        <p className="guest-profile-booking-guest">{n.message}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
        </div>
      </main>

      {payAdvanceBooking && token ? (
        <PayAdvanceModal
          booking={payAdvanceBooking}
          token={token}
          onClose={() => setPayAdvanceBooking(null)}
          onPaid={async () => {
            await reloadAccountExtras();
          }}
        />
      ) : null}

      {payRemainingBooking && token ? (
        <PayRemainingModal
          booking={payRemainingBooking}
          token={token}
          onClose={() => setPayRemainingBooking(null)}
          onPaid={async () => {
            await reloadAccountExtras();
          }}
        />
      ) : null}

      {cancelTarget ? (
        <div
          className="guest-profile-cancel-overlay"
          role="presentation"
          onClick={() => {
            if (!cancelBusy) closeCancelModal();
          }}
        >
          <form
            className="guest-profile-cancel-modal"
            role="dialog"
            aria-labelledby="guest-cancel-title"
            aria-describedby="guest-cancel-desc"
            onClick={(e) => e.stopPropagation()}
            onSubmit={confirmCancelBooking}
          >
            <h3 id="guest-cancel-title" className="guest-profile-cancel-title">
              Cancel this booking?
            </h3>
            <p id="guest-cancel-desc" className="guest-profile-cancel-lead">
              {isBookingAdvancePaid(cancelTarget) ? (
                <>
                  Your advance of {formatLkr(cancelTarget.advanceAmount ?? ADVANCE_LKR)} will be refunded minus a{" "}
                  <strong>{formatLkr(CANCELLATION_FEE_LKR)}</strong> service fee. You would receive{" "}
                  <strong>
                    {formatLkr(
                      Math.max(
                        0,
                        Math.round(Number(cancelTarget.advanceAmount) || ADVANCE_LKR) - CANCELLATION_FEE_LKR
                      )
                    )}
                  </strong>{" "}
                  in a real system (demo only here).
                </>
              ) : (
                <>No advance has been recorded yet, so there is nothing to refund. This will cancel the reservation.</>
              )}
            </p>
            <label className="guest-profile-cancel-reason-label" htmlFor="guest-cancel-reason">
              Reason for cancelling <span className="guest-profile-req">*</span>
            </label>
            <textarea
              id="guest-cancel-reason"
              className="guest-profile-cancel-textarea"
              rows={4}
              required
              minLength={5}
              maxLength={2000}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. change of travel dates, found another hotel, emergency…"
              disabled={cancelBusy}
            />
            <p className="guest-profile-cancel-hint">At least 5 characters. Max 2,000.</p>
            {cancelErr && <p className="guest-profile-form-err">{cancelErr}</p>}
            <div className="guest-profile-cancel-actions">
              <button type="button" className="guest-profile-cancel-back" disabled={cancelBusy} onClick={closeCancelModal}>
                Keep booking
              </button>
              <button type="submit" className="guest-profile-cancel-confirm" disabled={cancelBusy}>
                {cancelBusy ? "Cancelling…" : "Submit cancellation"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {settleModalOpen ? (
        <div
          className="guest-profile-cancel-overlay"
          role="presentation"
          onClick={() => {
            if (settleFoodBusy) return;
            setSettleModalOpen(false);
            setSettleGatewayOpen(false);
            setSettleGatewayErr("");
          }}
        >
          <div className="guest-profile-cancel-modal" role="dialog" aria-labelledby="settle-title" onClick={(e) => e.stopPropagation()}>
            <h3 id="settle-title" className="guest-profile-cancel-title">Outstanding balance payment</h3>
            <p className="guest-profile-cancel-lead">Outstanding amount: <strong>{formatLkr(pendingBillFoodTotal)}</strong></p>
            <label className="guest-profile-label" style={{ marginBottom: "0.8rem" }}>
              Payment method
              <select
                value={settleMethod}
                onChange={(e) => {
                  setSettleMethod(e.target.value);
                  setSettleGatewayErr("");
                  if (e.target.value !== "online") setSettleGatewayOpen(false);
                }}
                disabled={settleFoodBusy}
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="online">Online</option>
              </select>
            </label>
            {settleGatewayOpen && settleMethod === "online" ? (
              <>
                {settleGatewayErr && <p className="guest-profile-form-err">{settleGatewayErr}</p>}
                <div className="guest-profile-gateway-grid">
                  <label className="guest-profile-label guest-profile-gateway-field">
                    Cardholder name
                    <input
                      type="text"
                      value={settleGatewayForm.cardholderName}
                      onChange={(e) => updateSettleGatewayField("cardholderName", e.target.value)}
                      disabled={settleFoodBusy}
                      placeholder="e.g. Neth Perera"
                      autoComplete="cc-name"
                    />
                  </label>
                  <label className="guest-profile-label guest-profile-gateway-field">
                    Card number
                    <input
                      type="text"
                      value={settleGatewayForm.cardNumber}
                      onChange={(e) => updateSettleGatewayField("cardNumber", e.target.value)}
                      disabled={settleFoodBusy}
                      placeholder="1234 5678 9012 3456"
                      inputMode="numeric"
                      autoComplete="cc-number"
                    />
                  </label>
                  <label className="guest-profile-label guest-profile-gateway-field">
                    Expiry (MM/YY)
                    <input
                      type="text"
                      value={settleGatewayForm.expiry}
                      onChange={(e) => updateSettleGatewayField("expiry", e.target.value)}
                      disabled={settleFoodBusy}
                      placeholder="08/29"
                      inputMode="numeric"
                      autoComplete="cc-exp"
                    />
                  </label>
                  <label className="guest-profile-label guest-profile-gateway-field">
                    CVV
                    <input
                      type="password"
                      value={settleGatewayForm.cvv}
                      onChange={(e) => updateSettleGatewayField("cvv", e.target.value)}
                      disabled={settleFoodBusy}
                      placeholder="123"
                      inputMode="numeric"
                      autoComplete="cc-csc"
                    />
                  </label>
                  <label className="guest-profile-label guest-profile-gateway-field">
                    Issuing bank
                    <input
                      type="text"
                      value={settleGatewayForm.bankName}
                      onChange={(e) => updateSettleGatewayField("bankName", e.target.value)}
                      disabled={settleFoodBusy}
                      placeholder="e.g. Commercial Bank"
                    />
                  </label>
                  <label className="guest-profile-label guest-profile-gateway-field">
                    Billing email
                    <input
                      type="email"
                      value={settleGatewayForm.billingEmail}
                      onChange={(e) => updateSettleGatewayField("billingEmail", e.target.value)}
                      disabled={settleFoodBusy}
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                  </label>
                </div>
              </>
            ) : null}
            <div className="guest-profile-cancel-actions">
              <button
                type="button"
                className="guest-profile-cancel-back"
                disabled={settleFoodBusy}
                onClick={() => {
                  setSettleModalOpen(false);
                  setSettleGatewayOpen(false);
                  setSettleGatewayErr("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="guest-profile-cancel-confirm"
                disabled={settleFoodBusy}
                onClick={startSettlePayment}
              >
                {settleFoodBusy ? "Processing…" : `Pay ${formatLkr(pendingBillFoodTotal)}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
