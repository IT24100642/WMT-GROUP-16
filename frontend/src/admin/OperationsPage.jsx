import { useCallback, useEffect, useState } from "react";
import { api, parseJson } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import "./Panel.css";

function toDatetimeLocalValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function OperationsPage() {
  const { token } = useAuth();
  const [staffList, setStaffList] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [err, setErr] = useState("");

  const [shiftForm, setShiftForm] = useState({ staff: "", startAt: "", endAt: "", label: "", notes: "" });
  const [editingShiftId, setEditingShiftId] = useState(null);

  const load = useCallback(async () => {
    setErr("");
    try {
      const [sr, tr] = await Promise.all([api("/api/staff", {}, token), api("/api/shifts", {}, token)]);
      const sd = await parseJson(sr);
      const td = await parseJson(tr);
      if (!sr.ok) throw new Error(sd.error || "Staff list failed");
      if (!tr.ok) throw new Error(td.error || "Shifts failed");
      setStaffList(sd);
      setShifts(td);
    } catch (e) {
      setErr(e.message || "Load failed");
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (staffList.length > 0) {
      setShiftForm((f) => (f.staff ? f : { ...f, staff: staffList[0]._id }));
    }
  }, [staffList]);

  async function submitShift(e) {
    e.preventDefault();
    setErr("");
    const body = {
      staff: shiftForm.staff,
      startAt: shiftForm.startAt,
      endAt: shiftForm.endAt,
      label: shiftForm.label,
      notes: shiftForm.notes,
    };
    const res = await api(
      editingShiftId ? `/api/shifts/${editingShiftId}` : "/api/shifts",
      {
        method: editingShiftId ? "PATCH" : "POST",
        body: JSON.stringify(body),
      },
      token
    );
    const data = await parseJson(res);
    if (!res.ok) {
      setErr(data.error || "Save failed");
      return;
    }
    setShiftForm({ staff: staffList[0]?._id || "", startAt: "", endAt: "", label: "", notes: "" });
    setEditingShiftId(null);
    load();
  }

  async function deleteShift(id) {
    if (!confirm("Delete this shift?")) return;
    const res = await api(`/api/shifts/${id}`, { method: "DELETE" }, token);
    if (!res.ok) {
      setErr((await parseJson(res)).error || "Delete failed");
      return;
    }
    load();
  }

  return (
    <div className="panel-page">
      <h1 className="panel-title">Staff &amp; shifts</h1>
      {err && <p className="panel-err">{err}</p>}

      <h2 className="panel-subtitle">Team (portal logins)</h2>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {staffList.map((s) => (
              <tr key={s._id}>
                <td>{s.name}</td>
                <td>
                  <code>{s.username || "—"}</code>
                </td>
                <td>{s.role?.name || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="panel-subtitle">{editingShiftId ? "Edit shift" : "Schedule shift"}</h2>
      <form className="form-grid" onSubmit={submitShift}>
        <label>
          Staff member
          <select value={shiftForm.staff} onChange={(e) => setShiftForm({ ...shiftForm, staff: e.target.value })} required>
            <option value="">Select</option>
            {staffList.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name} ({s.role?.name})
              </option>
            ))}
          </select>
        </label>
        <label>
          Start
          <input
            type="datetime-local"
            value={shiftForm.startAt}
            onChange={(e) => setShiftForm({ ...shiftForm, startAt: e.target.value })}
            required
          />
        </label>
        <label>
          End
          <input
            type="datetime-local"
            value={shiftForm.endAt}
            onChange={(e) => setShiftForm({ ...shiftForm, endAt: e.target.value })}
            required
          />
        </label>
        <label>
          Label
          <input value={shiftForm.label} onChange={(e) => setShiftForm({ ...shiftForm, label: e.target.value })} />
        </label>
        <label className="span-2">
          Notes
          <input value={shiftForm.notes} onChange={(e) => setShiftForm({ ...shiftForm, notes: e.target.value })} />
        </label>
        <div className="form-actions span-2">
          <button type="submit" className="btn-primary-sm">
            {editingShiftId ? "Save shift" : "Create shift"}
          </button>
          {editingShiftId && (
            <button
              type="button"
              className="btn-ghost-sm"
              onClick={() => {
                setEditingShiftId(null);
                setShiftForm({ staff: staffList[0]?._id || "", startAt: "", endAt: "", label: "", notes: "" });
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <h2 className="panel-subtitle">All shifts</h2>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Staff</th>
              <th>Start</th>
              <th>End</th>
              <th>Label</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shifts.map((sh) => (
              <tr key={sh._id}>
                <td>{sh.staff?.name || "—"}</td>
                <td>{new Date(sh.startAt).toLocaleString()}</td>
                <td>{new Date(sh.endAt).toLocaleString()}</td>
                <td>{sh.label || "—"}</td>
                <td>
                  <button
                    type="button"
                    className="btn-ghost-sm"
                    onClick={() => {
                      setEditingShiftId(sh._id);
                      setShiftForm({
                        staff: sh.staff?._id || sh.staff,
                        startAt: toDatetimeLocalValue(sh.startAt),
                        endAt: toDatetimeLocalValue(sh.endAt),
                        label: sh.label || "",
                        notes: sh.notes || "",
                      });
                    }}
                  >
                    Edit
                  </button>
                  <button type="button" className="btn-danger-sm" onClick={() => deleteShift(sh._id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
