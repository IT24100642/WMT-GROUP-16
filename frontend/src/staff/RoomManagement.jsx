import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api, apiUpload, parseJson } from "../api/client.js";
import { useStaffAuth } from "../context/StaffAuthContext.jsx";
import "../admin/Panel.css";
import { formatLkr } from "../lib/formatLkr.js";
import "./RoomManagement.css";

const STATUSES = ["Available", "Reserved", "Occupied", "Cleaning", "Maintenance"];
const M_STATUSES = ["scheduled", "in_progress", "completed", "cancelled"];
const H_STATUSES = ["pending", "in_progress", "completed", "cancelled"];

function sortRoomsByNumber(a, b) {
  return Number(a.roomNumber) - Number(b.roomNumber);
}

export default function RoomManagement() {
  const { token, profile } = useStaffAuth();
  const [rooms, setRooms] = useState([]);
  const [offers, setOffers] = useState([]);
  const [offerEditingId, setOfferEditingId] = useState(null);
  const [offerForm, setOfferForm] = useState({
    title: "",
    description: "",
    packagePrice: 0,
    active: true,
    roomIds: [],
  });
  const [staffList, setStaffList] = useState([]);
  const [err, setErr] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailForm, setDetailForm] = useState({
    description: "",
    basePricePerNight: 0,
    status: "Available",
  });

  const [mForm, setMForm] = useState({
    title: "",
    notes: "",
    status: "scheduled",
    assignedStaff: "",
    scheduledFor: "",
  });
  const [hForm, setHForm] = useState({
    task: "",
    notes: "",
    status: "pending",
    assignedStaff: "",
  });
  const [photoUploading, setPhotoUploading] = useState(false);

  const loadRooms = useCallback(async () => {
    setErr("");
    const res = await api("/api/staff-portal/rooms", {}, token);
    const data = await parseJson(res);
    if (!res.ok) {
      setErr(data.error || "Could not load rooms");
      return;
    }
    setRooms(data);
  }, [token]);

  const loadStaff = useCallback(async () => {
    const res = await api("/api/staff-portal/assignable-staff", {}, token);
    const data = await parseJson(res);
    if (res.ok) setStaffList(data);
  }, [token]);

  const loadOffers = useCallback(async () => {
    const res = await api("/api/staff-portal/offers", {}, token);
    const data = await parseJson(res);
    if (res.ok) setOffers(Array.isArray(data) ? data : []);
  }, [token]);

  const loadDetail = useCallback(
    async (id) => {
      if (!id) {
        setDetail(null);
        return;
      }
      setErr("");
      const res = await api(`/api/staff-portal/rooms/${id}`, {}, token);
      const data = await parseJson(res);
      if (!res.ok) {
        setErr(data.error || "Could not load room");
        return;
      }
      setDetail(data);
    },
    [token]
  );

  useEffect(() => {
    loadRooms();
    loadStaff();
    loadOffers();
  }, [loadRooms, loadStaff, loadOffers]);

  useEffect(() => {
    if (!detail) return;
    setDetailForm({
      description: detail.description || "",
      basePricePerNight: detail.basePricePerNight ?? 0,
      status: detail.status || "Available",
    });
  }, [detail?._id]);

  if (profile?.roleName !== "Room Manager") {
    return <Navigate to="/staff/dashboard" replace />;
  }

  function openManage(room) {
    loadDetail(room._id);
  }

  async function saveRoomDetails(e) {
    e.preventDefault();
    if (!detail) return;
    setErr("");
    const res = await api(
      `/api/staff-portal/rooms/${detail._id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          description: detailForm.description,
          basePricePerNight: detailForm.basePricePerNight,
          status: detailForm.status,
        }),
      },
      token
    );
    const data = await parseJson(res);
    if (!res.ok) {
      setErr(data.error || "Save failed");
      return;
    }
    await loadRooms();
    await loadDetail(detail._id);
  }

  async function uploadRoomPhoto(file) {
    if (!detail?._id || !file) return;
    setErr("");
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append("photo", file);
      const res = await apiUpload(`/api/staff-portal/rooms/${detail._id}/photos`, fd, token);
      const data = await parseJson(res);
      if (!res.ok) {
        setErr(data.error || "Upload failed");
        return;
      }
      await loadDetail(detail._id);
      await loadRooms();
    } finally {
      setPhotoUploading(false);
    }
  }

  async function deleteRoomPhoto(photoId) {
    if (!detail?._id || !confirm("Remove this photo from the room?")) return;
    setErr("");
    const res = await api(`/api/staff-portal/rooms/${detail._id}/photos/${photoId}`, { method: "DELETE" }, token);
    const data = await parseJson(res);
    if (!res.ok) {
      setErr(data.error || "Could not delete photo");
      return;
    }
    await loadDetail(detail._id);
    await loadRooms();
  }

  function resetOfferForm() {
    setOfferEditingId(null);
    setOfferForm({
      title: "",
      description: "",
      packagePrice: 0,
      active: true,
      roomIds: [],
    });
  }

  function startEditOffer(offer) {
    setOfferEditingId(offer._id);
    setOfferForm({
      title: offer.title || "",
      description: offer.description || "",
      packagePrice: offer.packagePrice ?? 0,
      active: offer.active !== false,
      roomIds: (offer.rooms || []).map((r) => r._id).filter(Boolean),
    });
    setErr("");
  }

  async function submitOffer(e) {
    e.preventDefault();
    setErr("");
    if (offerForm.roomIds.length < 2) {
      setErr("Select at least two rooms for each offer.");
      return;
    }
    const body = {
      title: offerForm.title.trim(),
      description: offerForm.description.trim(),
      packagePrice: Number(offerForm.packagePrice) || 0,
      active: offerForm.active,
      roomIds: offerForm.roomIds,
    };
    if (!body.title) {
      setErr("Offer title is required.");
      return;
    }
    const isEdit = Boolean(offerEditingId);
    const res = await api(
      isEdit ? `/api/staff-portal/offers/${offerEditingId}` : "/api/staff-portal/offers",
      {
        method: isEdit ? "PATCH" : "POST",
        body: JSON.stringify(body),
      },
      token
    );
    const data = await parseJson(res);
    if (!res.ok) {
      setErr(data.error || "Could not save offer");
      return;
    }
    await loadOffers();
    resetOfferForm();
  }

  async function deleteOffer(id) {
    if (!confirm("Delete this offer? It will no longer appear on the public Reservations page.")) return;
    setErr("");
    const res = await api(`/api/staff-portal/offers/${id}`, { method: "DELETE" }, token);
    if (!res.ok) {
      setErr((await parseJson(res)).error || "Delete failed");
      return;
    }
    if (offerEditingId === id) resetOfferForm();
    loadOffers();
  }

  async function addMaintenance(e) {
    e.preventDefault();
    if (!detail) return;
    setErr("");
    const body = {
      title: mForm.title.trim(),
      notes: mForm.notes.trim(),
      status: mForm.status,
      assignedStaff: mForm.assignedStaff || null,
      scheduledFor: mForm.scheduledFor || null,
    };
    const res = await api(`/api/staff-portal/rooms/${detail._id}/maintenance`, {
      method: "POST",
      body: JSON.stringify(body),
    }, token);
    const data = await parseJson(res);
    if (!res.ok) {
      setErr(data.error || "Could not add maintenance record");
      return;
    }
    setMForm({ title: "", notes: "", status: "scheduled", assignedStaff: "", scheduledFor: "" });
    loadDetail(detail._id);
  }

  async function addHousekeeping(e) {
    e.preventDefault();
    if (!detail) return;
    setErr("");
    const body = {
      task: hForm.task.trim(),
      notes: hForm.notes.trim(),
      status: hForm.status,
      assignedStaff: hForm.assignedStaff || null,
    };
    const res = await api(`/api/staff-portal/rooms/${detail._id}/housekeeping`, {
      method: "POST",
      body: JSON.stringify(body),
    }, token);
    const data = await parseJson(res);
    if (!res.ok) {
      setErr(data.error || "Could not add housekeeping record");
      return;
    }
    setHForm({ task: "", notes: "", status: "pending", assignedStaff: "" });
    loadDetail(detail._id);
  }

  async function patchMaintenance(rec, patch) {
    setErr("");
    const res = await api(`/api/staff-portal/maintenance/${rec._id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }, token);
    const data = await parseJson(res);
    if (!res.ok) {
      setErr(data.error || "Update failed");
      return;
    }
    loadDetail(detail._id);
  }

  async function deleteMaintenance(id) {
    if (!confirm("Remove this maintenance entry?")) return;
    setErr("");
    const res = await api(`/api/staff-portal/maintenance/${id}`, { method: "DELETE" }, token);
    if (!res.ok) {
      setErr((await parseJson(res)).error || "Delete failed");
      return;
    }
    loadDetail(detail._id);
  }

  async function patchHousekeeping(rec, patch) {
    setErr("");
    const res = await api(`/api/staff-portal/housekeeping/${rec._id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }, token);
    const data = await parseJson(res);
    if (!res.ok) {
      setErr(data.error || "Update failed");
      return;
    }
    loadDetail(detail._id);
  }

  async function deleteHousekeeping(id) {
    if (!confirm("Remove this housekeeping entry?")) return;
    setErr("");
    const res = await api(`/api/staff-portal/housekeeping/${id}`, { method: "DELETE" }, token);
    if (!res.ok) {
      setErr((await parseJson(res)).error || "Delete failed");
      return;
    }
    loadDetail(detail._id);
  }

  const staffSelect = <option value="">— Unassigned —</option>;
  const staffOptions = staffList.map((s) => (
    <option key={s._id} value={s._id}>
      {s.name} ({s.roleName || s.username})
    </option>
  ));

  return (
    <div className="panel-page room-mgmt">
      <div className="room-mgmt-layout">
        {err && (
          <p className="panel-err room-mgmt-err" role="alert">
            {err}
          </p>
        )}

        <section className="room-mgmt-offers card-like">
          <h2 className="panel-subtitle">Guest offers</h2>
          <p className="panel-muted room-mgmt-offers-intro">
            Bundle two or more rooms into a package. Active offers appear when guests click <strong>Offers</strong> on
            the Reservations page. Set a package price in LKR to show a headline rate (use 0 to hide the price).
          </p>

          {offers.length > 0 && (
            <div className="table-wrap room-mgmt-offers-table">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Rooms</th>
                    <th>Package (LKR)</th>
                    <th>Active</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {offers.map((o) => (
                    <tr key={o._id}>
                      <td>{o.title}</td>
                      <td>{(o.rooms || []).length}</td>
                      <td>{o.packagePrice > 0 ? formatLkr(o.packagePrice) : "—"}</td>
                      <td>{o.active ? "Yes" : "No"}</td>
                      <td>
                        <button type="button" className="btn-ghost-sm" onClick={() => startEditOffer(o)}>
                          Edit
                        </button>{" "}
                        <button type="button" className="btn-danger-sm" onClick={() => deleteOffer(o._id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3 className="room-detail-h3">{offerEditingId ? "Edit offer" : "Create offer"}</h3>
          <form className="form-grid room-subform room-mgmt-offer-form" onSubmit={submitOffer}>
            <label className="span-2">
              Title
              <input
                value={offerForm.title}
                onChange={(e) => setOfferForm((f) => ({ ...f, title: e.target.value }))}
                required
              />
            </label>
            <label className="span-2">
              Description
              <textarea
                rows={2}
                value={offerForm.description}
                onChange={(e) => setOfferForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
            <label>
              Package price (LKR)
              <input
                type="number"
                min={0}
                step={1}
                value={offerForm.packagePrice}
                onChange={(e) => setOfferForm((f) => ({ ...f, packagePrice: Number(e.target.value) }))}
              />
            </label>
            <label className="room-mgmt-offer-active">
              <span className="room-mgmt-offer-active-label">Active (visible to guests)</span>
              <input
                type="checkbox"
                checked={offerForm.active}
                onChange={(e) => setOfferForm((f) => ({ ...f, active: e.target.checked }))}
              />
            </label>
            <label className="span-2 room-mgmt-offer-rooms-label">
              Rooms in this offer (select at least two — hold Ctrl or ⌘ while clicking)
              <select
                multiple
                size={12}
                className="room-mgmt-offer-multiselect"
                value={offerForm.roomIds}
                onChange={(e) => {
                  const roomIds = Array.from(e.target.selectedOptions).map((opt) => opt.value);
                  setOfferForm((f) => ({ ...f, roomIds }));
                }}
              >
                {[...rooms].sort(sortRoomsByNumber).map((r) => (
                  <option key={r._id} value={r._id}>
                    Room {r.roomNumber} · {r.variant}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-actions span-2">
              <button type="submit" className="btn-primary-sm btn-primary-xs room-mgmt-offer-submit">
                {offerEditingId ? "Update offer" : "Create offer"}
              </button>
              {offerEditingId && (
                <button type="button" className="btn-ghost-sm" onClick={resetOfferForm}>
                  Cancel edit
                </button>
              )}
            </div>
          </form>
        </section>

        <div className="room-mgmt-title-row">
          <h2 className="panel-subtitle room-mgmt-title-all">All rooms</h2>
          <h1 className="panel-title room-mgmt-title-page">Room management</h1>
        </div>
        <div className="room-mgmt-col room-mgmt-col--list">
          <div className="table-wrap room-mgmt-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Room</th>
              <th>Variant</th>
              <th>Climate</th>
              <th>Floor</th>
              <th>Type</th>
              <th>Status</th>
              <th>Price / night</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rooms.map((r) => (
              <tr key={r._id}>
                <td>
                  <strong>{r.roomNumber}</strong>
                </td>
                <td>{r.variant || "—"}</td>
                <td>{r.airConditioned ? "AC" : "Non-AC"}</td>
                <td>{r.floor}</td>
                <td>{r.roomType}</td>
                <td>
                  <span className={`room-status room-status--${r.status?.toLowerCase()}`}>{r.status}</span>
                </td>
                <td>{formatLkr(r.basePricePerNight)}</td>
                <td>
                  <button type="button" className="btn-ghost-sm" onClick={() => openManage(r)}>
                    Manage
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
          </div>
        </div>

        <aside className="room-mgmt-col room-mgmt-col--detail">
          {detail ? (
        <section className="room-detail card-like">
          <div className="room-detail-head">
            <h2 className="panel-subtitle">Room {detail.roomNumber}</h2>
            <button
              type="button"
              className="btn-ghost-sm"
              onClick={() => {
                setDetail(null);
              }}
            >
              Close panel
            </button>
          </div>
          <p className="panel-muted room-detail-meta">
            <strong>{detail.variant}</strong> · {detail.roomType} · Floor {detail.floor} · Up to {detail.capacity}{" "}
            guests · {detail.airConditioned ? "Air conditioned" : "Non-AC"}
          </p>

          <h3 className="room-detail-h3">Room details</h3>
          <p className="panel-muted">Description, rate, and booking status (category and room number are fixed).</p>
          <form className="form-grid room-subform" onSubmit={saveRoomDetails}>
            <label className="span-2">
              Description
              <textarea
                rows={3}
                value={detailForm.description}
                onChange={(e) => setDetailForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
            <label>
              Base price / night (LKR)
              <input
                type="number"
                min={0}
                step="1"
                value={detailForm.basePricePerNight}
                onChange={(e) => setDetailForm((f) => ({ ...f, basePricePerNight: Number(e.target.value) }))}
              />
            </label>
            <label>
              Status
              <select
                value={detailForm.status}
                onChange={(e) => setDetailForm((f) => ({ ...f, status: e.target.value }))}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-actions span-2">
              <button type="submit" className="btn-primary-sm">
                Save room details
              </button>
            </div>
          </form>

          <h3 className="room-detail-h3">Photos</h3>
          <p className="panel-muted">JPEG, PNG, WebP, or GIF. Maximum 5 MB per image. Shown on the public Reservations page.</p>
          <div className="room-photo-upload">
            <label className="room-photo-file-label">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={photoUploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadRoomPhoto(f);
                  e.target.value = "";
                }}
              />
              <span className="btn-primary-sm room-photo-file-btn">
                {photoUploading ? "Uploading…" : "Upload photo"}
              </span>
            </label>
          </div>
          {(detail.photos || []).length > 0 ? (
            <div className="room-photo-grid">
              {(detail.photos || []).map((ph) => (
                <div key={ph._id} className="room-photo-tile">
                  <img src={ph.url} alt="" />
                  <button type="button" className="btn-danger-sm room-photo-remove" onClick={() => deleteRoomPhoto(ph._id)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="panel-muted">No photos yet — guests will see a placeholder until you upload.</p>
          )}

          <h3 className="room-detail-h3">Maintenance</h3>
          <form className="form-grid room-subform" onSubmit={addMaintenance}>
            <label>
              Title
              <input value={mForm.title} onChange={(e) => setMForm((f) => ({ ...f, title: e.target.value }))} required />
            </label>
            <label>
              Status
              <select value={mForm.status} onChange={(e) => setMForm((f) => ({ ...f, status: e.target.value }))}>
                {M_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Assigned staff
              <select value={mForm.assignedStaff} onChange={(e) => setMForm((f) => ({ ...f, assignedStaff: e.target.value }))}>
                {staffSelect}
                {staffOptions}
              </select>
            </label>
            <label>
              Scheduled for
              <input
                type="datetime-local"
                value={mForm.scheduledFor}
                onChange={(e) => setMForm((f) => ({ ...f, scheduledFor: e.target.value }))}
              />
            </label>
            <label className="span-2">
              Notes
              <input value={mForm.notes} onChange={(e) => setMForm((f) => ({ ...f, notes: e.target.value }))} />
            </label>
            <div className="form-actions span-2">
              <button type="submit" className="btn-primary-sm">
                Add maintenance record
              </button>
            </div>
          </form>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Assigned</th>
                  <th>Notes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(detail.maintenance || []).map((rec) => (
                  <tr key={rec._id}>
                    <td>{rec.title}</td>
                    <td>
                      <select
                        value={rec.status}
                        onChange={(e) => patchMaintenance(rec, { status: e.target.value })}
                        className="inline-select"
                      >
                        {M_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{rec.assignedStaff?.name || "—"}</td>
                    <td>{rec.notes || "—"}</td>
                    <td>
                      <button type="button" className="btn-danger-sm" onClick={() => deleteMaintenance(rec._id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="room-detail-h3">Housekeeping</h3>
          <form className="form-grid room-subform" onSubmit={addHousekeeping}>
            <label>
              Task
              <input value={hForm.task} onChange={(e) => setHForm((f) => ({ ...f, task: e.target.value }))} required />
            </label>
            <label>
              Status
              <select value={hForm.status} onChange={(e) => setHForm((f) => ({ ...f, status: e.target.value }))}>
                {H_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Assigned staff
              <select value={hForm.assignedStaff} onChange={(e) => setHForm((f) => ({ ...f, assignedStaff: e.target.value }))}>
                {staffSelect}
                {staffOptions}
              </select>
            </label>
            <label className="span-2">
              Notes
              <input value={hForm.notes} onChange={(e) => setHForm((f) => ({ ...f, notes: e.target.value }))} />
            </label>
            <div className="form-actions span-2">
              <button type="submit" className="btn-primary-sm">
                Add housekeeping record
              </button>
            </div>
          </form>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Status</th>
                  <th>Assigned</th>
                  <th>Notes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(detail.housekeeping || []).map((rec) => (
                  <tr key={rec._id}>
                    <td>{rec.task}</td>
                    <td>
                      <select
                        value={rec.status}
                        onChange={(e) => patchHousekeeping(rec, { status: e.target.value })}
                        className="inline-select"
                      >
                        {H_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{rec.assignedStaff?.name || "—"}</td>
                    <td>{rec.notes || "—"}</td>
                    <td>
                      <button type="button" className="btn-danger-sm" onClick={() => deleteHousekeeping(rec._id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
          ) : (
            <div className="room-mgmt-detail-placeholder card-like">
              <h2 className="panel-subtitle room-mgmt-placeholder-title">Manage room</h2>
              <p className="panel-muted">
                Select a room in the table and click <strong>Manage</strong> to edit details, photos, and logs here.
                Use <strong>Guest offers</strong> above for multi-room packages.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
