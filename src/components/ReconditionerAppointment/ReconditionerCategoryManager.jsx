// src/components/ReconditionerAppointment/ReconditionerCategoryManager.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../../lib/api"; // ✅ env-based axios instance

export default function ReconditionerCategoryManager({ categories, setCategories }) {
  // CLOSED by default whenever the page mounts/re-mounts
  const [open, setOpen] = useState(false);

  // tabs: all | on | off
  const [tab, setTab] = useState("all");

  // collapsible: add form + per-row (both closed by default)
  const [addOpen, setAddOpen] = useState(false);
  const [rowOpen, setRowOpen] = useState(() => new Set()); // _id set

  // create form
  const [form, setForm] = useState({
    name: "",
    keywords: "",
    rules: "",
    defaultService: "",
    onPremises: true,
  });

  const [err, setErr] = useState("");
  const headersJSON = useMemo(() => ({ "Content-Type": "application/json" }), []);

  const reset = () =>
    setForm({ name: "", keywords: "", rules: "", defaultService: "", onPremises: true });

  const createCategory = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      const payload = {
        name: form.name.trim(),
        keywords: form.keywords,
        rules: form.rules,
        defaultService: form.defaultService.trim(),
        onPremises: !!form.onPremises,
      };
      const res = await api.post("/reconditioner-categories", payload, { headers: headersJSON });
      setCategories([...(categories || []), res.data?.data]);
      reset();
      setAddOpen(false);
    } catch (e2) {
      setErr(e2.response?.data?.message || e2.message || "Create failed");
    }
  };

  const updateCategory = async (id, patch) => {
    setErr("");
    try {
      const res = await api.put(`/reconditioner-categories/${id}`, patch, { headers: headersJSON });
      setCategories((prev) => prev.map((c) => (c._id === id ? res.data?.data : c)));
    } catch (e2) {
      setErr(e2.response?.data?.message || e2.message || "Update failed");
    }
  };

  const deleteCategory = async (id) => {
    if (!window.confirm("Delete this category and all its appointments?")) return;
    setErr("");
    try {
      await api.delete(`/reconditioner-categories/${id}`);
      setCategories((prev) => prev.filter((c) => c._id !== id));
    } catch (e2) {
      setErr(e2.response?.data?.message || e2.message || "Delete failed");
    }
  };

  // ---------- Drag & Drop ----------
  const [dragId, setDragId] = useState(null);
  const handleDragStart = (id) => (e) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };
  const handleDragOver = (overId) => (e) => {
    e.preventDefault();
    if (!dragId || dragId === overId) return;
    setCategories((prev) => {
      const arr = [...prev];
      const from = arr.findIndex((x) => x._id === dragId);
      const to = arr.findIndex((x) => x._id === overId);
      if (from === -1 || to === -1) return prev;
      const [m] = arr.splice(from, 1);
      arr.splice(to, 0, m);
      return arr;
    });
  };
  const persistOrder = async () => {
    if (!dragId) return;
    const ids = (categories || []).map((c) => c._id);
    setDragId(null);
    try {
      const res = await api.put(
        "/reconditioner-categories/reorder/all",
        { ids },
        { headers: headersJSON }
      );
      setCategories(res.data?.data || []);
    } catch (e2) {
      setErr(e2.response?.data?.message || e2.message || "Reorder failed");
    }
  };

  // helpers
  const toggleRow = (id) => {
    setRowOpen((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const filtered = (categories || []).filter((c) =>
    tab === "on" ? !!c.onPremises : tab === "off" ? !c.onPremises : true
  );

  return (
    <div className="rcm">
      <style>{css}</style>

      <button className="rcm-toggle" onClick={() => setOpen((o) => !o)}>
        <span className="tw">{open ? "▾" : "▸"}</span>
        <strong>Reconditioner Categories</strong>
        <span className="hint">{open ? "Hide" : "Show"}</span>
      </button>

      {err ? <div className="cal-alert" style={{ marginTop: 8 }}>{err}</div> : null}

      {open && (
        <div className="rcm-body">
          {/* Tabs + Add */}
          <div className="rcm-headbar">
            <div className="rcm-tabs" role="tablist" aria-label="Category groups">
              <button role="tab" className={`rcm-tab ${tab === "all" ? "is-active" : ""}`} onClick={() => setTab("all")}>
                All <span className="count">{categories.length}</span>
              </button>
              <button role="tab" className={`rcm-tab ${tab === "on" ? "is-active" : ""}`} onClick={() => setTab("on")}>
                On premises <span className="count">{categories.filter((c) => c.onPremises).length}</span>
              </button>
              <button role="tab" className={`rcm-tab ${tab === "off" ? "is-active" : ""}`} onClick={() => setTab("off")}>
                Off premises <span className="count">{categories.filter((c) => !c.onPremises).length}</span>
              </button>
            </div>

            <button className="btn btn--primary btn--sm" onClick={() => setAddOpen((s) => !s)}>
              {addOpen ? "−" : "+"} Add Category
            </button>
          </div>

          {/* Collapsible Add form */}
          {addOpen && (
            <form onSubmit={createCategory} className="rcm-card">
              <h3>Add Category</h3>
              <div className="grid">
                <label>
                  <span>Name</span>
                  <input
                    className="cal-input"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Auto Electrical"
                    required
                  />
                </label>
                <label>
                  <span>Keywords (CSV)</span>
                  <input
                    className="cal-input"
                    value={form.keywords}
                    onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
                    placeholder="ac, compressor"
                  />
                </label>
                <label className="full">
                  <span>Rules (CSV or multi-line)</span>
                  <textarea
                    className="cal-input"
                    rows={3}
                    value={form.rules}
                    onChange={(e) => setForm((f) => ({ ...f, rules: e.target.value }))}
                    placeholder={`if text mentions "compressor" and "ac", choose AC`}
                    style={{ resize: "vertical" }}
                  />
                </label>
                <label>
                  <span>Default Service</span>
                  <input
                    className="cal-input"
                    value={form.defaultService}
                    onChange={(e) => setForm((f) => ({ ...f, defaultService: e.target.value }))}
                    placeholder="auto electrical"
                  />
                </label>
                <label>
                  <span>On premises</span>
                  <div
                    className="switch"
                    onClick={() => setForm((f) => ({ ...f, onPremises: !f.onPremises }))}
                    role="switch"
                    aria-checked={form.onPremises}
                  >
                    <div className={`knob ${form.onPremises ? "on" : ""}`} />
                    <span className="switch-text">{form.onPremises ? "On" : "Off"}</span>
                  </div>
                </label>
              </div>
              <div className="rcm-actions">
                <button type="submit" className="btn btn--primary btn--sm">+ Add Category</button>
              </div>
            </form>
          )}

          {/* Draggable & collapsible list */}
          <div className="rcm-list" onDrop={persistOrder} onDragEnd={persistOrder}>
            {filtered.map((c) => {
              const isOpen = rowOpen.has(c._id);
              return (
                <div
                  key={c._id}
                  className={`rcm-card is-row ${isOpen ? "is-open" : ""}`}
                  onDragOver={handleDragOver(c._id)}
                >
                  <div className="row">
                    {/* drag handle to the LEFT of the chevron */}
                    <button
                      className="grip"
                      title="Drag to reorder"
                      aria-label="Drag to reorder"
                      draggable
                      onDragStart={handleDragStart(c._id)}
                    >
                      <GripIcon />
                    </button>

                    <button
                      className="chev"
                      onClick={() => toggleRow(c._id)}
                      aria-label={isOpen ? "Collapse" : "Expand"}
                      title={isOpen ? "Collapse" : "Expand"}
                    >
                      {isOpen ? "▾" : "▸"}
                    </button>

                    <strong className="name">{c.name}</strong>
                    {c.onPremises ? (
                      <span className="pill pill--on">On premises</span>
                    ) : (
                      <span className="pill pill--off">Off premises</span>
                    )}
                    <div className="spacer" />
                    <button className="btn btn--danger btn--sm" onClick={() => deleteCategory(c._id)} title="Delete">
                      <TrashIcon />
                    </button>
                  </div>

                  {isOpen && (
                    <div className="edit">
                      <Editable label="Name" value={c.name} onSave={(v) => updateCategory(c._id, { name: v })} />
                      <Editable
                        label="Keywords (CSV)"
                        value={(c.keywords || []).join(", ")}
                        onSave={(v) => updateCategory(c._id, { keywords: v })}
                      />
                      <Editable
                        label="Rules (CSV or multi-line)"
                        value={(c.rules || []).join("\n")}
                        textarea
                        onSave={(v) => updateCategory(c._id, { rules: v })}
                      />
                      <Editable
                        label="Default Service"
                        value={c.defaultService || ""}
                        onSave={(v) => updateCategory(c._id, { defaultService: v })}
                      />
                      {/* Toggle (no edit button) */}
                      <div className="erow">
                        <label className="elbl">On premises</label>
                        <div
                          className="switch"
                          role="switch"
                          aria-checked={!!c.onPremises}
                          onClick={() => updateCategory(c._id, { onPremises: !c.onPremises })}
                        >
                          <div className={`knob ${c.onPremises ? "on" : ""}`} />
                          <span className="switch-text">{c.onPremises ? "On" : "Off"}</span>
                        </div>
                        <div />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Reusable bits ---------- */
function Editable({ label, value, onSave, textarea = false }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value || "");

  useEffect(() => setV(value || ""), [value]);
  const save = async () => {
    await onSave(v);
    setEditing(false);
  };

  return (
    <div className="erow">
      <label className="elbl">{label}</label>
      {editing ? (
        textarea ? (
          <textarea rows={3} value={v} onChange={(e) => setV(e.target.value)} className="cal-input" />
        ) : (
          <input value={v} onChange={(e) => setV(e.target.value)} className="cal-input" />
        )
      ) : (
        <div className="eval">{v || <em style={{ color: "#9CA3AF" }}>—</em>}</div>
      )}
      <div className="ebtns">
        {editing ? (
          <>
            <button onClick={save} className="btn btn--primary btn--sm">Save</button>
            <button onClick={() => { setV(value || ""); setEditing(false); }} className="btn btn--ghost btn--sm">
              Cancel
            </button>
          </>
        ) : (
          <button onClick={() => setEditing(true)} className="btn btn--ghost btn--sm">Edit</button>
        )}
      </div>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <circle cx="8" cy="6" r="1.5" fill="currentColor" />
      <circle cx="8" cy="12" r="1.5" fill="currentColor" />
      <circle cx="8" cy="18" r="1.5" fill="currentColor" />
      <circle cx="16" cy="6" r="1.5" fill="currentColor" />
      <circle cx="16" cy="12" r="1.5" fill="currentColor" />
      <circle cx="16" cy="18" r="1.5" fill="currentColor" />
    </svg>
  );
}

/* ---------- Styles ---------- */
const css = `
:root { color-scheme: dark; }
.rcm { margin-bottom: 16px; font-family: Inter, system-ui, -apple-system, Segoe UI, Arial; color:#E5E7EB; }
.rcm-toggle {
  width:100%; display:flex; align-items:center; gap:10px;
  background:#0F172A; border:1px solid #1F2937; border-radius:12px;
  padding:10px 12px; color:#E5E7EB; cursor:pointer;
}
.rcm-toggle .hint { margin-left:auto; color:#9CA3AF; font-size:12px }
.rcm-body { margin-top: 10px; }

.rcm-headbar { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px; }
.rcm-tabs { display:flex; gap:8px; flex-wrap:wrap; }
.rcm-tab { background:#0F172A; border:1px solid #243041; color:#E5E7EB; padding:8px 12px; border-radius:999px; cursor:pointer; font-weight:600; font-size:13px; }
.rcm-tab.is-active { border-color:#2E4B8F; box-shadow:0 0 0 3px rgba(37,99,235,.18) inset; }
.rcm-tab .count { margin-left:8px; color:#9CA3AF; }

.rcm-card {
  border:1px solid #1F2937; background:#0B1220; color:#E5E7EB; border-radius:12px;
  padding:12px; margin-bottom:10px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.02);
}
.rcm-card.is-row { user-select:none; padding:10px 12px; }

/* ---- SINGLE-LINE ROW LAYOUT ---- */
.row{
  display:flex;
  align-items:center;
  gap:10px;
  min-height:48px;
  white-space:nowrap;
}
.grip{
  background:#0F172A; border:1px solid #243041; color:#9CA3AF;
  border-radius:10px; padding:6px; cursor:grab; flex-shrink:0;
}
.grip:active{ cursor:grabbing; }
.chev{
  background:#0F172A; border:1px solid #243041; color:#E5E7EB;
  border-radius:10px; padding:6px 10px; min-width:36px; flex-shrink:0;
}
.name{
  font-size:15px;
  overflow:hidden; text-overflow:ellipsis;
  flex:1;
}
.spacer{ flex:1; }

.pill { font-size:12px; padding:4px 8px; border-radius:999px; border:1px solid #243041; }
.pill--on { background:#0F2A12; color:#92E6A7; border-color:#1E3A23; }
.pill--off { background:#2A0F0F; color:#F5A7A7; border-color:#3A1E1E; }

.edit { margin-top: 8px; }
.erow { display:grid; grid-template-columns: 220px 1fr auto; gap:10px; align-items:start; margin:10px 0 }
.elbl { color:#9CA3AF; }
.eval { white-space:pre-wrap; color:#E5E7EB; border:1px solid #1F2937; background:#0F172A; border-radius:10px; padding:10px }

.btn { border:1px solid transparent; border-radius:12px; padding:10px 14px; cursor:pointer; font-weight:600; }
.btn--primary { background:#2563EB; color:#fff; }
.btn--danger { background:#DC2626; color:#fff; }
.btn--ghost { background:#111827; color:#E5E7EB; border-color:#243041; }
.btn--sm { padding:6px 10px; border-radius:10px; font-size:12px; }

.cal-alert { background:#3B0D0D; border:1px solid #7F1D1D; color:#FECACA; padding:10px 12px; border-radius:12px; }

.grid { display:grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.grid .full { grid-column: 1 / -1; }
.rcm-actions { display:flex; justify-content:flex-end; margin-top:8px }

.cal-input { width:100%; padding:8px 10px; border-radius:10px; border:1px solid #243041; background:#0B1220; color:#E5E7EB; outline:none; transition:border-color .2s, box-shadow .2s; }
.cal-input:focus { border-color:#2E4B8F; box-shadow:0 0 0 3px rgba(37,99,235,0.25); }

/* Toggle switch */
.switch { position:relative; width:74px; height:36px; border-radius:18px; border:2px solid #e5e7eb55; background:#0F172A; display:flex; align-items:center; padding:0 4px; cursor:pointer; }
.knob { width:28px; height:28px; background:#fff; border-radius:50%; transform:translateX(0); transition:transform .18s ease; }
.knob.on { transform:translateX(36px); }
.switch-text { position:absolute; right:10px; font-size:12px; color:#E5E7EB; pointer-events:none; }

@media (max-width: 900px){
  .grid { grid-template-columns: 1fr; }
  .erow { grid-template-columns: 1fr; }
}
`;
