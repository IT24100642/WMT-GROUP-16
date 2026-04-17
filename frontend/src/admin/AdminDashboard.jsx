import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, parseJson } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import "./Panel.css";
import "./AdminDashboard.css";

function buildMonthGrid(baseDate = new Date()) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay(); // 0-6
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return { year, month, cells };
}

export default function AdminDashboard() {
  const { token, changePassword } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [summary, setSummary] = useState(null);
  const [issueRows, setIssueRows] = useState([]);
  const [assignableStaff, setAssignableStaff] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [curPwd, setCurPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");
  const [pwdErr, setPwdErr] = useState("");
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const today = new Date();
  const cal = buildMonthGrid(today);
  const monthLabel = today.toLocaleString([], { month: "long", year: "numeric" });

  const load = useCallback(async () => {
    setLoadError("");
    const [resS, resI] = await Promise.all([
      api("/api/reports/summary", {}, token),
      api("/api/admin/issues", {}, token),
    ]);
    const dataS = await parseJson(resS);
    const dataI = await parseJson(resI);
    if (!resS.ok) {
      setLoadError(dataS.error || "Could not load summary");
      return;
    }
    setSummary(dataS);
    if (resI.ok) {
      setIssueRows(Array.isArray(dataI.issues) ? dataI.issues : []);
      setAssignableStaff(Array.isArray(dataI.assignableStaff) ? dataI.assignableStaff : []);
    } else {
      setLoadError(dataI.error || "Could not load issues");
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get("openPassword") === "1") {
      setPasswordModalOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("openPassword");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  async function handlePassword(e) {
    e.preventDefault();
    setPwdMsg("");
    setPwdErr("");
    try {
      await changePassword(curPwd, newPwd);
      setPwdMsg("Password updated.");
      setCurPwd("");
      setNewPwd("");
      return true;
    } catch (err) {
      setPwdErr(err.message || "Update failed");
      return false;
    }
  }

  async function patchIssue(id, payload) {
    const res = await api(`/api/admin/issues/${id}`, { method: "PATCH", body: JSON.stringify(payload) }, token);
    const data = await parseJson(res);
    if (!res.ok) {
      setLoadError(data.error || "Could not update issue");
      return;
    }
    await load();
  }

  const issueSummary = {
    submitted: issueRows.filter((i) => i.status === "submitted").length,
    assigned: issueRows.filter((i) => i.status === "assigned").length,
    inProgress: issueRows.filter((i) => i.status === "in_progress").length,
    resolved: issueRows.filter((i) => i.status === "resolved").length,
  };
  const openIssues = issueRows.filter((i) => i.status !== "resolved");
  const recentIssues = issueRows.slice(0, 6);

  return (
    <div className="panel-page admin-dashboard-page">
      <div className="admin-dashboard-topbar">
        <div>
          <h1 className="panel-title">Dashboard</h1>
          <p className="panel-intro">
            Live hotel operations snapshot, issue triage, and workforce health in one view.
          </p>
        </div>
        <div className="admin-dashboard-search">
          <input type="search" placeholder="Search anything" aria-label="Search anything" />
        </div>
      </div>

      {loadError && <p className="panel-err">{loadError}</p>}

      {summary && (
        <>
        <div className="admin-kpi-grid">
          <div className="admin-kpi-card admin-kpi-card--blue">
            <p>Active staff</p>
            <strong>{summary.staff.active}</strong>
            <span>{summary.staff.total} records</span>
          </div>
          <div className="admin-kpi-card admin-kpi-card--orange">
            <p>Role types</p>
            <strong>{summary.roles}</strong>
            <span>Across portal operations</span>
          </div>
          <div className="admin-kpi-card admin-kpi-card--purple">
            <p>Scheduled shifts</p>
            <strong>{summary.shifts}</strong>
            <span>Current shift plan</span>
          </div>
          <div className="admin-kpi-card admin-kpi-card--teal">
            <p>Open issues</p>
            <strong>{openIssues.length}</strong>
            <span>{issueSummary.resolved} resolved</span>
          </div>
        </div>
        <div className="admin-dashboard-grid">
          <section className="admin-widget admin-widget--chart">
            <div className="admin-widget-head">
              <h2>Operations trend</h2>
              <span>Daily pulse</span>
            </div>
            <div className="admin-mini-chart" aria-hidden>
              <div style={{ height: "38%" }} />
              <div style={{ height: "55%" }} />
              <div style={{ height: "48%" }} />
              <div style={{ height: "64%" }} />
              <div style={{ height: "58%" }} />
              <div style={{ height: "71%" }} />
              <div style={{ height: "52%" }} />
              <div style={{ height: "69%" }} />
              <div style={{ height: "61%" }} />
              <div style={{ height: "76%" }} />
            </div>
            <p className="panel-muted">Trend visualization keeps admin decisions quick and data-driven.</p>
          </section>

          <section className="admin-widget">
            <div className="admin-widget-head">
              <h2>Issue status split</h2>
              <span>Current queue</span>
            </div>
            <ul className="admin-status-list">
              <li><span>Submitted</span><strong>{issueSummary.submitted}</strong></li>
              <li><span>Assigned</span><strong>{issueSummary.assigned}</strong></li>
              <li><span>In progress</span><strong>{issueSummary.inProgress}</strong></li>
              <li><span>Resolved</span><strong>{issueSummary.resolved}</strong></li>
            </ul>
          </section>

          <section className="admin-widget">
            <div className="admin-widget-head">
              <h2>Recent guests/issues</h2>
              <span>Latest activity</span>
            </div>
            {recentIssues.length === 0 ? (
              <p className="panel-muted">No issue reports yet.</p>
            ) : (
              <ul className="admin-guest-list">
                {recentIssues.map((i) => (
                  <li key={i._id}>
                    <div className="admin-guest-avatar">{String(i.customer?.customerNumber || "?")[0]}</div>
                    <div>
                      <strong>Guest #{i.customer?.customerNumber || "—"}</strong>
                      <p>Room {i.room?.roomNumber || "—"} · {i.issueType}</p>
                    </div>
                    <span className={`admin-issue-badge admin-issue-badge--${i.status}`}>{i.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="admin-widget admin-widget--calendar">
            <div className="admin-widget-head">
              <h2>Calendar</h2>
              <span>{monthLabel}</span>
            </div>
            <div className="admin-calendar-weekdays">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>
            <div className="admin-calendar-grid">
              {cal.cells.map((d, idx) => (
                <div
                  key={idx}
                  className={
                    "admin-calendar-cell" +
                    (d === today.getDate() ? " admin-calendar-cell--today" : "") +
                    (d == null ? " admin-calendar-cell--empty" : "")
                  }
                >
                  {d ?? ""}
                </div>
              ))}
            </div>
          </section>
        </div>
        </>
      )}

      {passwordModalOpen ? (
        <div className="admin-password-modal-overlay" role="presentation" onClick={() => setPasswordModalOpen(false)}>
          <form
            className="admin-password-modal"
            role="dialog"
            aria-labelledby="admin-password-modal-title"
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              const ok = await handlePassword(e);
              if (ok) setPasswordModalOpen(false);
            }}
          >
            <h3 id="admin-password-modal-title">Change administrator password</h3>
            <input
              type="password"
              placeholder="Current password"
              value={curPwd}
              onChange={(e) => setCurPwd(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="New password (min 6 characters)"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              minLength={6}
              required
            />
            <div className="admin-password-modal-actions">
              <button type="button" className="btn-ghost-sm" onClick={() => setPasswordModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary-sm">
                Update password
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
