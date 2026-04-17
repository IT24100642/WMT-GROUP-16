import { useCallback, useEffect, useMemo, useState } from "react";
import { api, parseJson } from "../api/client.js";
import { useStaffAuth } from "../context/StaffAuthContext.jsx";
import "../admin/Panel.css";
import "./ReviewManagement.css";

const CATEGORIES = [
  { value: "room", label: "Rooms" },
  { value: "food", label: "Food" },
  { value: "staff", label: "Staff" },
  { value: "other", label: "Other" },
];

function stars(n) {
  const filled = Number(n) || 0;
  return "\u2605".repeat(filled) + "\u2606".repeat(5 - filled);
}

function categoryLabel(value) {
  return CATEGORIES.find((c) => c.value === value)?.label || value;
}

export default function ReviewManagement() {
  const { token, profile } = useStaffAuth();
  const [reviews, setReviews] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const loadAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr("");
    const [resR, resA] = await Promise.all([
      api("/api/staff-portal/reviews", {}, token),
      api("/api/staff-portal/reviews/analytics", {}, token),
    ]);
    const [dataR, dataA] = await Promise.all([parseJson(resR), parseJson(resA)]);
    if (!resR.ok) {
      setErr(dataR.error || "Could not load reviews");
      setReviews([]);
    } else {
      const list = Array.isArray(dataR) ? dataR : [];
      setReviews(list);
    }
    if (resA.ok) setAnalytics(dataA);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const activeReviews = useMemo(() => reviews.filter((r) => r.status === "active"), [reviews]);

  const maxCategoryCount = useMemo(() => {
    const rows = analytics?.byCategory || [];
    return Math.max(1, ...rows.map((c) => c.count));
  }, [analytics]);

  const volumeLineChart = useMemo(() => {
    const trend = analytics?.trend || [];
    if (!trend.length) return null;
    const counts = trend.map((d) => d.count);
    const maxC = Math.max(1, ...counts);
    const w = 720;
    const h = 240;
    const padL = 44;
    const padR = 20;
    const padT = 28;
    const padB = 44;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;
    const n = trend.length;
    const pts = trend.map((d, i) => {
      const x = n <= 1 ? padL + innerW / 2 : padL + (i / (n - 1)) * innerW;
      const y = padT + innerH - (d.count / maxC) * innerH;
      return { x, y, date: d.date, count: d.count };
    });
    const lineD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("");
    const last = pts[pts.length - 1];
    const first = pts[0];
    const areaD = `${lineD} L${last.x.toFixed(1)},${(padT + innerH).toFixed(1)} L${first.x.toFixed(1)},${(padT + innerH).toFixed(1)} Z`;
    const yTicks = [0, Math.ceil(maxC / 2), maxC];
    return { pts, lineD, areaD, maxC, w, h, padL, padR, padT, padB, innerW, innerH, yTicks };
  }, [analytics?.trend]);

  async function patchReview(id, payload) {
    setErr("");
    const res = await api(`/api/staff-portal/reviews/${id}`, { method: "PATCH", body: JSON.stringify(payload) }, token);
    const data = await parseJson(res);
    if (!res.ok) {
      setErr(data.error || "Could not update review");
      return;
    }
    setReviews((prev) => prev.map((r) => (r._id === id ? data : r)));
    await loadAll();
  }

  if (profile?.roleName !== "Review Manager") {
    return <p className="panel-err">Review Manager access required.</p>;
  }

  const aiml = analytics?.aiml;

  return (
    <div className="panel-page panel-page--wide review-page">
      <h1 className="panel-title">Review management</h1>
      <p className="panel-muted review-manager-scope-hint">
        You can hide or restore reviews on the public hotel site. Guest text, star rating, and category are not editable here.
      </p>
      {err && <p className="panel-err">{err}</p>}
      {loading && <p className="panel-muted">Loading review dashboard…</p>}

      {analytics && (
        <section className="review-aiml-dashboard" aria-label="AIML review analytics">
          <div className="review-glass-grid review-glass-grid--kpis">
            <div className="review-glass-card">
              <strong>{analytics.total}</strong>
              <span>Total reviews</span>
            </div>
            <div className="review-glass-card">
              <strong>{analytics.activeCount}</strong>
              <span>Active</span>
            </div>
            <div className="review-glass-card">
              <strong>{analytics.avgRating}</strong>
              <span>Avg rating</span>
            </div>
            <div className="review-glass-card review-glass-card--accent">
              <strong>{aiml?.foodReviewsCount ?? 0}</strong>
              <span>Food reviews</span>
            </div>
            <div className="review-glass-card review-glass-card--accent">
              <strong>{aiml?.roomReviewsCount ?? 0}</strong>
              <span>Rooms reviews</span>
            </div>
            <div className="review-glass-card">
              <strong>{aiml?.staffReviewsCount ?? 0}</strong>
              <span>Staff reviews</span>
            </div>
            <div className="review-glass-card">
              <strong>{aiml?.otherReviewsCount ?? 0}</strong>
              <span>Other</span>
            </div>
            <div className="review-glass-card">
              <strong>{analytics.removedCount}</strong>
              <span>Removed</span>
            </div>
          </div>

          <div className="review-charts-row">
            <div className="review-glass-panel review-category-chart-panel">
              <h3 className="review-glass-heading">Reviews by category</h3>
              <div className="review-bar-chart">
                {(analytics.byCategory || []).map((c) => (
                  <div className="review-bar-row" key={c.category}>
                    <span className="review-bar-label">{categoryLabel(c.category)}</span>
                    <div className="review-bar-track">
                      <div className="review-bar-fill" style={{ width: `${(c.count / maxCategoryCount) * 100}%` }} />
                    </div>
                    <span className="review-bar-count">{c.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="review-glass-panel review-volume-chart-panel">
            <span className="review-chart-badge">Review volume</span>
            <h3 className="review-glass-heading">30-day trend (active reviews)</h3>
            {volumeLineChart ? (
              <div className="review-line-chart-wrap">
                <svg
                  className="review-line-chart"
                  viewBox={`0 0 ${volumeLineChart.w} ${volumeLineChart.h}`}
                  preserveAspectRatio="xMidYMid meet"
                  role="img"
                  aria-label="Line chart of daily review counts for the last 30 days"
                >
                  <defs>
                    <linearGradient id="reviewVolumeAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgb(201, 169, 98)" stopOpacity="0.42" />
                      <stop offset="100%" stopColor="rgb(201, 169, 98)" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  {volumeLineChart.yTicks.map((tick) => {
                    const y =
                      volumeLineChart.padT +
                      volumeLineChart.innerH -
                      (tick / volumeLineChart.maxC) * volumeLineChart.innerH;
                    return (
                      <g key={`grid-${tick}`}>
                        <line
                          className="review-line-chart-grid"
                          x1={volumeLineChart.padL}
                          y1={y}
                          x2={volumeLineChart.padL + volumeLineChart.innerW}
                          y2={y}
                        />
                        <text className="review-line-chart-axis" x={volumeLineChart.padL - 8} y={y + 4} textAnchor="end">
                          {tick}
                        </text>
                      </g>
                    );
                  })}
                  <path className="review-line-chart-area" d={volumeLineChart.areaD} fill="url(#reviewVolumeAreaGrad)" />
                  <path className="review-line-chart-line" d={volumeLineChart.lineD} fill="none" />
                  {volumeLineChart.pts.map((p) => (
                    <circle key={p.date} className="review-line-chart-dot" cx={p.x} cy={p.y} r={4} data-date={p.date}>
                      <title>{`${p.date}: ${p.count} reviews`}</title>
                    </circle>
                  ))}
                  {volumeLineChart.pts.length > 0 && (
                    <text
                      className="review-line-chart-axis review-line-chart-xlabel"
                      x={volumeLineChart.pts[0].x}
                      y={volumeLineChart.h - 12}
                      textAnchor="start"
                    >
                      {volumeLineChart.pts[0].date}
                    </text>
                  )}
                  {volumeLineChart.pts.length > 1 && (
                    <text
                      className="review-line-chart-axis review-line-chart-xlabel"
                      x={volumeLineChart.pts[volumeLineChart.pts.length - 1].x}
                      y={volumeLineChart.h - 12}
                      textAnchor="end"
                    >
                      {volumeLineChart.pts[volumeLineChart.pts.length - 1].date}
                    </text>
                  )}
                </svg>
              </div>
            ) : (
              <p className="panel-muted">No trend data.</p>
            )}
            <p className="review-spark-caption">Daily count of new active reviews · point markers show exact days</p>
            </div>
          </div>
        </section>
      )}

      <h2 className="panel-subtitle">All reviews</h2>
      {!loading && reviews.length === 0 && <p className="panel-muted">No reviews found yet.</p>}
      {!loading && reviews.length > 0 && (
        <div className="review-list">
          {reviews.map((r) => (
            <article className={`review-admin-card review-admin-card--${r.status}`} key={r._id}>
              <header className="review-admin-head">
                <strong>Guest #{r.customerNumber}</strong>
                <span>{new Date(r.createdAt).toLocaleString()}</span>
              </header>
              <p>{r.text}</p>
              <div className="review-admin-meta">
                <span>{stars(r.rating)}</span>
                <span>Category: {categoryLabel(r.category)}</span>
                <span>Status: {r.status}</span>
              </div>
              {r.adminReply ? (
                <p className="review-saved-reply review-saved-reply--readonly">
                  Published reply
                  {r.adminReplyAt ? ` · ${new Date(r.adminReplyAt).toLocaleString()}` : ""}
                  {r.adminReplyByStaff?.name ? ` · ${r.adminReplyByStaff.name}` : ""}: {r.adminReply}
                </p>
              ) : null}
              <div className="review-admin-actions">
                {r.status === "active" ? (
                  <button
                    type="button"
                    className="review-danger"
                    onClick={() => patchReview(r._id, { status: "removed", removedReason: "Inappropriate or duplicate" })}
                  >
                    Remove review
                  </button>
                ) : (
                  <button type="button" onClick={() => patchReview(r._id, { status: "active" })}>
                    Restore review
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="panel-muted">Active reviews available publicly: {activeReviews.length}</p>
    </div>
  );
}
