import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, parseJson } from "../api/client.js";
import { useCustomerAuth } from "../context/CustomerAuthContext.jsx";
import {
  appendFoodOrderToDraft,
  loadBookingDraft,
  setFoodDuringBookingSuccessFlag,
  setResumeBookingModalFlag,
} from "../lib/bookingDraftStorage.js";
import { formatLkr } from "../lib/formatLkr.js";
import "./FoodOrdering.css";

const ALLOWED_MENU_CATEGORY_NAMES = new Set([
  "Breakfast",
  "Snacks",
  "Appetizers",
  "Mains",
  "Indian Lunch",
  "Kottu",
  "Pizza",
  "Desserts",
]);

function buildLines(cart) {
  return Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([id, quantity]) => ({ foodItemId: id, quantity }));
}

export default function FoodOrderingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromBookFlow = searchParams.get("fromBookFlow") === "1";
  const returnToRestaurantEncoded = encodeURIComponent(
    fromBookFlow ? "/restaurant?fromBookFlow=1" : "/restaurant"
  );
  const { token, isAuthenticated, ready } = useCustomerAuth();
  const [menu, setMenu] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState({});
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [err, setErr] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentGatewayOpen, setPaymentGatewayOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("online");
  const [submitting, setSubmitting] = useState(false);
  const [roomBillProfileHint, setRoomBillProfileHint] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState("");
  const [gatewayForm, setGatewayForm] = useState({
    cardholderName: "",
    cardNumber: "",
    expiry: "",
    cvv: "",
    bankName: "",
    billingEmail: "",
  });
  const [gatewayErr, setGatewayErr] = useState("");

  function requireLoginForOrder() {
    setErr("Please log in first to place a food order.");
    navigate(`/account/login?returnTo=${returnToRestaurantEncoded}`);
  }

  const cartTotal = useMemo(() => {
    return menu.reduce((sum, m) => sum + (Number(m.price) || 0) * (cart[m._id] || 0), 0);
  }, [menu, cart]);

  const menuByCategory = useMemo(() => {
    const categoriesById = new Map();
    for (const cat of categories) {
      if (!cat || cat.active === false || !cat._id) continue;
      if (!ALLOWED_MENU_CATEGORY_NAMES.has(String(cat.name || "").trim())) continue;
      categoriesById.set(String(cat._id), { category: cat, items: [] });
    }

    const byId = new Map();
    for (const item of menu) {
      const cat = item.category;
      if (cat && typeof cat === "object" && cat._id && cat.active !== false) {
        const id = String(cat._id);
        if (!byId.has(id)) {
          byId.set(id, { category: cat, items: [] });
        }
        byId.get(id).items.push(item);
      }
    }
    for (const [id, block] of byId.entries()) {
      if (!categoriesById.has(id)) {
        categoriesById.set(id, block);
      } else {
        categoriesById.get(id).items.push(...block.items);
      }
    }

    const blocks = [...categoriesById.values()].sort((a, b) => {
      const oa = a.category?.sortOrder ?? 0;
      const ob = b.category?.sortOrder ?? 0;
      if (oa !== ob) return oa - ob;
      return String(a.category?.name || "").localeCompare(String(b.category?.name || ""));
    });
    return blocks;
  }, [menu, categories]);

  useEffect(() => {
    if (!menuByCategory.length) {
      setActiveCategoryId("");
      return;
    }
    const exists = menuByCategory.some((b) => String(b.category._id) === String(activeCategoryId));
    if (!exists) {
      setActiveCategoryId(String(menuByCategory[0].category._id));
    }
  }, [menuByCategory, activeCategoryId]);

  const activeBlock = useMemo(() => {
    if (!menuByCategory.length) return null;
    return (
      menuByCategory.find((b) => String(b.category._id) === String(activeCategoryId)) || menuByCategory[0] || null
    );
  }, [menuByCategory, activeCategoryId]);

  const loadMenu = useCallback(async () => {
    setErr("");
    const [resItems, resCategories] = await Promise.all([
      api("/api/public/food-items"),
      api("/api/public/food-categories"),
    ]);
    const dataItems = await parseJson(resItems);
    const dataCategories = await parseJson(resCategories);
    if (!resItems.ok) {
      setErr(dataItems.error || "Could not load menu");
      setMenu([]);
      setCategories([]);
      return;
    }
    if (!resCategories.ok) {
      setErr(dataCategories.error || "Could not load categories");
      setCategories([]);
    } else {
      setCategories(Array.isArray(dataCategories) ? dataCategories : []);
    }
    setMenu(Array.isArray(dataItems) ? dataItems : []);
  }, []);

  const loadOrders = useCallback(async () => {
    if (!token) return;
    setLoadingOrders(true);
    const res = await api("/api/customer-auth/food-orders", {}, token);
    const data = await parseJson(res);
    if (!res.ok) {
      setErr(data.error || "Could not load your orders");
      setOrders([]);
    } else {
      setOrders(Array.isArray(data) ? data : []);
    }
    setLoadingOrders(false);
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingMenu(true);
      await loadMenu();
      if (!cancelled) setLoadingMenu(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadMenu]);

  useEffect(() => {
    if (!ready || !isAuthenticated || !token) return;
    loadOrders();
  }, [ready, isAuthenticated, token, loadOrders]);

  function setQty(id, qty) {
    if (!isAuthenticated) {
      requireLoginForOrder();
      return;
    }
    setCart((prev) => {
      const next = { ...prev };
      const q = Math.max(0, Math.min(99, Math.floor(Number(qty)) || 0));
      if (q === 0) delete next[id];
      else next[id] = q;
      return next;
    });
  }

  function updateGatewayField(field, value) {
    if (field === "cardNumber") {
      const digits = String(value || "").replace(/\D/g, "").slice(0, 16);
      const grouped = digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
      setGatewayForm((prev) => ({ ...prev, cardNumber: grouped }));
      return;
    }
    if (field === "expiry") {
      const digits = String(value || "").replace(/\D/g, "").slice(0, 4);
      const formatted = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
      setGatewayForm((prev) => ({ ...prev, expiry: formatted }));
      return;
    }
    if (field === "cvv") {
      const digits = String(value || "").replace(/\D/g, "").slice(0, 4);
      setGatewayForm((prev) => ({ ...prev, cvv: digits }));
      return;
    }
    setGatewayForm((prev) => ({ ...prev, [field]: value }));
  }

  function validateGatewayForm() {
    const cardholderName = String(gatewayForm.cardholderName || "").trim();
    const cardNumberDigits = String(gatewayForm.cardNumber || "").replace(/\D/g, "");
    const expiry = String(gatewayForm.expiry || "").trim();
    const cvv = String(gatewayForm.cvv || "").trim();
    const bankName = String(gatewayForm.bankName || "").trim();
    const billingEmail = String(gatewayForm.billingEmail || "").trim();

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

  function addOne(id) {
    if (!isAuthenticated) {
      requireLoginForOrder();
      return;
    }
    setCart((prev) => ({ ...prev, [id]: Math.min(99, (prev[id] || 0) + 1) }));
  }

  function goBackToBookingForm(foodJustOrdered) {
    const draft = loadBookingDraft();
    setResumeBookingModalFlag();
    if (foodJustOrdered) {
      setFoodDuringBookingSuccessFlag();
    }
    if (draft?.roomId) {
      navigate(`/book?roomId=${encodeURIComponent(draft.roomId)}`);
      return;
    }
    if (draft?.offerId) {
      navigate(`/book?offerId=${encodeURIComponent(draft.offerId)}`);
      return;
    }
    navigate("/reservations");
  }

  async function submitOrder(forcedPaymentMethod = null) {
    if (submitting) return;
    if (!isAuthenticated || !token) {
      requireLoginForOrder();
      return;
    }
    const lines = buildLines(cart);
    if (lines.length === 0) {
      setErr("Add at least one item before placing an order.");
      return;
    }
    const methodChosen = typeof forcedPaymentMethod === "string" ? forcedPaymentMethod : paymentMethod;
    setSubmitting(true);
    setErr("");
    setSuccessMsg("");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 15000);
    try {
      const res = await api(
        "/api/customer-auth/food-orders",
        {
          method: "POST",
          body: JSON.stringify({ lines, paymentMethod: methodChosen }),
          signal: controller.signal,
        },
        token
      );
      const data = await parseJson(res);
      if (!res.ok) {
        setErr(data.error || "Order could not be placed");
        return;
      }
      setCart({});
      setCheckoutOpen(false);
      setPaymentGatewayOpen(false);
      setPaymentMethod("online");
      if (fromBookFlow) {
        appendFoodOrderToDraft(data);
        await loadOrders();
        goBackToBookingForm(true);
        return;
      }
      setRoomBillProfileHint(methodChosen === "room_bill");
      await loadOrders();
      setSuccessMsg(
        methodChosen === "online"
          ? "Payment successful. Your order is confirmed."
          : "Order added to your room bill successfully."
      );
    } catch (error) {
      if (error?.name === "AbortError") {
        setErr("Order request timed out. Please check your connection and try again.");
      } else {
        setErr("Order could not be placed. Please try again.");
      }
    } finally {
      clearTimeout(timeoutId);
      setSubmitting(false);
    }
  }

  function startCheckoutPlacement() {
    if (submitting) return;
    if (paymentMethod === "online") {
      setGatewayErr("");
      setPaymentGatewayOpen(true);
      return;
    }
    submitOrder();
  }

  async function submitOnlinePayment() {
    if (submitting) return;
    const validationErr = validateGatewayForm();
    if (validationErr) {
      setGatewayErr(validationErr);
      return;
    }
    setGatewayErr("");
    await submitOrder("online");
  }

  if (!ready) {
    return (
      <div className="food-page">
        <p className="food-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="food-page">
      <header className="food-header food-header--split">
        {fromBookFlow ? (
          <button type="button" className="food-back food-back--btn" onClick={() => goBackToBookingForm(false)}>
            ← Finish room booking
          </button>
        ) : (
          <Link to="/" className="food-back">
            ← Maison Velour
          </Link>
        )}
      </header>

      <main className="food-main">
        <div className="food-title-row">
          <div>
            <div className="food-menu-hero" aria-hidden="true">
              <p className="food-menu-hero__kicker">Maison Velour</p>
              <h2 className="food-menu-hero__title">Restaurant Menu</h2>
              <p className="food-menu-hero__sub">Food & drink menu</p>
            </div>
          </div>
        </div>

        {err && <p className="food-err">{err}</p>}
        {!err && successMsg && <p className="food-ok">{successMsg}</p>}
        {loadingMenu && <p className="food-muted">Loading menu…</p>}

        {!loadingMenu && menu.length === 0 && categories.length === 0 && !err && (
          <p className="food-muted">The kitchen has not published any dishes yet. Please check back soon.</p>
        )}

        {(menu.length > 0 || categories.length > 0) && (
          <div className="food-layout">
            <section className="food-menu" aria-labelledby="food-menu-heading">
              <h2 id="food-menu-heading" className="food-section-title">
                Menu
              </h2>
              <div className="food-category-tabs" role="tablist" aria-label="Menu categories">
                {menuByCategory.map((block) => {
                  const id = String(block.category._id);
                  const active = id === String(activeCategoryId);
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`food-category-tab${active ? " is-active" : ""}`}
                      onClick={() => setActiveCategoryId(id)}
                      role="tab"
                      aria-selected={active}
                    >
                      {block.category.name}
                    </button>
                  );
                })}
              </div>

              {activeBlock && (
                <div className="food-category-block">
                  <h3 className="food-category-title">{activeBlock.category.name}</h3>
                  {activeBlock.category.description ? (
                    <p className="food-category-desc">{activeBlock.category.description}</p>
                  ) : null}
                  {activeBlock.items.length === 0 ? (
                    <p className="food-muted">No dishes in this category yet.</p>
                  ) : (
                    <ul className="food-menu-list food-menu-list--cards">
                      {activeBlock.items.map((item) => (
                      <li key={item._id} className="food-menu-item food-menu-item--card">
                        {item.photos?.[0]?.url ? (
                          <div className="food-menu-item__thumb food-menu-item__thumb--large">
                            <img src={item.photos[0].url} alt={item.name} loading="lazy" />
                          </div>
                        ) : (
                          <div className="food-menu-item__thumb food-menu-item__thumb--placeholder food-menu-item__thumb--large" aria-hidden />
                        )}
                        <div className="food-menu-item__body">
                          <h4 className="food-item-name">{item.name}</h4>
                          {item.description && <p className="food-item-desc">{item.description}</p>}
                          <p className="food-item-price">{formatLkr(item.price)}</p>
                        </div>
                        <div className="food-item-actions food-item-actions--stack">
                          {isAuthenticated ? (
                            <>
                              <button type="button" className="food-btn food-btn--order" onClick={() => addOne(item._id)}>
                                Order now
                              </button>
                              <input
                                className="food-qty"
                                type="number"
                                min={0}
                                max={99}
                                value={cart[item._id] ?? 0}
                                onChange={(e) => setQty(item._id, e.target.value)}
                                aria-label={`Quantity for ${item.name}`}
                              />
                            </>
                          ) : (
                            <Link className="food-btn food-btn--order" to={`/account/login?returnTo=${returnToRestaurantEncoded}`}>
                              Sign in
                            </Link>
                          )}
                        </div>
                      </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>

            {isAuthenticated && (
              <aside className="food-cart" aria-labelledby="food-cart-heading">
                <h2 id="food-cart-heading" className="food-section-title">
                  Your order
                </h2>
                <p className="food-cart-total">
                  Subtotal: <strong>{formatLkr(cartTotal)}</strong>
                </p>
                {fromBookFlow ? (
                  <>
                    <p className="food-book-flow-hint">Charged to your room folio. You&apos;ll return to your booking next.</p>
                    <button
                      type="button"
                      className="food-btn food-btn--primary food-btn--block"
                      disabled={cartTotal === 0 || submitting}
                      onClick={() => {
                        setErr("");
                        submitOrder("room_bill");
                      }}
                    >
                      {submitting ? "Placing…" : "Place order & return to booking"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="food-btn food-btn--primary food-btn--block"
                      disabled={cartTotal === 0 || submitting}
                      onClick={() => {
                        setErr("");
                        setSuccessMsg("");
                        setRoomBillProfileHint(false);
                        setPaymentGatewayOpen(false);
                        setGatewayErr("");
                        setCheckoutOpen(true);
                      }}
                    >
                      Checkout
                    </button>
                    {roomBillProfileHint && (
                      <p className="food-bill-profile-hint">
                        This order was added to your room bill.{" "}
                        <Link to="/account/profile#restaurant-bill">Open My profile</Link> to see the total you will pay at
                        reception.
                      </p>
                    )}
                  </>
                )}

                <h3 className="food-subheading">Your recent food orders</h3>
                {loadingOrders && <p className="food-muted">Loading orders…</p>}
                {!loadingOrders && orders.length === 0 && <p className="food-muted">No orders yet.</p>}
                {!loadingOrders && orders.length > 0 && (
                  <ul className="food-order-history">
                    {orders.map((o) => (
                      <li key={o._id} className="food-order-card">
                        <div className="food-order-meta">
                          <span>{new Date(o.createdAt).toLocaleString()}</span>
                          <span className="food-order-status">{o.orderStatus}</span>
                        </div>
                        <ul className="food-order-lines">
                          {(o.lines || []).map((ln, i) => (
                            <li key={i}>
                              {ln.quantity}× {ln.name}
                            </li>
                          ))}
                        </ul>
                        <p className="food-order-pay">
                          {formatLkr(o.subtotal)} · {o.paymentMethod.replace("_", " ")} ·{" "}
                          {o.paymentStatus === "paid" ? "Paid" : "Pending"}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </aside>
            )}
          </div>
        )}
      </main>

      {checkoutOpen && !fromBookFlow && (
        <div className="food-modal-overlay" role="presentation" onClick={() => !submitting && setCheckoutOpen(false)}>
          <div
            className="food-modal"
            role="dialog"
            aria-labelledby="food-checkout-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="food-checkout-title" className="food-h2">
              How would you like to pay?
            </h2>
            <p className="food-muted">Choose one option. Charges added to your bill are settled at checkout with reception.</p>
            <fieldset className="food-pay-options" disabled={submitting}>
              <label className="food-pay-option">
                <input
                  type="radio"
                  name="pay"
                  value="room_bill"
                  checked={paymentMethod === "room_bill"}
                  onChange={() => setPaymentMethod("room_bill")}
                />
                <span>
                  <strong>Add to room bill</strong>
                  <span className="food-pay-hint">Posted to your folio; settled at the front desk.</span>
                </span>
              </label>
              <label className="food-pay-option">
                <input
                  type="radio"
                  name="pay"
                  value="online"
                  checked={paymentMethod === "online"}
                  onChange={() => setPaymentMethod("online")}
                />
                <span>
                  <strong>Pay online</strong>
                  <span className="food-pay-hint">Simulated payment — your order is marked paid immediately.</span>
                </span>
              </label>
            </fieldset>
            <p className="food-cart-total">Total due: {formatLkr(cartTotal)}</p>
            <div className="food-modal-actions">
              <button
                type="button"
                className="food-btn food-btn--ghost"
                disabled={submitting}
                onClick={() => {
                  setCheckoutOpen(false);
                  setPaymentGatewayOpen(false);
                  setGatewayErr("");
                }}
              >
                Cancel
              </button>
              <button type="button" className="food-btn food-btn--primary" disabled={submitting} onClick={startCheckoutPlacement}>
                {submitting ? "Placing…" : "Place order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentGatewayOpen && checkoutOpen && !fromBookFlow && (
        <div className="food-modal-overlay" role="presentation" onClick={() => !submitting && setPaymentGatewayOpen(false)}>
          <div className="food-modal" role="dialog" aria-labelledby="food-gateway-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="food-gateway-title" className="food-h2">
              Online payment gateway
            </h2>
            <p className="food-muted">Enter your card and bank details to complete payment.</p>
            {gatewayErr && <p className="food-err">{gatewayErr}</p>}
            <div className="food-gateway-grid">
              <label className="food-gateway-field">
                Cardholder name
                <input
                  type="text"
                  value={gatewayForm.cardholderName}
                  onChange={(e) => updateGatewayField("cardholderName", e.target.value)}
                  disabled={submitting}
                  placeholder="e.g. Neth Perera"
                  autoComplete="cc-name"
                />
              </label>
              <label className="food-gateway-field">
                Card number
                <input
                  type="text"
                  value={gatewayForm.cardNumber}
                  onChange={(e) => updateGatewayField("cardNumber", e.target.value)}
                  disabled={submitting}
                  placeholder="1234 5678 9012 3456"
                  inputMode="numeric"
                  autoComplete="cc-number"
                />
              </label>
              <label className="food-gateway-field">
                Expiry (MM/YY)
                <input
                  type="text"
                  value={gatewayForm.expiry}
                  onChange={(e) => updateGatewayField("expiry", e.target.value)}
                  disabled={submitting}
                  placeholder="08/29"
                  inputMode="numeric"
                  autoComplete="cc-exp"
                />
              </label>
              <label className="food-gateway-field">
                CVV
                <input
                  type="password"
                  value={gatewayForm.cvv}
                  onChange={(e) => updateGatewayField("cvv", e.target.value)}
                  disabled={submitting}
                  placeholder="123"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                />
              </label>
              <label className="food-gateway-field">
                Issuing bank
                <input
                  type="text"
                  value={gatewayForm.bankName}
                  onChange={(e) => updateGatewayField("bankName", e.target.value)}
                  disabled={submitting}
                  placeholder="e.g. Commercial Bank"
                />
              </label>
              <label className="food-gateway-field">
                Billing email
                <input
                  type="email"
                  value={gatewayForm.billingEmail}
                  onChange={(e) => updateGatewayField("billingEmail", e.target.value)}
                  disabled={submitting}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </label>
            </div>
            <p className="food-cart-total">Amount: {formatLkr(cartTotal)}</p>
            <div className="food-modal-actions">
              <button
                type="button"
                className="food-btn food-btn--ghost"
                disabled={submitting}
                onClick={() => {
                  setPaymentGatewayOpen(false);
                  setGatewayErr("");
                }}
              >
                Cancel payment
              </button>
              <button
                type="button"
                className="food-btn food-btn--primary"
                disabled={submitting}
                onClick={submitOnlinePayment}
              >
                {submitting ? "Processing…" : "Pay now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
