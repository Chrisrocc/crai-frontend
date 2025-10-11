// src/components/Car/CarListSplit.jsx
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from "react";
import api from "../../lib/api";
import CarFormModal from "./CarFormModal";
import CarProfileModal from "./CarProfileModal";
import ChecklistFormModal from "./ChecklistFormModal";
import NextLocationsFormModal from "./NextLocationsFormModal";
import "./CarList.css";

const STAGES = ["In Works", "In Works/Online", "Online", "Sold"];

const TrashIcon = ({ size = 16 }) => (
  <svg className="icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
    <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const isSold = (car = {}) => String(car.stage || "").trim().toLowerCase() === "sold";

const carString = (car) => {
  const head = [car.make, car.model].filter(Boolean).join(" ").trim();
  const tail = [];
  const b = (car.badge || "").slice(0, 4).trim();
  if (b) tail.push(b);
  if (car.year) tail.push(String(car.year));
  if (car.description) tail.push(car.description);
  if (car.rego) tail.push(car.rego);
  return [head, tail.join(", ")].filter(Boolean).join(", ");
};

export default function CarListSplit({ embedded = false, listOverride }) {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState(null);

  // header UI (only meaningful when not embedded)
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState(() => new Set(STAGES));
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");

  // per-cell editing
  const [editTarget, setEditTarget] = useState({ id: null, field: null });
  const [editData, setEditData] = useState({});
  const savingRef = useRef(false);
  const activeRef = useRef(null);
  const caretRef = useRef({ name: null, start: null, end: null });
  const stageDirtyRef = useRef(false);

  // modals
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedCar, setSelectedCar] = useState(null);
  const [checklistModal, setChecklistModal] = useState({ open: false, car: null });
  const [nextModal, setNextModal] = useState({ open: false, car: null });

  useEffect(() => {
    if (listOverride) {
      setCars(listOverride);
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await api.get("/cars", { headers: { "Cache-Control": "no-cache" } });
        setCars(res.data?.data || []);
      } catch (err) {
        setErrMsg(err.response?.data?.message || err.message || "Error fetching cars");
      } finally {
        setLoading(false);
      }
    })();
  }, [listOverride]);

  const refreshCars = useCallback(async () => {
    if (listOverride) return;
    try {
      const res = await api.get("/cars", { headers: { "Cache-Control": "no-cache" } });
      setCars(res.data?.data || []);
    } catch (err) {
      setErrMsg(err.response?.data?.message || err.message || "Error fetching cars");
    }
  }, [listOverride]);

  /* ---------- editing helpers ---------- */
  const startEdit = (car, field, focusName = null) => {
    setEditTarget({ id: car._id, field });
    const base = {
      make: car.make ?? "",
      model: car.model ?? "",
      badge: (car.badge ?? "").slice(0, 4),
      rego: car.rego ?? "",
      year: car.year ?? "",
      description: car.description ?? "",
      location: car.location ?? "",
      notes: car.notes ?? "",
      stage: car.stage ?? "In Works",
    };
    setEditData(base);

    if (field === "stage") {
      stageDirtyRef.current = false;
      caretRef.current = { name: null, start: null, end: null };
      return;
    }
    caretRef.current = { name: focusName, start: null, end: null };
    requestAnimationFrame(() => {
      const root = activeRef.current;
      const el =
        (focusName && root?.querySelector(`[name="${CSS.escape(focusName)}"]`)) ||
        root?.querySelector("input, textarea, select");
      if (el) { el.focus(); el.select?.(); }
    });
  };

  const rememberCaret = (e) => {
    const { name, selectionStart, selectionEnd } = e.target;
    caretRef.current = { name, start: selectionStart ?? null, end: selectionEnd ?? null };
  };

  const handleChange = (e) => {
    rememberCaret(e);
    const { name, value } = e.target;
    if (name === "year") return setEditData((p) => ({ ...p, year: value.replace(/[^\d]/g, "") }));
    if (name === "badge") return setEditData((p) => ({ ...p, badge: value.slice(0, 4) }));
    if (name === "rego") {
      const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
      return setEditData((p) => ({ ...p, rego: clean }));
    }
    setEditData((p) => ({ ...p, [name]: value }));
  };

  useLayoutEffect(() => {
    if (!editTarget.id || editTarget.field === "stage") return;
    const { name, start, end } = caretRef.current || {};
    const root = activeRef.current;
    if (!root) return;
    const el =
      (name && root.querySelector(`[name="${CSS.escape(name)}"]`)) ||
      root.querySelector("input, textarea, select");
    if (!el) return;
    if (document.activeElement !== el) el.focus();
    if (typeof el.setSelectionRange === "function" && "value" in el) {
      const v = el.value ?? "";
      const s = typeof start === "number" ? Math.min(start, v.length) : v.length;
      const ee = typeof end === "number" ? Math.min(end, v.length) : v.length;
      el.setSelectionRange(s, ee);
    }
  }, [editData, editTarget]);

  const saveChanges = async () => {
    if (!editTarget.id || savingRef.current) return;
    savingRef.current = true;
    try {
      let payload = {};
      switch (editTarget.field) {
        case "car":
          payload = {
            make: (editData.make || "").trim(),
            model: (editData.model || "").trim(),
            badge: (editData.badge || "").trim(),
            rego: (editData.rego || "").trim(),
            year: editData.year === "" ? undefined : Number(editData.year),
            description: (editData.description || "").trim(),
          };
          break;
        case "location":
          payload = { location: (editData.location || "").trim() };
          break;
        case "notes":
          payload = { notes: (editData.notes || "").trim() };
          break;
        case "stage":
          payload = { stage: (editData.stage || "In Works").trim() };
          break;
        default:
          break;
      }
      const res = await api.put(`/cars/${editTarget.id}`, payload, {
        headers: { "Content-Type": "application/json" },
      });
      if (res.data?.data && !listOverride) {
        setCars((prev) => prev.map((c) => (c._id === editTarget.id ? res.data.data : c)));
      } else if (!listOverride) {
        await refreshCars();
      }
      setEditTarget({ id: null, field: null });
    } catch (err) {
      alert("Error updating car: " + (err.response?.data?.message || err.message));
      await refreshCars();
      setEditTarget({ id: null, field: null });
    } finally {
      savingRef.current = false;
    }
  };

  useEffect(() => {
    const onDown = (e) => {
      if (!editTarget.id) return;
      const rowEl = document.querySelector(`tr[data-id="${editTarget.id}"]`);
      if (!rowEl) return;
      if (!rowEl.contains(e.target)) {
        if (editTarget.field === "stage" && !stageDirtyRef.current) {
          setEditTarget({ id: null, field: null });
        } else {
          saveChanges();
        }
      }
    };
    if (editTarget.id) document.addEventListener("mousedown", onDown);
    if (editTarget.id) document.addEventListener("touchstart", onDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTarget, editData]);

  const handleDelete = async (carId) => {
    if (!window.confirm("Delete this car?")) return;
    try {
      await api.delete(`/cars/${carId}`);
      await refreshCars();
    } catch (err) {
      alert("Delete failed: " + (err.response?.data?.message || err.message));
    }
  };

  /* ---------- header actions (standalone Split only) ---------- */
  const triggerCsv = () => fileInputRef.current?.click();
  const handleCsvChosen = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("defaultStage", "In Works");
      const res = await api.post("/cars/import-csv", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const { createdCount = 0, skippedCount = 0, errorCount = 0 } = res.data || {};
      alert(`Import complete\nCreated: ${createdCount}\nSkipped: ${skippedCount}\nErrors: ${errorCount}`);
      await refreshCars();
    } catch (err) {
      alert(`CSV import failed: ${err.response?.data?.message || err.message}`);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const submitPaste = async () => {
    try {
      const res = await api.post(
        "/cars/mark-online-from-text",
        { text: pasteText },
        { headers: { "Content-Type": "application/json" } }
      );
      const d = res.data?.data || {};
      alert(
        `Processed.\nChanged: ${d.totals?.changed ?? 0}\nSkipped: ${d.totals?.skipped ?? 0}\nNot found: ${d.totals?.notFound ?? 0}`
      );
      setPasteOpen(false);
      setPasteText("");
      await refreshCars();
    } catch (e) {
      alert(e.response?.data?.message || e.message || "Error processing pasted list");
    }
  };

  /* ---------- data shaping for display ---------- */
  const filtered = useMemo(() => {
    let list = cars;
    if (!embedded) {
      list = stageFilter.size > 0 ? list.filter((c) => stageFilter.has(c?.stage ?? "")) : [];
      const q = query.trim().toLowerCase();
      if (q) {
        list = list.filter((car) => {
          const hay = [
            car.make, car.model, car.badge, car.rego, car.year, car.description,
            car.location, car.stage,
            ...(Array.isArray(car.nextLocations) ? car.nextLocations : [car.nextLocation]),
            ...(Array.isArray(car.checklist) ? car.checklist : []),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return hay.includes(q);
        });
      }
    }
    const sold = [], other = [];
    for (const c of list) (isSold(c) ? sold : other).push(c);
    const ordered = [...sold, ...other];
    const mid = Math.ceil(ordered.length / 2);
    return [ordered.slice(0, mid), ordered.slice(mid)];
  }, [cars, query, stageFilter, embedded]);

  if (loading) {
    return <div className="page-pad">Loading…</div>;
  }

  return (
    <div className="page-pad">
      {/* Local layout/compact styles */}
      <style>{`
        /* Split grid – no page-level horizontal scrollbar */
        .split-panels{
          display:grid;
          grid-template-columns: 1fr;
          gap:12px;
        }
        @media (min-width: 1100px){
          .split-panels{ grid-template-columns: 1fr 1fr; }
        }

        /* Make toolbars compact */
        .toolbar.header-row { gap:10px; }
        .toolbar .btn, .toolbar .chip { transform: translateZ(0); }

        /* Table wrapper ensures ONLY table scrolls horizontally */
        .table-wrap{
          position:relative;
          overflow-x:auto;
          overflow-y:hidden;
          -webkit-overflow-scrolling:touch;
          border:1px solid #1d2a3a;
          border-radius:10px;
          background:#0b1220;
        }

        /* Base density */
        .car-table{
          width:100%;
          table-layout:fixed;
          border-collapse:separate;
          border-spacing:0;
          font-size:13px;
          line-height:1.25;
        }
        .car-table th,.car-table td{ padding:6px 8px; vertical-align:middle; }
        .car-table thead th{ position:sticky; top:0; background:#0f1a2b; z-index:1; }

        /* Default (fits most laptops); columns use conservative widths */
        .car-table col.col-car{ width:340px; }
        .car-table col.col-loc{ width:100px; }
        .car-table col.col-next{ width:160px; }
        .car-table col.col-chk{ width:220px; }
        .car-table col.col-notes{ width:160px; }
        .car-table col.col-stage{ width:84px; }
        .car-table col.col-act{ width:74px; }

        /* Ultra-compact DESKTOP mode (≥1400px) – squeeze both tables to show all cols */
        @media (min-width: 1400px){
          .car-table{ font-size:12px; }
          .car-table th,.car-table td{ padding:4px 6px; }
          .car-table col.col-car{ width:300px; }
          .car-table col.col-loc{ width:88px; }
          .car-table col.col-next{ width:140px; }
          .car-table col.col-chk{ width:200px; }
          .car-table col.col-notes{ width:150px; }
          .car-table col.col-stage{ width:80px; }
          .car-table col.col-act{ width:70px; }
        }

        /* Keep first column visible and text ellipsized */
        thead th:first-child, tbody td:first-child{ display:table-cell !important; }
        .car-table .cell{ display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100%; }

        /* Editing visuals */
        td.is-editing{ background:#0c1a2e; box-shadow: inset 0 0 0 1px #2b3b54; border-radius:8px; }
        .edit-cell{ display:flex; align-items:center; gap:8px; }
        .edit-cell-group{ display:flex; flex-direction:column; gap:6px; }
        .edit-inline{ display:flex; gap:6px; }
        .edit-actions{ display:flex; gap:6px; margin-top:2px; }
        .input.input--compact{ padding:6px 8px; font-size:12px; line-height:1.2; }

        /* Buttons: smaller footprint */
        .btn{ border:1px solid transparent; border-radius:10px; padding:6px 10px; cursor:pointer; font-weight:600; }
        .btn--xs{ font-size:12px; padding:4px 8px; }
        .btn--icon{ padding:4px; width:28px; height:24px; display:inline-flex; align-items:center; justify-content:center; }
        .btn--danger{ background:#DC2626; color:#fff; }
        .btn--kebab{ background:#1f2a3e; color:#c9d3e3; }

        :root{
          --sold-bg: rgba(14, 165, 233, 0.12);
          --sold-bg-hover: rgba(14, 165, 233, 0.18);
          --sold-border: rgba(14, 165, 233, 0.35);
        }
        .car-table tr.row--sold td{
          background: var(--sold-bg);
          box-shadow: inset 0 0 0 1px var(--sold-border);
        }
        .car-table tr.row--sold:hover td{ background: var(--sold-bg-hover); }

        /* Trim internal gaps in header controls so more space goes to tables */
        .chip-row{ gap:6px !important; }
        .btn-row{ gap:6px !important; }
      `}</style>

      {/* Header (hidden when embedded) */}
      {!embedded && (
        <div className="toolbar header-row">
          <h1 className="title" style={{ margin: 0 }}>Car Inventory</h1>
          <p className="subtitle" style={{ margin: 0 }}>{cars.length} cars</p>

          <div className="chip-row" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {STAGES.map((s) => {
              const on = stageFilter.has(s);
              return (
                <button
                  key={s}
                  className={`chip ${on ? "chip--on" : ""}`}
                  onClick={() =>
                    setStageFilter((prev) => {
                      const next = new Set(prev);
                      if (next.has(s)) next.delete(s);
                      else next.add(s);
                      return next;
                    })
                  }
                  title={s}
                >
                  {s}
                </button>
              );
            })}
          </div>

          <input
            className="input searchbar"
            placeholder="Search cars…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: "1 1 360px", minWidth: 220 }}
          />

          <div className="btn-row" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn--primary" onClick={() => setShowForm(true)}>+ Add New Car</button>
            <button className="btn btn--muted" onClick={triggerCsv} disabled={uploading}>
              {uploading ? "Uploading…" : "Upload CSV"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: "none" }}
              onChange={handleCsvChosen}
            />
            <button className="btn btn--muted" onClick={() => setPasteOpen(true)}>Paste Online List</button>
          </div>
        </div>
      )}

      {errMsg && <div className="alert alert--error">{errMsg}</div>}

      {/* Two tables side by side */}
      <div className="split-panels">
        <Table
          list={filtered[0]}
          {...{ editTarget, setEditTarget, editData, startEdit, rememberCaret, handleChange, saveChanges, stageDirtyRef, activeRef, setProfileOpen, setSelectedCar, setChecklistModal, setNextModal, handleDelete }}
        />
        <Table
          list={filtered[1]}
          {...{ editTarget, setEditTarget, editData, startEdit, rememberCaret, handleChange, saveChanges, stageDirtyRef, activeRef, setProfileOpen, setSelectedCar, setChecklistModal, setNextModal, handleDelete }}
        />
      </div>

      {/* Modals */}
      {showForm && <CarFormModal show={showForm} onClose={() => setShowForm(false)} onSave={refreshCars} />}

      {profileOpen && <CarProfileModal open={profileOpen} car={selectedCar} onClose={() => setProfileOpen(false)} />}

      {checklistModal.open && (
        <ChecklistFormModal
          open
          items={checklistModal.car?.checklist ?? []}
          onSave={async (items) => {
            if (!checklistModal.car) return;
            try {
              await api.put(`/cars/${checklistModal.car._id}`, { checklist: items }, {
                headers: { "Content-Type": "application/json" },
              });
              await refreshCars();
            } catch (e) {
              alert(e.response?.data?.message || e.message || "Error saving checklist");
            } finally {
              setChecklistModal({ open: false, car: null });
            }
          }}
          onClose={() => setChecklistModal({ open: false, car: null })}
        />
      )}

      {nextModal.open && (
        <NextLocationsFormModal
          open
          items={
            Array.isArray(nextModal.car?.nextLocations)
              ? nextModal.car.nextLocations
              : (nextModal.car?.nextLocation ? [nextModal.car.nextLocation] : [])
          }
          onSave={async (items) => {
            if (!nextModal.car) return;
            try {
              await api.put(`/cars/${nextModal.car._id}`, {
                nextLocations: items,
                nextLocation: items[items.length - 1] ?? "",
              }, { headers: { "Content-Type": "application/json" } });
              await refreshCars();
            } catch (e) {
              alert(e.response?.data?.message || e.message || "Error saving destinations");
            } finally {
              setNextModal({ open: false, car: null });
            }
          }}
          onSetCurrent={async (loc) => {
            if (!nextModal.car) return;
            try {
              const existing = Array.isArray(nextModal.car.nextLocations)
                ? nextModal.car.nextLocations
                : (nextModal.car.nextLocation ? [nextModal.car.nextLocation] : []);
              const remaining = existing.filter((s) => s !== loc);
              await api.put(`/cars/${nextModal.car._id}`, {
                location: loc,
                nextLocations: remaining,
                nextLocation: remaining[remaining.length - 1] ?? "",
              }, { headers: { "Content-Type": "application/json" } });
              await refreshCars();
            } catch (e) {
              alert(e.response?.data?.message || e.message || "Error setting current location");
            }
          }}
          onClose={() => setNextModal({ open: false, car: null })}
        />
      )}

      {pasteOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setPasteOpen(false)}
        >
          <div style={{ background: "#0b1220", border: "1px solid #243041", borderRadius: 12, width: "min(900px, 92vw)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: 14, borderBottom: "1px solid #243041" }}>
              <h3 style={{ margin: 0 }}>Paste Autogate List</h3>
              <p style={{ margin: "4px 0 0", color: "#9CA3AF", fontSize: 13 }}>
                We’ll set cars to <b>Online</b> only if they’re currently <b>In Works</b>.
              </p>
            </div>
            <div style={{ padding: 14 }}>
              <textarea className="input" style={{ width: "100%", minHeight: 280, resize: "vertical" }} placeholder="Paste the whole Autogate block here…" value={pasteText} onChange={(e) => setPasteText(e.target.value)} />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
                <button className="btn" onClick={() => setPasteOpen(false)}>Cancel</button>
                <button className="btn btn--primary" onClick={submitPaste}>Process</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Table ---------- */
function Table({
  list,
  editTarget,
  setEditTarget,
  editData,
  startEdit,
  handleChange,
  rememberCaret,
  saveChanges,
  stageDirtyRef,
  activeRef,
  setProfileOpen,
  setSelectedCar,
  setChecklistModal,
  setNextModal,
  handleDelete,
}) {
  return (
    <div className="table-wrap">
      <table className="car-table">
        <colgroup>
          <col className="col-car" />
          <col className="col-loc" />
          <col className="col-next" />
          <col className="col-chk" />
          <col className="col-notes" />
          <col className="col-stage" />
          <col className="col-act" />
        </colgroup>
        <thead>
          <tr>
            <th>Car</th>
            <th>Location</th>
            <th>Next Loc</th>
            <th>Checklist</th>
            <th>Notes</th>
            <th>Stage</th>
            <th>Act</th>
          </tr>
        </thead>
        <tbody>
          {list.length === 0 ? (
            <tr><td colSpan={7} className="empty">No cars.</td></tr>
          ) : (
            list.map((car) => {
              const editing = editTarget.id === car._id ? editTarget.field : null;
              const refCb =
                editing ? (el) => { activeRef.current = el || activeRef.current; } : null;

              return (
                <tr key={car._id} data-id={car._id} className={isSold(car) ? "row--sold" : ""} ref={refCb}>
                  {/* CAR */}
                  <td onDoubleClick={() => editing !== "car" && startEdit(car, "car", "make")} className={editing === "car" ? "is-editing" : ""}>
                    {editing === "car" ? (
                      <div className="edit-cell-group">
                        <input className="input input--compact" name="make" value={editData.make} onChange={handleChange} onKeyUp={rememberCaret} onClick={rememberCaret} placeholder="Make" />
                        <input className="input input--compact" name="model" value={editData.model} onChange={handleChange} onKeyUp={rememberCaret} onClick={rememberCaret} placeholder="Model" />
                        <div className="edit-inline">
                          <input className="input input--compact" name="badge" value={editData.badge} maxLength={4} onChange={handleChange} onKeyUp={rememberCaret} onClick={rememberCaret} placeholder="Badge" />
                          <input className="input input--compact" name="year" value={editData.year} onChange={handleChange} onKeyUp={rememberCaret} onClick={rememberCaret} placeholder="Year" />
                        </div>
                        <input className="input input--compact" name="description" value={editData.description} onChange={handleChange} onKeyUp={rememberCaret} onClick={rememberCaret} placeholder="Description" />
                        <input className="input input--compact" name="rego" value={editData.rego} onChange={handleChange} onKeyUp={rememberCaret} onClick={rememberCaret} placeholder="REGO" style={{ textTransform: "uppercase" }} />
                        <div className="edit-actions">
                          <button className="btn btn--primary" onClick={saveChanges}>Save</button>
                          <button className="btn" onClick={() => setEditTarget({ id: null, field: null })}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <span className="cell" title={carString(car)}>{carString(car) || "-"}</span>
                    )}
                  </td>

                  {/* LOCATION */}
                  <td onDoubleClick={() => editing !== "location" && startEdit(car, "location", "location")} className={editing === "location" ? "is-editing" : ""}>
                    {editing === "location" ? (
                      <div className="edit-cell">
                        <input className="input input--compact" name="location" value={editData.location} onChange={handleChange} onKeyUp={rememberCaret} onClick={rememberCaret} />
                        <div className="edit-actions"><button className="btn btn--primary" onClick={saveChanges}>Save</button></div>
                      </div>
                    ) : (
                      <span className="cell" title={car.location || ""}>{car.location || "-"}</span>
                    )}
                  </td>

                  {/* NEXT (modal) */}
                  <td onDoubleClick={() => setNextModal({ open: true, car })}>
                    <span className="cell" title={
                      Array.isArray(car.nextLocations) && car.nextLocations.length
                        ? car.nextLocations.join(", ")
                        : (car.nextLocation || "")
                    }>
                      {Array.isArray(car.nextLocations) && car.nextLocations.length
                        ? car.nextLocations.join(", ")
                        : car.nextLocation || "-"}
                    </span>
                  </td>

                  {/* CHECKLIST (modal) */}
                  <td onDoubleClick={() => setChecklistModal({ open: true, car })} onClick={() => setChecklistModal({ open: true, car })}>
                    <span className="cell" title={Array.isArray(car.checklist) ? car.checklist.join(", ") : ""}>
                      {Array.isArray(car.checklist) && car.checklist.length ? car.checklist.join(", ") : "-"}
                    </span>
                  </td>

                  {/* NOTES */}
                  <td onDoubleClick={() => editing !== "notes" && startEdit(car, "notes", "notes")} className={editing === "notes" ? "is-editing" : ""}>
                    {editing === "notes" ? (
                      <div className="edit-cell">
                        <input className="input input--compact" name="notes" value={editData.notes} onChange={handleChange} onKeyUp={rememberCaret} onClick={rememberCaret} placeholder="Short notes" />
                        <div className="edit-actions"><button className="btn btn--primary" onClick={saveChanges}>Save</button></div>
                      </div>
                    ) : (
                      <span className="cell" title={car.notes || ""}>{car.notes || "-"}</span>
                    )}
                  </td>

                  {/* STAGE */}
                  <td onDoubleClick={() => editing !== "stage" && startEdit(car, "stage", "stage")} className={editing === "stage" ? "is-editing" : ""}>
                    {editing === "stage" ? (
                      <div className="edit-cell">
                        <select
                          className="input input--compact input--select-lg"
                          name="stage"
                          value={editData.stage}
                          onChange={(e) => { stageDirtyRef.current = true; return handleChange(e); }}
                          onBlur={() => {
                            if (stageDirtyRef.current) saveChanges();
                            else setEditTarget({ id: null, field: null });
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                        >
                          {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    ) : (
                      <span className="cell">{car.stage || "-"}</span>
                    )}
                  </td>

                  {/* ACTIONS */}
                  <td>
                    <div className="actions" style={{ display: "flex", gap: 6 }}>
                      <button
                        className="btn btn--kebab btn--xs"
                        title="Open car profile"
                        onClick={() => { setSelectedCar(car); setProfileOpen(true); }}
                      >
                        ⋯
                      </button>
                      <button className="btn btn--danger btn--xs btn--icon" title="Delete car" aria-label="Delete" onClick={() => handleDelete(car._id)}>
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
