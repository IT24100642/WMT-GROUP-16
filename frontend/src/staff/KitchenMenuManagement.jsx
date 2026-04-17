import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api, apiUpload, parseJson } from "../api/client.js";
import { useStaffAuth } from "../context/StaffAuthContext.jsx";
import { formatLkr } from "../lib/formatLkr.js";
import "../admin/Panel.css";
import "./KitchenMenuManagement.css";

export default function KitchenMenuManagement() {
  const { token, profile } = useStaffAuth();
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const [catName, setCatName] = useState("");
  const [catDescription, setCatDescription] = useState("");
  const [catSortOrder, setCatSortOrder] = useState("0");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [categoryId, setCategoryId] = useState("");
  const [photoUploadItemId, setPhotoUploadItemId] = useState(null);
  const [editItemId, setEditItemId] = useState("");
  const [editItemForm, setEditItemForm] = useState({
    name: "",
    description: "",
    price: "",
    sortOrder: "0",
    categoryId: "",
    active: true,
  });
  const [savingEditItem, setSavingEditItem] = useState(false);

  const load = useCallback(async () => {
    setErr("");
    const [resCats, resItems, resOrders] = await Promise.all([
      api("/api/staff-portal/kitchen/food-categories", {}, token),
      api("/api/staff-portal/kitchen/food-items", {}, token),
      api("/api/staff-portal/kitchen/food-orders", {}, token),
    ]);
    const dataCats = await parseJson(resCats);
    const dataItems = await parseJson(resItems);
    const dataOrders = await parseJson(resOrders);
    let msg = "";
    if (!resCats.ok) {
      msg = dataCats.error || "Could not load categories";
      setCategories([]);
    } else {
      setCategories(Array.isArray(dataCats) ? dataCats : []);
    }
    if (!resItems.ok) {
      msg = msg || dataItems.error || "Could not load menu";
      setItems([]);
    } else {
      setItems(Array.isArray(dataItems) ? dataItems : []);
    }
    if (!resOrders.ok) {
      msg = msg || dataOrders.error || "Could not load orders";
      setOrders([]);
    } else {
      setOrders(Array.isArray(dataOrders) ? dataOrders : []);
    }
    setErr(msg);
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

  useEffect(() => {
    const refreshOrders = () => {
      load();
    };
    const intervalId = setInterval(refreshOrders, 2000);
    window.addEventListener("focus", refreshOrders);
    document.addEventListener("visibilitychange", refreshOrders);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", refreshOrders);
      document.removeEventListener("visibilitychange", refreshOrders);
    };
  }, [load]);

  async function addCategory(e) {
    e.preventDefault();
    setErr("");
    if (!catName.trim()) {
      setErr("Category name is required");
      return;
    }
    const res = await api(
      "/api/staff-portal/kitchen/food-categories",
      {
        method: "POST",
        body: JSON.stringify({
          name: catName.trim(),
          description: catDescription.trim(),
          sortOrder: Math.floor(Number(catSortOrder)) || 0,
        }),
      },
      token
    );
    const data = await parseJson(res);
    if (!res.ok) {
      setErr(data.error || "Could not create category");
      return;
    }
    setCatName("");
    setCatDescription("");
    setCatSortOrder("0");
    await load();
  }

  async function patchCategory(id, body) {
    setErr("");
    const res = await api(`/api/staff-portal/kitchen/food-categories/${id}`, { method: "PATCH", body: JSON.stringify(body) }, token);
    const data = await parseJson(res);
    if (!res.ok) {
      setErr(data.error || "Update failed");
      return;
    }
    await load();
  }

  async function deleteCategory(id) {
    if (!confirm("Delete this category? Items in it will become Uncategorized.")) return;
    setErr("");
    const res = await api(`/api/staff-portal/kitchen/food-categories/${id}`, { method: "DELETE" }, token);
    const data = await parseJson(res);
    if (!res.ok) {
      setErr(data.error || "Could not delete category");
      return;
    }
    await load();
  }

  async function addItem(e) {
    e.preventDefault();
    setErr("");
    const p = Math.round(Number(price));
    if (!name.trim()) {
      setErr("Name is required");
      return;
    }
    if (!Number.isFinite(p) || p < 0) {
      setErr("Valid price is required");
      return;
    }
    const body = {
      name: name.trim(),
      description: description.trim(),
      price: p,
      sortOrder: Math.floor(Number(sortOrder)) || 0,
    };
    if (categoryId) {
      body.categoryId = categoryId;
    }
    const res = await api("/api/staff-portal/kitchen/food-items", { method: "POST", body: JSON.stringify(body) }, token);
    const data = await parseJson(res);
    if (!res.ok) {
      setErr(data.error || "Could not add item");
      return;
    }
    setName("");
    setDescription("");
    setPrice("");
    setSortOrder("0");
    setCategoryId("");
    await load();
  }

  async function patchItem(id, body) {
    setErr("");
    const res = await api(`/api/staff-portal/kitchen/food-items/${id}`, { method: "PATCH", body: JSON.stringify(body) }, token);
    const data = await parseJson(res);
    if (!res.ok) {
      setErr(data.error || "Update failed");
      return;
    }
    await load();
  }

  function openEditItem(item) {
    setErr("");
    setEditItemId(item._id);
    setEditItemForm({
      name: String(item.name || ""),
      description: String(item.description || ""),
      price: String(Math.round(Number(item.price) || 0)),
      sortOrder: String(Math.floor(Number(item.sortOrder) || 0)),
      categoryId: item.category?._id ? String(item.category._id) : "",
      active: Boolean(item.active),
    });
  }

  function closeEditItem() {
    if (savingEditItem) return;
    setEditItemId("");
  }

  async function saveEditItem() {
    if (!editItemId) return;
    const trimmedName = String(editItemForm.name || "").trim();
    const roundedPrice = Math.round(Number(editItemForm.price));
    const normalizedSort = Math.floor(Number(editItemForm.sortOrder));
    if (!trimmedName) {
      setErr("Name is required");
      return;
    }
    if (!Number.isFinite(roundedPrice) || roundedPrice < 0) {
      setErr("Valid price is required");
      return;
    }
    setErr("");
    setSavingEditItem(true);
    const payload = {
      name: trimmedName,
      description: String(editItemForm.description || "").trim(),
      price: roundedPrice,
      sortOrder: Number.isFinite(normalizedSort) ? normalizedSort : 0,
      categoryId: editItemForm.categoryId === "" ? null : editItemForm.categoryId,
      active: Boolean(editItemForm.active),
    };
    const res = await api(`/api/staff-portal/kitchen/food-items/${editItemId}`, { method: "PATCH", body: JSON.stringify(payload) }, token);
    const data = await parseJson(res);
    if (!res.ok) {
      setErr(data.error || "Could not update menu item");
      setSavingEditItem(false);
      return;
    }
    setSavingEditItem(false);
    setEditItemId("");
    await load();
  }

  async function deleteItem(id) {
    if (!confirm("Delete this menu item?")) return;
    setErr("");
    const res = await api(`/api/staff-portal/kitchen/food-items/${id}`, { method: "DELETE" }, token);
    const data = await parseJson(res);
    if (!res.ok) {
      setErr(data.error || "Could not delete item");
      return;
    }
    await load();
  }

  async function uploadFoodPhoto(foodItemId, file) {
    if (!file) return;
    setErr("");
    setPhotoUploadItemId(foodItemId);
    const fd = new FormData();
    fd.append("photo", file);
    const res = await apiUpload(`/api/staff-portal/kitchen/food-items/${foodItemId}/photos`, fd, token);
    const data = await parseJson(res);
    setPhotoUploadItemId(null);
    if (!res.ok) {
      setErr(data.error || "Could not upload photo");
      return;
    }
    await load();
  }

  async function deleteFoodPhoto(foodItemId, photoId) {
    if (!confirm("Remove this photo from the dish?")) return;
    setErr("");
    const res = await api(`/api/staff-portal/kitchen/food-items/${foodItemId}/photos/${photoId}`, { method: "DELETE" }, token);
    const data = await parseJson(res);
    if (!res.ok) {
      setErr(data.error || "Could not delete photo");
      return;
    }
    await load();
  }

  async function patchOrder(id, orderStatus) {
    setErr("");
    const res = await api(
      `/api/staff-portal/kitchen/food-orders/${id}`,
      { method: "PATCH", body: JSON.stringify({ orderStatus }) },
      token
    );
    const data = await parseJson(res);
    if (!res.ok) {
      setErr(data.error || "Update failed");
      return;
    }
    await load();
  }

  if (profile?.roleName !== "Kitchen Manager") {
    return <Navigate to="/staff/dashboard" replace />;
  }

  const activeCategories = categories.filter((c) => c.active);

  return (
    <div className="panel-page kitchen-page">
      <h1 className="panel-title">Kitchen · Menu &amp; orders</h1>
      <p className="panel-intro">
        Create menu categories, add dishes, upload photos (same rules as rooms: JPEG/PNG/WebP/GIF, max 5 MB), and track
        guest food orders. Inactive categories are hidden from the public menu together with their dishes.
      </p>
      {err && <p className="panel-err">{err}</p>}
      {loading && <p className="panel-muted">Loading…</p>}

      {!loading && (
        <>
          <h2 className="panel-subtitle">Menu categories</h2>
          <form className="kitchen-add-form kitchen-add-form--categories" onSubmit={addCategory}>
            <label className="kitchen-field">
              Category name
              <input value={catName} onChange={(e) => setCatName(e.target.value)} required placeholder="e.g. Small plates" />
            </label>
            <label className="kitchen-field kitchen-field--wide">
              Description (optional)
              <input value={catDescription} onChange={(e) => setCatDescription(e.target.value)} placeholder="Shown to guests under the heading" />
            </label>
            <label className="kitchen-field">
              Sort order
              <input type="number" value={catSortOrder} onChange={(e) => setCatSortOrder(e.target.value)} />
            </label>
            <button type="submit" className="btn-primary-sm kitchen-add-btn">
              Add category
            </button>
          </form>

          {categories.length === 0 ? (
            <p className="panel-muted">No categories yet. Create one before grouping menu items.</p>
          ) : (
            <div className="table-wrap kitchen-categories-table">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Sort</th>
                    <th>Active</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {categories.map((c) => (
                    <tr key={c._id}>
                      <td>{c.name}</td>
                      <td className="kitchen-desc">{c.description || "—"}</td>
                      <td>{c.sortOrder}</td>
                      <td>{c.active ? "Yes" : "No"}</td>
                      <td>
                        <div className="kitchen-row-actions">
                          <button type="button" className="btn-primary-sm" onClick={() => patchCategory(c._id, { active: !c.active })}>
                            Toggle active
                          </button>
                          <button type="button" className="btn-danger-sm" onClick={() => deleteCategory(c._id)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2 className="panel-subtitle">Add menu item</h2>
          <form className="kitchen-add-form" onSubmit={addItem}>
            <label className="kitchen-field">
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="kitchen-field kitchen-field--wide">
              Description
              <input value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <label className="kitchen-field">
              Category
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Uncategorized</option>
                {activeCategories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="kitchen-field">
              Price (LKR)
              <input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} required />
            </label>
            <label className="kitchen-field">
              Sort order
              <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
            </label>
            <button type="submit" className="btn-primary-sm kitchen-add-btn">
              Add item
            </button>
          </form>

          <h2 className="panel-subtitle">Menu items</h2>
          {items.length === 0 ? (
            <p className="panel-muted">No items yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Photos</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Sort</th>
                    <th>Active</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it._id}>
                      <td className="kitchen-photos-cell">
                        <div className="kitchen-food-photo-strip">
                          {(it.photos || []).map((ph) => (
                            <span key={ph._id} className="kitchen-food-thumb-wrap">
                              <img className="kitchen-food-thumb-img" src={ph.url} alt="" loading="lazy" />
                              <button
                                type="button"
                                className="kitchen-food-thumb-del"
                                title="Remove photo"
                                onClick={() => deleteFoodPhoto(it._id, ph._id)}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                        <label className="kitchen-food-upload-label">
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            disabled={photoUploadItemId === it._id}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              e.target.value = "";
                              if (f) uploadFoodPhoto(it._id, f);
                            }}
                          />
                          <span className="btn-primary-sm kitchen-food-upload-btn">
                            {photoUploadItemId === it._id ? "Uploading…" : "Upload photo"}
                          </span>
                        </label>
                      </td>
                      <td>
                        <div>{it.name}</div>
                        <div className="kitchen-desc">{it.description || "—"}</div>
                      </td>
                      <td>
                        <select
                          className="inline-select kitchen-category-select"
                          value={it.category?._id ? String(it.category._id) : ""}
                          onChange={(e) => patchItem(it._id, { categoryId: e.target.value === "" ? null : e.target.value })}
                        >
                          <option value="">Uncategorized</option>
                          {categories
                            .filter((c) => c.active || (it.category && String(it.category._id) === String(c._id)))
                            .map((c) => (
                              <option key={c._id} value={c._id}>
                                {c.name}
                                {!c.active ? " (inactive)" : ""}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td>{formatLkr(it.price)}</td>
                      <td>{it.sortOrder}</td>
                      <td>{it.active ? "Yes" : "No"}</td>
                      <td>
                        <div className="kitchen-row-actions">
                          <button type="button" className="btn-primary-sm" onClick={() => patchItem(it._id, { active: !it.active })}>
                            Toggle active
                          </button>
                          <button type="button" className="btn-primary-sm" onClick={() => openEditItem(it)}>
                            Edit
                          </button>
                          <button type="button" className="btn-danger-sm" onClick={() => deleteItem(it._id)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2 className="panel-subtitle">Guest food orders</h2>
          {orders.length === 0 ? (
            <p className="panel-muted">No orders yet.</p>
          ) : (
            <div className="table-wrap kitchen-orders-table">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Guest</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Pay</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o._id}>
                      <td>{o.createdAt ? new Date(o.createdAt).toLocaleString() : "—"}</td>
                      <td>
                        <div>{o.customer?.email || "—"}</div>
                        <div className="kitchen-desc">#{o.customer?.customerNumber ?? "—"}</div>
                      </td>
                      <td>
                        <ul className="kitchen-order-lines">
                          {(o.lines || []).map((ln, i) => (
                            <li key={i}>
                              {ln.quantity}× {ln.name}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td>{formatLkr(o.subtotal)}</td>
                      <td>
                        <div>{String(o.paymentMethod || "").replace("_", " ")}</div>
                        <div className="kitchen-desc">{o.paymentStatus === "paid" ? "Paid" : "Pending"}</div>
                      </td>
                      <td>
                        <select
                          className="inline-select"
                          value={o.orderStatus}
                          onChange={(e) => patchOrder(o._id, e.target.value)}
                        >
                          <option value="received">received</option>
                          <option value="preparing">preparing</option>
                          <option value="ready">ready</option>
                          <option value="completed">completed</option>
                          <option value="cancelled">cancelled</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {editItemId && (
        <div className="kitchen-edit-overlay" role="presentation" onClick={closeEditItem}>
          <div className="kitchen-edit-modal" role="dialog" aria-labelledby="kitchen-edit-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="kitchen-edit-title" className="panel-subtitle kitchen-edit-title">
              Edit menu item
            </h2>
            <div className="kitchen-edit-grid">
              <label className="kitchen-field">
                Name
                <input
                  value={editItemForm.name}
                  onChange={(e) => setEditItemForm((prev) => ({ ...prev, name: e.target.value }))}
                  disabled={savingEditItem}
                />
              </label>
              <label className="kitchen-field kitchen-field--wide">
                Description
                <input
                  value={editItemForm.description}
                  onChange={(e) => setEditItemForm((prev) => ({ ...prev, description: e.target.value }))}
                  disabled={savingEditItem}
                />
              </label>
              <label className="kitchen-field">
                Category
                <select
                  value={editItemForm.categoryId}
                  onChange={(e) => setEditItemForm((prev) => ({ ...prev, categoryId: e.target.value }))}
                  disabled={savingEditItem}
                >
                  <option value="">Uncategorized</option>
                  {categories
                    .filter((c) => c.active || String(c._id) === String(editItemForm.categoryId))
                    .map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                        {!c.active ? " (inactive)" : ""}
                      </option>
                    ))}
                </select>
              </label>
              <label className="kitchen-field">
                Price (LKR)
                <input
                  type="number"
                  min={0}
                  value={editItemForm.price}
                  onChange={(e) => setEditItemForm((prev) => ({ ...prev, price: e.target.value }))}
                  disabled={savingEditItem}
                />
              </label>
              <label className="kitchen-field">
                Sort order
                <input
                  type="number"
                  value={editItemForm.sortOrder}
                  onChange={(e) => setEditItemForm((prev) => ({ ...prev, sortOrder: e.target.value }))}
                  disabled={savingEditItem}
                />
              </label>
              <label className="kitchen-check">
                <input
                  type="checkbox"
                  checked={Boolean(editItemForm.active)}
                  onChange={(e) => setEditItemForm((prev) => ({ ...prev, active: e.target.checked }))}
                  disabled={savingEditItem}
                />
                Active
              </label>
            </div>
            <div className="kitchen-edit-actions">
              <button type="button" className="btn-primary-sm" onClick={closeEditItem} disabled={savingEditItem}>
                Cancel
              </button>
              <button type="button" className="btn-primary-sm" onClick={saveEditItem} disabled={savingEditItem}>
                {savingEditItem ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
