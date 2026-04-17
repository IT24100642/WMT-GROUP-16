import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api, parseJson } from "../api/client.js";
import { useStaffAuth } from "../context/StaffAuthContext.jsx";
import "../admin/Panel.css";

function prettifyStatus(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export default function CustomerManagement() {
  const { token, profile } = useStaffAuth();
  const [rows, setRows] = useState([]);
  const [issues, setIssues] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setErr("");
    const [resC, resI] = await Promise.all([
      api("/api/staff-portal/customers", {}, token),
      api("/api/staff-portal/issues", {}, token),
    ]);
    const dataC = await parseJson(resC);
    const dataI = await parseJson(resI);
    if (!resC.ok) {
      setErr(dataC.error || "Could not load customers");
      setRows([]);
      return;
    }
    if (!resI.ok) {
      setErr(dataI.error || "Could not load issues");
      setIssues([]);
    } else {
      setIssues(Array.isArray(dataI) ? dataI : []);
    }
    setRows(Array.isArray(dataC) ? dataC : []);
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function setActive(customer, active) {
    setErr("");
    const res = await api(
      `/api/staff-portal/customers/${customer._id}`,
      { method: "PATCH", body: JSON.stringify({ active }) },
      token
    );
    const data = await parseJson(res);
    if (!res.ok) {
      setErr(data.error || "Update failed");
      return;
    }
    await load();
  }

  async function setIssueStatus(issue, status) {
    setErr("");
    const res = await api(
      `/api/staff-portal/issues/${issue._id}`,
      { method: "PATCH", body: JSON.stringify({ status }) },
      token
    );
    const data = await parseJson(res);
    if (!res.ok) {
      setErr(data.error || "Issue update failed");
      return;
    }
    await load();
  }

  if (profile?.roleName !== "Customer Manager") {
    return <Navigate to="/staff/dashboard" replace />;
  }

  return (
    <div className="panel-page">
      <h1 className="panel-title">Guest customers</h1>
      <p className="panel-intro">
        Accounts created on the public site for booking. Disabled guests cannot sign in until re-enabled.
      </p>
      {err && <p className="panel-err">{err}</p>}
      {loading && <p className="panel-muted">Loading…</p>}
      {!loading && rows.length === 0 && !err && <p className="panel-muted">No guest accounts yet.</p>}
      {!loading && rows.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Guest ID</th>
                <th>Email</th>
                <th>Joined</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c._id}>
                  <td>
                    <strong>#{c.customerNumber}</strong>
                  </td>
                  <td>{c.email}</td>
                  <td>{c.createdAt ? new Date(c.createdAt).toLocaleString() : "—"}</td>
                  <td>{c.active ? "Active" : "Disabled"}</td>
                  <td>
                    {c.active ? (
                      <button type="button" className="btn-danger-sm" onClick={() => setActive(c, false)}>
                        Disable
                      </button>
                    ) : (
                      <button type="button" className="btn-primary-sm" onClick={() => setActive(c, true)}>
                        Enable
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="panel-subtitle">Issue reports</h2>
      {!loading && issues.length === 0 && <p className="panel-muted">No issue reports yet.</p>}
      {!loading && issues.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Guest</th>
                <th>Room</th>
                <th>Issue</th>
                <th>Description</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Assigned</th>
                <th>Reported</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {issues.map((i) => (
                <tr key={i._id}>
                  <td>#{i.customer?.customerNumber || "—"}</td>
                  <td>{i.room?.roomNumber || "—"}</td>
                  <td>{i.issueType}</td>
                  <td>{i.description?.trim() ? i.description : "No description provided."}</td>
                  <td>{prettifyStatus(i.priority)}</td>
                  <td>{prettifyStatus(i.status)}</td>
                  <td>{i.assignedStaff?.name || "Pending"}</td>
                  <td>{i.createdAt ? new Date(i.createdAt).toLocaleString() : "—"}</td>
                  <td>
                    <select value={i.status} onChange={(e) => setIssueStatus(i, e.target.value)}>
                      <option value="submitted">submitted</option>
                      <option value="assigned">assigned</option>
                      <option value="in_progress">in_progress</option>
                      <option value="resolved">resolved</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
