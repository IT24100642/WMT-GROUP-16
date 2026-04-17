import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  consumeFoodDuringBookingSuccessFlag,
  consumeResumeBookingModalFlag,
  loadBookingDraft,
} from "../lib/bookingDraftStorage.js";
import { api, parseJson } from "../api/client.js";
import { useCustomerAuth } from "../context/CustomerAuthContext.jsx";
import BookingFormModal from "../components/BookingFormModal.jsx";
import "./Reservations.css";
import "./BookPage.css";

export default function BookPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { ready, isAuthenticated, user, logout, token } = useCustomerAuth();
  const roomId = searchParams.get("roomId");
  const offerId = searchParams.get("offerId");
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(Boolean(roomId || offerId));
  const [err, setErr] = useState("");
  const [modalOpen, setModalOpen] = useState(true);
  const [bookingDone, setBookingDone] = useState(false);
  const [restoredDraft, setRestoredDraft] = useState(null);
  const [foodDuringBookingBanner, setFoodDuringBookingBanner] = useState(false);

  const hasSelection = Boolean(roomId || offerId);

  useEffect(() => {
    if (!ready || !hasSelection) return;
    if (!isAuthenticated) {
      const q = searchParams.toString();
      navigate(`/account/login?returnTo=${encodeURIComponent(`/book?${q}`)}`, { replace: true });
    }
  }, [ready, hasSelection, isAuthenticated, navigate, searchParams]);

  useEffect(() => {
    if (!roomId && !offerId) {
      setLoading(false);
      setDetail(null);
      setErr("");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        if (roomId) {
          const res = await api("/api/public/rooms");
          const data = await parseJson(res);
          if (cancelled) return;
          if (!res.ok) throw new Error(data.error || "Could not load room");
          const list = Array.isArray(data) ? data : [];
          const room = list.find((x) => x._id === roomId);
          if (!room) throw new Error("Room not found");
          setDetail({ type: "room", room });
        } else {
          const res = await api("/api/public/offers");
          const data = await parseJson(res);
          if (cancelled) return;
          if (!res.ok) throw new Error(data.error || "Could not load offer");
          const list = Array.isArray(data) ? data : [];
          const offer = list.find((x) => x._id === offerId);
          if (!offer) throw new Error("Offer not found");
          setDetail({ type: "offer", offer });
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e.message || "Something went wrong");
          setDetail(null);
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId, offerId]);

  useEffect(() => {
    if (consumeFoodDuringBookingSuccessFlag()) {
      setFoodDuringBookingBanner(true);
    }
  }, []);

  useEffect(() => {
    if (!detail || bookingDone) return;
    if (!consumeResumeBookingModalFlag()) return;
    const draft = loadBookingDraft();
    if (!draft) return;
    const matchRoom = roomId && draft.roomId === roomId;
    const matchOffer = offerId && draft.offerId === offerId;
    if (!matchRoom && !matchOffer) return;
    setRestoredDraft(draft);
    setModalOpen(true);
    setBookingDone(false);
  }, [detail, roomId, offerId, bookingDone]);

  const showBookContent = hasSelection && ready && isAuthenticated;
  const showModal = showBookContent && !loading && !err && detail && modalOpen && !bookingDone;

  return (
    <div className="reservations-page">
      <header className="res-header">
        <Link to="/" className="res-back">
          ← Maison Velour
        </Link>
      </header>
      <main className="res-main res-main--wide book-page-main">
        <h1>Book now</h1>

        {user && (
          <div className="book-page-account">
            <p className="book-page-account-line">
              Signed in as <strong>{user.email}</strong>
              <span className="book-page-guest-id"> · Guest ID #{user.customerNumber}</span>
            </p>
            <button
              type="button"
              className="book-page-signout"
              onClick={async () => {
                const r = await logout();
                if (!r.ok) {
                  window.alert(
                    [
                      "You cannot sign out until bills are settled and, if you were checked in, reception has checked you out.",
                      "Open My profile to pay balances and settle restaurant charges.",
                      "",
                      ...(r.reasons || []),
                    ].join("\n")
                  );
                }
              }}
            >
              Sign out
            </button>
          </div>
        )}

        {!hasSelection && (
          <p className="res-muted">
            Select a room on the reservations page or an offer on the offers page, then use <strong>Book now</strong>{" "}
            there.
          </p>
        )}

        {hasSelection && !ready && <p className="res-muted">Checking your session…</p>}

        {showBookContent && loading && <p className="res-muted">Loading…</p>}
        {showBookContent && err && <p className="res-err">{err}</p>}

        {bookingDone && (
          <div className="book-page-success">
            <p className="book-page-lead">
              <strong>Reservation submitted.</strong> Your booking appears under{" "}
              <Link to="/account/profile#my-bookings">My bookings</Link> in your profile. The compulsory advance was
              processed in the booking step; the remaining balance is due at check-in.
            </p>
            <button
              type="button"
              className="res-cta"
              onClick={() => {
                setBookingDone(false);
                setModalOpen(true);
              }}
            >
              New booking for this room / offer
            </button>
          </div>
        )}

        {foodDuringBookingBanner && (
          <p className="book-page-food-return" role="status">
            Your restaurant order was added to your room bill. Complete your room booking below.
            <button type="button" className="book-page-food-return-dismiss" onClick={() => setFoodDuringBookingBanner(false)}>
              Dismiss
            </button>
          </p>
        )}

        {showBookContent && !loading && !err && detail && !bookingDone && (
          <p className="res-muted book-page-note">
            Complete the booking form below. When you confirm, the <strong>LKR 5,000</strong> advance is charged first
            (demo flow), then your reservation is sent; the rest is due at the hotel.
          </p>
        )}

        {showModal && token && (
          <BookingFormModal
            detail={detail}
            token={token}
            defaultEmail={user?.email}
            initialDraft={restoredDraft}
            onDraftConsumed={() => setRestoredDraft(null)}
            onClose={() => setModalOpen(false)}
            onSuccess={() => {
              setBookingDone(true);
              setModalOpen(false);
              setFoodDuringBookingBanner(false);
            }}
          />
        )}

        {showBookContent && !loading && !err && detail && !bookingDone && !modalOpen && (
          <p className="res-muted">
            <button type="button" className="book-page-reopen" onClick={() => setModalOpen(true)}>
              Open booking form
            </button>
          </p>
        )}

        <div className="book-page-actions">
          <Link to="/reservations" className="res-cta res-cta--ghost">
            Browse rooms
          </Link>
          <Link to="/offers" className="res-cta res-cta--ghost">
            Browse offers
          </Link>
          <Link to="/" className="res-cta">
            Home
          </Link>
        </div>
      </main>
    </div>
  );
}
