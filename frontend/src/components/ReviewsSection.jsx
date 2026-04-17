import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, parseJson } from "../api/client.js";
import { useCustomerAuth } from "../context/CustomerAuthContext.jsx";

function stars(n) {
  return "★".repeat(Number(n) || 0) + "☆".repeat(5 - (Number(n) || 0));
}

export default function ReviewsSection() {
  const navigate = useNavigate();
  const { ready, isAuthenticated, token, user } = useCustomerAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editReview, setEditReview] = useState(null);
  const [form, setForm] = useState({ text: "", rating: 1 });
  const [starHover, setStarHover] = useState(0);
  const [busy, setBusy] = useState(false);

  async function loadReviews() {
    const res = await api("/api/public/reviews");
    const data = await parseJson(res);
    if (!res.ok) {
      setError(data.error || "Could not load reviews");
      setReviews([]);
      return;
    }
    setReviews(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      await loadReviews();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!modalOpen) setStarHover(0);
  }, [modalOpen]);

  const ownReviews = useMemo(
    () => reviews.filter((r) => String(r.customer) === String(user?.id)),
    [reviews, user?.id]
  );

  function openCreate() {
    if (!ready || !isAuthenticated) {
      navigate(`/account/login?returnTo=${encodeURIComponent("/")}`);
      return;
    }
    setEditReview(null);
    setForm({ text: "", rating: 1 });
    setModalOpen(true);
  }

  function openEdit(review) {
    setEditReview(review);
    const r = Number(review.rating);
    const rating = Number.isInteger(r) && r >= 1 && r <= 5 ? r : 1;
    setForm({ text: review.text || "", rating });
    setModalOpen(true);
  }

  async function submit() {
    setBusy(true);
    setError("");
    const rating = Number(form.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      setBusy(false);
      setError("Rating must be between 1 and 5 stars.");
      return;
    }
    const payload = editReview
      ? { rating }
      : { text: form.text, rating, category: "other" };
    const path = editReview ? `/api/customer-auth/reviews/${editReview._id}` : "/api/customer-auth/reviews";
    const method = editReview ? "PATCH" : "POST";
    const res = await api(path, { method, body: JSON.stringify(payload) }, token);
    const data = await parseJson(res);
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not save review");
      return;
    }
    setModalOpen(false);
    setEditReview(null);
    await loadReviews();
  }

  async function removeOwnReview(id) {
    setBusy(true);
    setError("");
    const res = await api(`/api/customer-auth/reviews/${id}`, { method: "DELETE" }, token);
    const data = await parseJson(res);
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not delete review");
      return;
    }
    await loadReviews();
  }

  return (
    <section id="testimonials">
      <div className="reveal visible">
        <span className="section-label">Guest Voices</span>
        <h2 className="section-title testimonials-heading">
          Stories from <em>our guests</em>
        </h2>
        <div className="divider" />
      </div>

      {loading && <p>Loading reviews…</p>}
      {error && <p className="portal-login-error">{error}</p>}

      {!loading && (
        <div className="testimonials-grid" id="reviewsGrid">
          {reviews.length === 0 ? (
            <p>No reviews yet. Be the first to share your stay.</p>
          ) : (
            reviews.map((r) => (
              <div className="review-card reveal visible" key={r._id}>
                <div className="review-actions">
                  {String(r.customer) === String(user?.id) && (
                    <>
                      <button type="button" className="btn-review-action edit" onClick={() => openEdit(r)}>
                        ✎ Edit stars
                      </button>
                      <button type="button" className="btn-review-action delete" onClick={() => removeOwnReview(r._id)} disabled={busy}>
                        ✕ Delete
                      </button>
                    </>
                  )}
                </div>
                <div className="stars">{stars(r.rating)}</div>
                <p className="review-text">"{r.text}"</p>
                {r.adminReply ? (
                  <p className="review-admin-reply" style={{ fontSize: "0.9rem", opacity: 0.9, marginTop: 8 }}>
                    <strong>Maison Velour:</strong> {r.adminReply}
                  </p>
                ) : null}
                <div className="reviewer">
                  <div className="reviewer-avatar">{String(r.customerEmail || "?")[0]?.toUpperCase()}</div>
                  <div className="reviewer-info">
                    <strong>Guest #{r.customerNumber}</strong>
                    <span>Verified guest review</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <div className="add-review-wrap reveal visible">
        <button type="button" className="btn-add-review" onClick={openCreate}>
          + Share Your Experience
        </button>
        <span className="add-review-note">
          {isAuthenticated ? `You have ${ownReviews.length} review(s)` : "Sign in required to submit a review"}
        </span>
      </div>

      {modalOpen && (
        <div className="modal-overlay open" role="dialog" aria-modal="true">
          <div className="modal">
            <button type="button" className="modal-close" onClick={() => setModalOpen(false)} aria-label="Close">
              ×
            </button>
            <h3>{editReview ? "Edit your review" : "Share your stay"}</h3>
            <div className="form-group">
              <label id="review-rating-label">Rating</label>
              <div
                className="review-form-star-row"
                role="group"
                aria-labelledby="review-rating-label"
                aria-describedby="review-rating-hint"
              >
                {[1, 2, 3, 4, 5].map((n) => {
                  const preview = starHover > 0 ? starHover : form.rating;
                  const filled = n <= preview;
                  return (
                    <button
                      key={n}
                      type="button"
                      className={`review-form-star-btn${filled ? " is-on" : ""}`}
                      onMouseEnter={() => setStarHover(n)}
                      onMouseLeave={() => setStarHover(0)}
                      onClick={() => setForm((p) => ({ ...p, rating: n }))}
                      aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    >
                      ★
                    </button>
                  );
                })}
              </div>
              <p id="review-rating-hint" className="review-form-rating-hint">
                Tap the stars to rate from 1 to 5.
              </p>
            </div>
            {!editReview ? (
              <div className="form-group">
                <label>Your Review</label>
                <textarea
                  rows={4}
                  value={form.text}
                  onChange={(e) => setForm((p) => ({ ...p, text: e.target.value }))}
                  placeholder="Tell us about your experience…"
                />
              </div>
            ) : (
              <p className="portal-login-hint" style={{ marginTop: -6, marginBottom: 8 }}>
                After posting, you can only edit the star rating.
              </p>
            )}
            <button type="button" className="btn-submit" onClick={submit} disabled={busy}>
              {busy ? "Saving…" : editReview ? "Save changes" : "Submit review"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
