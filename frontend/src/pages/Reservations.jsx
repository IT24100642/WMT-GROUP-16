import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, parseJson } from "../api/client.js";
import { formatLkr } from "../lib/formatLkr.js";
import "./Reservations.css";

function statusClass(status) {
  const s = (status || "").toLowerCase();
  return `res-room__status res-room__status--${s}`;
}

function sortByRoomNumber(a, b) {
  return Number(a.roomNumber) - Number(b.roomNumber);
}

export default function Reservations() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      const res = await api("/api/public/rooms");
      const data = await parseJson(res);
      if (cancelled) return;
      if (!res.ok) {
        setErr(data.error || "Could not load rooms");
        setRooms([]);
      } else {
        setRooms(Array.isArray(data) ? data : []);
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
      <main className="res-main res-main--wide">
        <div className="res-title-row">
          <h1>Reservations</h1>
          <Link to="/offers" className="res-offers-btn">
            Offers
          </Link>
        </div>

        {loading && <p className="res-muted">Loading rooms…</p>}
        {err && <p className="res-err">{err}</p>}

        {!loading && !err && rooms.length === 0 && (
          <p className="res-muted">No rooms are listed yet. Our room manager will publish inventory soon.</p>
        )}

        {!loading && rooms.length > 0 && (
          <ul className="res-room-grid">
            {[...rooms].sort(sortByRoomNumber).map((r) => {
              const photos = r.photos || [];
              return (
              <li key={r._id} className="res-room-card">
                <div className="res-room__gallery" role="group" aria-label={`Photos for room ${r.roomNumber}`}>
                  {photos.length > 0 ? (
                    <>
                      <div className="res-room__gallery-main">
                        <img src={photos[0].url} alt={`Room ${r.roomNumber}`} loading="lazy" />
                      </div>
                      {photos.length > 1 && (
                        <div className="res-room__gallery-thumbs">
                          {photos.slice(1).map((ph) => (
                            <img key={ph._id} src={ph.url} alt="" loading="lazy" />
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="res-room__gallery-placeholder">Photos coming soon</div>
                  )}
                </div>
                <div className="res-room__head">
                  <span className="res-room__number">Room {r.roomNumber}</span>
                  <span className={statusClass(r.status)}>{r.status}</span>
                </div>
                <p className="res-room__type">{r.roomType}</p>
                {(r.variant || typeof r.airConditioned === "boolean") && (
                  <p className="res-room__variant">
                    {r.variant ? <span className="res-room__variant-name">{r.variant}</span> : null}
                    {r.variant && typeof r.airConditioned === "boolean" ? (
                      <span className="res-room__variant-dot"> · </span>
                    ) : null}
                    {typeof r.airConditioned === "boolean" ? (
                      <span>{r.airConditioned ? "Air conditioned" : "Non-AC"}</span>
                    ) : null}
                  </p>
                )}
                {r.description && <p className="res-room__desc">{r.description}</p>}
                <div className="res-room__meta">
                  <span>Floor {r.floor}</span>
                  <span>·</span>
                  <span>Up to {r.capacity} guests</span>
                </div>
                <p className="res-room__price">
                  From <strong>{formatLkr(r.basePricePerNight)}</strong> / night
                </p>
                <Link to={`/book?roomId=${encodeURIComponent(r._id)}`} className="res-book-now">
                  Book now
                </Link>
              </li>
            );
            })}
          </ul>
        )}

        <Link to="/" className="res-cta">
          Back to home
        </Link>
      </main>
    </div>
  );
}
