import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../App.css";

const req = (path, options) =>
  fetch(path, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });

export default function DemoMern() {
  const [items, setItems] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [health, setHealth] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [h, list] = await Promise.all([
        req("/api/health").then((r) => r.json()),
        req("/api/items").then((r) => r.json()),
      ]);
      setHealth(h);
      if (!Array.isArray(list)) throw new Error(list?.error || "Bad response");
      setItems(list);
    } catch (e) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setError(null);
    const res = await req("/api/items", { method: "POST", body: JSON.stringify({ text: t }) });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Save failed");
      return;
    }
    setText("");
    setItems((prev) => [data, ...prev]);
  }

  async function remove(id) {
    setError(null);
    const res = await req(`/api/items/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Delete failed");
      return;
    }
    setItems((prev) => prev.filter((x) => x._id !== id));
  }

  return (
    <div className="demo-shell">
      <div className="app">
        <header className="header">
          <Link to="/" className="demo-back">
            ← Home
          </Link>
          <h1>MERN stack demo</h1>
          <p className="tagline">MongoDB · Express · React · Node</p>
          {health && (
            <p className={`status ${health.db ? "ok" : "warn"}`}>
              API {health.ok ? "up" : "down"}
              {health.db ? " · DB connected" : " · DB disconnected"}
            </p>
          )}
        </header>
        <main className="main">
          <form className="form" onSubmit={handleSubmit}>
            <input
              className="input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="New item…"
              aria-label="New item"
            />
            <button className="btn primary" type="submit">
              Add
            </button>
          </form>
          {error && <p className="error">{error}</p>}
          {loading ? (
            <p className="muted">Loading…</p>
          ) : (
            <ul className="list">
              {items.length === 0 ? (
                <li className="muted">No items yet.</li>
              ) : (
                items.map((item) => (
                  <li key={item._id} className="row">
                    <span className="text">{item.text}</span>
                    <button type="button" className="btn ghost" onClick={() => remove(item._id)}>
                      Delete
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </main>
      </div>
    </div>
  );
}
