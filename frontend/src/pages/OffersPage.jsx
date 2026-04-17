import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, parseJson } from "../api/client.js";
import { formatLkr } from "../lib/formatLkr.js";
import "./Reservations.css";
import "./OffersPage.css";

export default function OffersPage() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      const res = await api("/api/public/offers");
      const data = await parseJson(res);
      if (cancelled) return;
      if (!res.ok) {
        setErr(data.error || "Could not load offers");
        setOffers([]);
      } else {
        setOffers(Array.isArray(data) ? data : []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="reservations-page">
      <header className="res-header">
        <Link to="/" className="res-back">
          ← Maison Velour
        </Link>
      </header>
      <main className="res-main res-main--wide offers-page-main">
        <div className="offers-page-title-row">
          <h1>Offers</h1>
          <Link to="/reservations" className="res-offers-btn">
            View rooms
          </Link>
        </div>
        <p className="res-muted offers-page-intro">
          Multi-room packages from our room team. Mention an offer when you reserve or ask at the front desk.
        </p>

        {loading && <p className="res-muted">Loading offers…</p>}
        {err && <p className="res-err">{err}</p>}

        {!loading && !err && offers.length === 0 && (
          <p className="res-muted">No active offers at the moment. Check back soon.</p>
        )}

        {!loading && offers.length > 0 && (
          <ul className="offers-page-grid">
            {offers.map((o) => (
              <li key={o._id} className="res-offer-card">
                <div className="res-offer-card__head">
                  <h2 className="res-offer-card__title">{o.title}</h2>
                  {o.packagePrice > 0 && (
                    <span className="res-offer-card__price">{formatLkr(o.packagePrice)}</span>
                  )}
                </div>
                {o.description && <p className="res-offer-card__desc">{o.description}</p>}
                <p className="res-offer-card__rooms-label">Rooms in this offer</p>
                <ul className="res-offer-card__rooms">
                  {(o.rooms || []).map((r) => (
                    <li key={r._id}>
                      <strong>Room {r.roomNumber}</strong>
                      <span className="res-offer-card__room-meta">
                        {" "}
                        · {r.variant}
                        {r.roomType ? ` · ${r.roomType}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link to={`/book?offerId=${encodeURIComponent(o._id)}`} className="res-book-now res-book-now--in-offer">
                  Book now
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="offers-page-footer-cta">
          <Link to="/reservations" className="res-cta res-cta--ghost">
            Back to reservations
          </Link>
          <Link to="/" className="res-cta">
            Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}
