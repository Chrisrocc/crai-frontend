// src/components/Car/CarListSplit.jsx
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import api from "../../lib/api";
import CarFormModal from "./CarFormModal";
import CarProfileModal from "./CarProfileModal";
import ChecklistFormModal from "./ChecklistFormModal";
import NextLocationsFormModal from "./NextLocationsFormModal";
import "./CarList.css";

const STAGES = ["In Works", "In Works/Online", "Online", "Sold"];

/* icons */
const TrashIcon = ({ size = 16 }) => (
  <svg className="icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
    <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const isSold = (car = {}) => String(car.stage || "").trim().toLowerCase() === "sold";

/* helpers */
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

export default function CarListSplit({ listOverride }) {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState(null);

  // per-cell editing
  // field: "car" | "location" | "notes" | "stage"
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

  const refreshCars = async () => {
    if (listOverride) return;
    try {
      const res = await api.get("/cars", { headers: { "Cache-Control": "no-cache" } });
      setCars(res.data?.data || []);
    } catch (err) {
      setErrMsg(err.response?.data?.message || err.message || "Error fetching cars");
    }
  };

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
      if (el) {
        el.focus();
        el.select?.();
      }
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

  // click outside to save (or exit if no change for stage)
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

  // lift sold to top, then split
  const ordered = useMemo(() => {
    const sold = [], other = [];
    for (const c of cars) (isSold(c) ? sold : other).push(c);
    return [...sold, ...other];
  }, [cars]);

  const mid = Math.ceil(ordered.length / 2);

  if (loading) {
    return (
      <div className="page-pad">
        <style>{cssFix}</style>
        Loading…
      </div>
    );
  }

  return (
    <div className="page-pad">
      <style>{cssFix}</style>

      {errMsg && <div className="alert alert--error">{errMsg}</div>}

      <div className="split-grid">
        <Table
          list={ordered.slice(0, mid)}
          editTarget={editTarget}
          setEditTarget={setEditTarget}
          editData={editData}
          setEditData={setEditData}
          startEdit={startEdit}
          rememberCaret={rememberCaret}
          handleChange={handleChange}
          saveChanges={saveChanges}
          stageDirtyRef={stageDirtyRef}
          activeRef={activeRef}
          setProfileOpen={setProfileOpen}
          setSelectedCar={setSelectedCar}
          setChecklistModal={setChecklistModal}
          setNextModal={setNextModal}
          handleDelete={handleDelete}
        />
        <Table
          list={ordered.slice(mid)}
          editTarget={editTarget}
          setEditTarget={setEditTarget}
          editData={editData}
          setEditData={setEditData}
          startEdit={startEdit}
          rememberCaret={rememberCaret}
          handleChange={handleChange}
          saveChanges={saveChanges}
          stageDirtyRef={stageDirtyRef}
          activeRef={activeRef}
          setProfileOpen={setProfileOpen}
          setSelectedCar={setSelectedCar}
          setChecklistModal={setChecklistModal}
          setNextModal={setNextModal}
          handleDelete={handleDelete}
        />
      </div>

      {/* Modals */}
      {profileOpen && (
        <CarProfileModal open={profileOpen} car={selectedCar} onClose={() => setProfileOpen(false)} />
      )}

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
          items={Array.isArray(nextModal.car?.nextLocations) ? nextModal.car.nextLocations
            : (nextModal.car?.nextLocation ? [nextModal.car.nextLocation] : [])}
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
                      <span className="cell">{carString(car) || "-"}</span>
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
                      <span className="cell">{car.location || "-"}</span>
                    )}
                  </td>

                  {/* NEXT (modal) */}
                  <td onDoubleClick={() => setNextModal({ open: true, car })}>
                    <span className="cell">
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
                      <span className="cell">{car.notes || "-"}</span>
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
                    <div className="actions">
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

/* ---------- styles ---------- */
const cssFix = `
.page-pad{ padding:12px; }
.split-grid{ display:grid; grid-template-columns:1fr 1fr; gap:12px; align-items:start; }
@media (max-width: 1100px){ .split-grid{ grid-template-columns:1fr; } }

/* table wrapper */
.table-wrap{ position:relative; overflow-x:auto; overflow-y:hidden; -webkit-overflow-scrolling:touch; }
.table-wrap::-webkit-scrollbar{ height:12px; }
.table-wrap::-webkit-scrollbar-track{ background:#0B1220; border-radius:10px; }
.table-wrap::-webkit-scrollbar-thumb{ background:#59637C; border:2px solid #0B1220; border-radius:10px; }
.table-wrap:hover::-webkit-scrollbar-thumb{ background:#7B88A6; }

/* table */
.car-table{ width:100%; table-layout:fixed; border-collapse:separate; border-spacing:0; min-width: 980px; }
.car-table th,.car-table td{ padding:6px 10px; vertical-align:middle; }
.car-table thead th{ text-align:left; color:#9CA3AF; font-size:12px; }

/* columns */
.car-table col.col-car{ width:380px; }
.car-table col.col-loc{ width:120px; }
.car-table col.col-next{ width:220px; }
.car-table col.col-chk{ width:260px; }
.car-table col.col-notes{ width:220px; }
.car-table col.col-stage{ width:100px; }
.car-table col.col-act{ width:90px; }

/* cells */
.cell{ display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100%; }
td.is-editing{ background:#0c1a2e; box-shadow: inset 0 0 0 1px #2b3b54; border-radius:8px; }
.edit-cell{ display:flex; align-items:center; gap:8px; }
.edit-cell-group{ display:flex; flex-direction:column; gap:8px; }
.edit-inline{ display:flex; gap:8px; }
.edit-actions{ display:flex; gap:8px; margin-top:4px; }

.input{
  background:#0b1220; color:#e5e7eb; border:1px solid #243041; border-radius:10px;
  padding:8px 10px; outline:none; width:100%;
}
.input--compact{ padding:8px 10px; border-radius:8px; }
.input--select-lg{ min-height:44px; font-size:16px; }

/* actions */
.actions{ display:flex; gap:8px; justify-content:center; align-items:center; }
.btn{ border:1px solid transparent; border-radius:10px; padding:6px 10px; cursor:pointer; font-weight:600; }
.btn--danger{ background:#DC2626; color:#fff; }
.btn--xs{ font-size:12px; padding:4px 8px; }
.btn--icon{ padding:6px; width:32px; height:28px; display:inline-flex; align-items:center; justify-content:center; }
.btn--kebab{ background:#374151; color:#E5E7EB; }

/* sold tint */
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

/* empty */
.empty{ text-align:center; color:#9CA3AF; padding:10px; }
`;
