import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, parseJson } from "../api/client.js";
import { clearBookingDraft, loadBookingDraft, saveBookingDraft } from "../lib/bookingDraftStorage.js";
import { formatLkr } from "../lib/formatLkr.js";
import { processAdvancePayment } from "../lib/advancePayment.js";
import { validateCustomerPhone } from "../lib/customerValidation.js";
import {
  ADVANCE_LKR,
  MAX_STAY_NIGHTS,
  computeBookingTotals,
  defaultCheckout,
  maxCheckoutDateStr,
  nightsBetween,
} from "../lib/bookingPricing.js";
import "./BookingFormModal.css";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function BookingFormModal({ detail, token, defaultEmail, initialDraft, onDraftConsumed, onClose, onSuccess }) {
  const navigate = useNavigate();
  const draftAppliedRef = useRef(false);
  const bookingType = detail?.type;
  const room = detail?.type === "room" ? detail.room : null;
  const offer = detail?.type === "offer" ? detail.offer : null;

  const [checkIn, setCheckIn] = useState(todayStr());
  const [checkOut, setCheckOut] = useState(() => defaultCheckout(todayStr()));
  const [fullName, setFullName] = useState("");
  const [contactEmail, setContactEmail] = useState(defaultEmail || "");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [mealsAddLater, setMealsAddLater] = useState(false);
  const [specialRequests, setSpecialRequests] = useState("");
  const [advanceAck, setAdvanceAck] = useState(false);
  const [advancePaymentMethod, setAdvancePaymentMethod] = useState("online");
  const [showCardGateway, setShowCardGateway] = useState(false);
  const [pendingBookingBody, setPendingBookingBody] = useState(null);
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [restaurantFolioSubtotal, setRestaurantFolioSubtotal] = useState(0);
  const [linkedFoodOrderIds, setLinkedFoodOrderIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setContactEmail(defaultEmail || "");
  }, [defaultEmail]);

  useEffect(() => {
    draftAppliedRef.current = false;
  }, [bookingType, room?._id, offer?._id]);

  useEffect(() => {
    if (draftAppliedRef.current) return;
    const draft = initialDraft || loadBookingDraft();
    if (!draft) return;
    const matchRoom = bookingType === "room" && room?._id && String(draft.roomId) === String(room._id);
    const matchOffer = bookingType === "offer" && offer?._id && String(draft.offerId) === String(offer._id);
    if (!matchRoom && !matchOffer) return;
    draftAppliedRef.current = true;
    if (draft.checkIn) setCheckIn(draft.checkIn);
    if (draft.checkOut) setCheckOut(draft.checkOut);
    if (typeof draft.fullName === "string") setFullName(draft.fullName);
    if (typeof draft.contactEmail === "string") setContactEmail(draft.contactEmail);
    if (typeof draft.phone === "string") setPhone(draft.phone);
    if (typeof draft.address === "string") setAddress(draft.address);
    if (typeof draft.mealsAddLater === "boolean") setMealsAddLater(draft.mealsAddLater);
    if (typeof draft.specialRequests === "string") setSpecialRequests(draft.specialRequests);
    if (typeof draft.advanceAck === "boolean") setAdvanceAck(draft.advanceAck);
    if (typeof draft.advancePaymentMethod === "string") {
      setAdvancePaymentMethod("online");
    }
    setRestaurantFolioSubtotal(Math.round(Number(draft.restaurantFolioSubtotal)) || 0);
    setLinkedFoodOrderIds(Array.isArray(draft.linkedFoodOrderIds) ? draft.linkedFoodOrderIds.map(String) : []);
    if (initialDraft) onDraftConsumed?.();
  }, [initialDraft, bookingType, room?._id, offer?._id, onDraftConsumed]);

  function goToRestaurantWhileBooking() {
    const draft = {
      roomId: bookingType === "room" ? room?._id : undefined,
      offerId: bookingType === "offer" ? offer?._id : undefined,
      checkIn,
      checkOut,
      fullName,
      contactEmail,
      phone,
      address,
      mealsAddLater,
      specialRequests,
      advanceAck,
      advancePaymentMethod,
      restaurantFolioSubtotal,
      linkedFoodOrderIds,
    };
    saveBookingDraft(draft);
    navigate("/restaurant?fromBookFlow=1");
  }

  const minCheckout = useMemo(() => defaultCheckout(checkIn), [checkIn]);
  const maxCheckout = useMemo(() => maxCheckoutDateStr(checkIn), [checkIn]);

  useEffect(() => {
    if (!checkIn || !minCheckout || !maxCheckout) return;
    setCheckOut((prev) => {
      if (!prev || prev <= checkIn) return minCheckout;
      if (prev > maxCheckout) return maxCheckout;
      if (prev < minCheckout) return minCheckout;
      return prev;
    });
  }, [checkIn, minCheckout, maxCheckout]);

  const nights = useMemo(() => nightsBetween(checkIn, checkOut), [checkIn, checkOut]);

  const totals = useMemo(() => {
    if (nights < 1) {
      return { roomSubtotal: 0, mealSubtotal: 0, taxAmount: 0, totalAmount: 0, remainingAmount: 0 };
    }
    return computeBookingTotals({
      bookingType,
      room,
      offer,
      nights,
      breakfast: false,
      lunch: false,
      dinner: false,
    });
  }, [bookingType, room, offer, nights]);

  const folio = Math.max(0, Math.round(Number(restaurantFolioSubtotal)) || 0);
  const grandTotal = useMemo(() => {
    if (nights < 1) return 0;
    return totals.totalAmount + folio;
  }, [nights, totals.totalAmount, folio]);
  const grandRemaining = useMemo(() => Math.max(0, grandTotal - ADVANCE_LKR), [grandTotal]);

  const title =
    bookingType === "room"
      ? `Book Room ${room?.roomNumber}`
      : bookingType === "offer"
        ? `Book offer: ${offer?.title}`
        : "Book";

  const subtitleParts = [];
  if (bookingType === "room" && room?.variant) subtitleParts.push(room.variant);
  if (checkIn && checkOut) {
    try {
      const a = new Date(`${checkIn}T12:00:00`);
      const b = new Date(`${checkOut}T12:00:00`);
      subtitleParts.push(
        `${a.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })} → ${b.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`
      );
    } catch {
      subtitleParts.push(`${checkIn} → ${checkOut}`);
    }
  }
  if (nights > 0) subtitleParts.push(`${nights} night${nights === 1 ? "" : "s"}`);

  function luhnCheck(cardNum) {
    let sum = 0;
    let shouldDouble = false;
    for (let i = cardNum.length - 1; i >= 0; i -= 1) {
      let d = Number(cardNum[i]);
      if (shouldDouble) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
      shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
  }

  function validateCardGatewayFields() {
    const name = cardName.trim();
    const num = cardNumber.replace(/\D/g, "");
    const exp = cardExpiry.trim();
    const cvv = cardCvv.trim();

    if (name.length < 2) return "Cardholder name must be at least 2 characters.";
    if (!/^[a-zA-Z\s.'-]+$/.test(name)) return "Cardholder name contains invalid characters.";
    if (!/^\d{16}$/.test(num)) return "Card number must be exactly 16 digits.";
    if (!luhnCheck(num)) return "Card number is invalid.";
    if (!/^\d{2}\/\d{2}$/.test(exp)) return "Expiry must be in MM/YY format.";
    const [mmRaw, yyRaw] = exp.split("/");
    const mm = Number(mmRaw);
    const yy = Number(yyRaw);
    if (mm < 1 || mm > 12) return "Expiry month must be between 01 and 12.";
    const now = new Date();
    const currentYear = now.getFullYear() % 100;
    const currentMonth = now.getMonth() + 1;
    if (yy < currentYear || (yy === currentYear && mm < currentMonth)) {
      return "Card has expired.";
    }
    if (!/^\d{3,4}$/.test(cvv)) return "CVV must be 3 or 4 digits.";
    return "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!advanceAck) {
      setError(`You must confirm the compulsory advance of ${formatLkr(ADVANCE_LKR)}.`);
      return;
    }
    if (nights < 1) {
      setError("Choose a valid check-in and check-out.");
      return;
    }
    if (nights > MAX_STAY_NIGHTS) {
      setError(`Maximum stay is ${MAX_STAY_NIGHTS} nights. Adjust your check-out date.`);
      return;
    }
    if (!fullName.trim() || !contactEmail.trim()) {
      setError("Full name and email are required.");
      return;
    }
    const phoneCheck = validateCustomerPhone(phone);
    if (phoneCheck.error) {
      setError(phoneCheck.error);
      return;
    }
    if (folio > 0 && linkedFoodOrderIds.length === 0) {
      setError(
        "Restaurant charges are on your bill but food orders are not linked. Open the restaurant again to place your order, or refresh the page."
      );
      return;
    }
    if (folio === 0 && linkedFoodOrderIds.length > 0) {
      setError("Clear your session draft and try again, or add restaurant orders that match the linked list.");
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        checkIn,
        checkOut,
        fullName: fullName.trim(),
        contactEmail: contactEmail.trim(),
        phone: phoneCheck.phone,
        address: address.trim(),
        mealsAddLater,
        specialRequests: specialRequests.trim(),
        advanceAcknowledged: true,
        advancePaymentCompleted: true,
        restaurantFolioSubtotal: folio,
        linkedFoodOrderIds,
      };
      if (bookingType === "room") body.roomId = room._id;
      else body.offerId = offer._id;

      if (advancePaymentMethod === "online") {
        setPendingBookingBody(body);
        setShowCardGateway(true);
        return;
      }

      await processAdvancePayment(ADVANCE_LKR, { method: advancePaymentMethod });
      const res = await api("/api/customer-auth/bookings", { method: "POST", body: JSON.stringify(body) }, token);
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data.error || "Booking failed");
      clearBookingDraft();
      onSuccess?.(data);
    } catch (err) {
      setError(err.message || "Booking failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCardGatewayPay() {
    if (!pendingBookingBody) return;
    const cardErr = validateCardGatewayFields();
    if (cardErr) {
      setError(cardErr);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await processAdvancePayment(ADVANCE_LKR, {
        method: "online",
        cardLast4: cardNumber.replace(/\D/g, "").slice(-4),
      });
      const res = await api("/api/customer-auth/bookings", { method: "POST", body: JSON.stringify(pendingBookingBody) }, token);
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data.error || "Booking failed");
      clearBookingDraft();
      setShowCardGateway(false);
      setPendingBookingBody(null);
      onSuccess?.(data);
    } catch (err) {
      setError(err.message || "Booking failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="booking-modal-overlay" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="booking-modal" role="dialog" aria-labelledby="booking-modal-title">
        <div className="booking-modal__head">
          <div>
            <h2 id="booking-modal-title">{title}</h2>
            <p className="booking-modal__subtitle">{subtitleParts.join(" · ")}</p>
          </div>
          <button type="button" className="booking-modal__close" onClick={() => onClose?.()} aria-label="Close">
            ×
          </button>
        </div>

        <form className="booking-modal__form" onSubmit={handleSubmit}>
          <div className="booking-modal__grid">
            <label className="booking-modal__label">
              Check-in
              <input type="date" value={checkIn} min={todayStr()} onChange={(e) => setCheckIn(e.target.value)} required />
            </label>
            <label className="booking-modal__label">
              Check-out
              <input
                type="date"
                value={checkOut}
                min={minCheckout || undefined}
                max={maxCheckout || undefined}
                onChange={(e) => {
                  let v = e.target.value;
                  if (maxCheckout && v > maxCheckout) v = maxCheckout;
                  if (minCheckout && v && v < minCheckout) v = minCheckout;
                  setCheckOut(v);
                }}
                required
              />
            </label>
          </div>
          <p className="booking-modal__date-hint">
            Check-out is the day you leave. Minimum stay 1 night; maximum <strong>{MAX_STAY_NIGHTS} nights</strong>.
          </p>

          <label className="booking-modal__label">
            Full name <span className="booking-modal__req">*</span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" required />
          </label>
          <label className="booking-modal__label">
            Email <span className="booking-modal__req">*</span>
            <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="you@example.com" required />
          </label>
          <label className="booking-modal__label">
            Phone <span className="booking-modal__req">*</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="0771234567"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={10}
              pattern="[0-9]{10}"
              title="10 digits, numbers only"
              required
            />
            <span className="booking-modal__field-hint">10 digits, numbers only (e.g. local mobile).</span>
          </label>
          <label className="booking-modal__label">
            Address
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="City, Country" />
          </label>

          <fieldset className="booking-modal__meals">
            <legend>Restaurant &amp; meals</legend>
            <p className="booking-modal__meals-intro">
              Open the restaurant to add food to your cart. Your room booking details are saved — after you place your food
              order you&apos;ll come back here automatically to finish the reservation. Food is added to your room folio (no
              payment choice on that step).
            </p>
            <button type="button" className="booking-modal__restaurant-btn" onClick={goToRestaurantWhileBooking}>
              Restaurant — browse menu &amp; order
            </button>
            <label className="booking-modal__check booking-modal__check--later">
              <input type="checkbox" checked={mealsAddLater} onChange={(e) => setMealsAddLater(e.target.checked)} />
              I&apos;ll add or decide on meals later
            </label>
          </fieldset>

          <label className="booking-modal__label">
            Special requests
            <textarea rows={3} value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} placeholder="Any special requirements or preferences…" />
          </label>

          <div className="booking-modal__summary">
            <div className="booking-modal__summary-row">
              <span>
                {nights < 1
                  ? "Room / package (select dates)"
                  : `Room / package (${formatLkr(Math.round(totals.roomSubtotal / nights))} × ${nights} night${nights === 1 ? "" : "s"})`}
              </span>
              <span>{nights < 1 ? "—" : formatLkr(totals.roomSubtotal)}</span>
            </div>
            <div className="booking-modal__summary-row">
              <span>Tax (12%)</span>
              <span>{nights < 1 ? "—" : formatLkr(totals.taxAmount)}</span>
            </div>
            {folio > 0 && (
              <div className="booking-modal__summary-row booking-modal__summary-row--folio">
                <span>Restaurant (room folio)</span>
                <span>{formatLkr(folio)}</span>
              </div>
            )}
            <div className="booking-modal__summary-row booking-modal__summary-row--total">
              <span>Total</span>
              <span>{nights < 1 ? "—" : formatLkr(grandTotal)}</span>
            </div>
            <div className="booking-modal__summary-row booking-modal__summary-row--advance">
              <span>Advance (compulsory)</span>
              <span>{formatLkr(ADVANCE_LKR)}</span>
            </div>
            <div className="booking-modal__summary-row booking-modal__summary-row--remaining">
              <span>Remaining (pay at hotel)</span>
              <span>{nights < 1 ? "—" : formatLkr(grandRemaining)}</span>
            </div>
          </div>

          <label className="booking-modal__label">
            Advance payment method
            <select
              value={advancePaymentMethod}
              onChange={(e) => setAdvancePaymentMethod(e.target.value)}
            >
              <option value="online">Online</option>
            </select>
          </label>

          <label className="booking-modal__check booking-modal__check--advance">
            <input type="checkbox" checked={advanceAck} onChange={(e) => setAdvanceAck(e.target.checked)} />
            I agree to pay the compulsory advance of {formatLkr(ADVANCE_LKR)} to confirm this booking (remaining balance is due at the hotel).
          </label>

          {error && <p className="booking-modal__error">{error}</p>}

          <button type="submit" className="booking-modal__submit" disabled={submitting}>
            {submitting ? "Submitting…" : "Confirm reservation"}
          </button>
        </form>

        {showCardGateway ? (
          <div className="booking-modal__gateway-overlay" role="presentation" onClick={() => !submitting && setShowCardGateway(false)}>
            <div className="booking-modal__gateway" role="dialog" aria-labelledby="card-gateway-title" onClick={(e) => e.stopPropagation()}>
              <h3 id="card-gateway-title">Online payment gateway</h3>
              <p className="booking-modal__gateway-hint">Pay advance {formatLkr(ADVANCE_LKR)} to confirm reservation.</p>
              <label className="booking-modal__label">
                Cardholder name
                <input
                  value={cardName}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^a-zA-Z\s.'-]/g, "");
                    setCardName(clean);
                  }}
                  placeholder="Name on card"
                />
              </label>
              <label className="booking-modal__label">
                Card number
                <input
                  value={cardNumber}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 16);
                    const groups = digits.match(/.{1,4}/g) || [];
                    setCardNumber(groups.join(" "));
                  }}
                  placeholder="1234 5678 9012 3456"
                  inputMode="numeric"
                />
              </label>
              <div className="booking-modal__grid">
                <label className="booking-modal__label">
                  Expiry (MM/YY)
                  <input
                    value={cardExpiry}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
                      const mm = digits.slice(0, 2);
                      const yy = digits.slice(2, 4);
                      setCardExpiry(yy ? `${mm}/${yy}` : mm);
                    }}
                    placeholder="08/28"
                  />
                </label>
                <label className="booking-modal__label">
                  CVV
                  <input value={cardCvv} onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="123" inputMode="numeric" />
                </label>
              </div>
              <div className="booking-modal__gateway-actions">
                <button type="button" className="booking-modal__gateway-cancel" disabled={submitting} onClick={() => setShowCardGateway(false)}>
                  Cancel
                </button>
                <button type="button" className="booking-modal__gateway-pay" disabled={submitting} onClick={handleCardGatewayPay}>
                  {submitting ? "Processing…" : `Pay ${formatLkr(ADVANCE_LKR)} & confirm`}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
