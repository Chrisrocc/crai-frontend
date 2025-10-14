// src/components/Car/CarListSplit.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import api from "../../lib/api";
import ChecklistFormModal from "./ChecklistFormModal";
import NextLocationsFormModal from "./NextLocationsFormModal";

const STAGES = ["In Works", "In Works/Online", "Online", "Sold"];
const isSold = (car = {}) => String(car.stage || "").trim().toLowerCase() === "sold";
const normalize = (v) => (v == null ? "" : Array.isArray(v) ? v.join(", ") : String(v));
const compareStr = (a, b, dir) => {
  const A = normalize(a).toLowerCase();
  const B = normalize(b).toLowerCase();
  if (A === B) return 0;
  return dir === "desc" ? (A < B ? 1 : -1) : (A < B ? -1 : 1);
};
const nextDir = (d) => (d === null ? "desc" : d === "desc" ? "asc" : null);

export default function CarListSplit({
  embedded = false,
  listOverride = null,
  sortState = { key: null, dir: null },
  onSaved, // optional callback for parent to refresh when embedded
}) {
  // data
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(!embedded);
  const [errMsg, setErrMsg] = useState(null); // JS only (no TS generics)

  // filters/sort
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(sortState?.key ? sortState : { key: null, dir: null });
  const clickSort = (key) =>
    setSort((prev) => ({
      key: prev.key === key && prev.dir ? key : key,
      dir: prev.key === key ? nextDir(prev.dir) : "desc",
    }));

  // stage chips
  const [stageFilter, setStageFilter] = useState(() => new Set(STAGES));

  // modals
  const [checklistModal, setChecklistModal] = useState({ open: false, car: null });
  const [nextModal, setNextModal] = useState({ open: false, car: null });
  const openChecklist = (car) => setChecklistModal({ open: true, car });
  const openNext = (car) => setNextModal({ open: true, car });
  const closeChecklist = () => setChecklistModal({ open: false, car: null });
  const closeNext = () => setNextModal({ open: false, car: null });

  // overlay editor state
  // field: "car" | "location" | "next" | "checklist" | "notes" | "stage"
  const [editTarget, setEditTarget] = useState({ id: null, field: null });
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const overlayRef = useRef(null);
  const stageDirtyRef = useRef(false);

  const fetchCars = useCallback(async () => {
    if (embedded) return;
    setLoading(true);
    try {
      const res = await api.get("/cars", { headers: { "Cache-Control": "no-cache" } });
      const data = res.data?.data || [];
      setCars(data);
      setErrMsg(null);
    } catch (e) {
      setErrMsg(e?.response?.data?.message || e.message || "Error fetching cars");
    } finally {
      setLoading(false);
    }
  }, [embedded]);

  useEffect(() => {
    if (!embedded) fetchCars();
  }, [embedded, fetchCars]);

  // master list
  const baseList = listOverride || cars;

  // filter + sort
  const filteredSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = baseList;

    list = stageFilter.size > 0 ? list.filter((c) => stageFilter.has(c?.stage ?? "")) : [];

    if (q) {
      list = list.filter((car) => {
        const hay = [
          car.make,
          car.model,
          car.badge,
          car.rego,
          car.year,
          car.description,
          car.location,
          car.stage,
          ...(Array.isArray(car.nextLocations) ? car.nextLocations : [car.nextLocation]),
          ...(Array.isArray(car.checklist) ? car.checklist : []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    if (!sort.key || !sort.dir) return list;

    const dir = sort.dir;
    const cmp = (a, b) => {
      switch (sort.key) {
        case "car": {
          const byMake = compareStr(a.make, b.make, dir);
          if (byMake !== 0) return byMake;
          return compareStr(a.model, b.model, dir);
        }
        case "location":
          return compareStr(a.location, b.location, dir);
        case "notes":
          return compareStr(a.notes, b.notes, dir);
        case "stage":
          return compareStr(a.stage, b.stage, dir);
        default:
          return 0;
      }
    };
    return list.slice().sort(cmp);
  }, [baseList, query, sort, stageFilter]);

  // split lists
  const leftList = useMemo(() => filteredSorted.filter((c) => !isSold(c)), [filteredSorted]);
  const rightList = useMemo(() => filteredSorted.filter(isSold), [filteredSorted]);

  // helpers
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

  const beginEdit = (car, field) => {
    stageDirtyRef.current = false;
    setEditTarget({ id: car._id, field });
    const lastNext =
      Array.isArray(car.nextLocations) && car.nextLocations.length
        ? car.nextLocations[car.nextLocations.length - 1]
        : car.nextLocation ?? "";

    setEditData({
      _id: car._id,
      make: car.make ?? "",
      model: car.model ?? "",
      badge: (car.badge ?? "").slice(0, 4),
      year: car.year ?? "",
      rego: car.rego ?? "",
      description: car.description ?? "",
      location: car.location ?? "",
      nextLocation: lastNext || "",
      checklist: Array.isArray(car.checklist) ? car.checklist.join(", ") : car.checklist ?? "",
      notes: car.notes ?? "",
      stage: car.stage ?? "In Works",
    });
  };

  const closeEditor = () => setEditTarget({ id: null, field: null });

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "year") {
      return setEditData((p) => ({ ...p, year: value.replace(/[^\d]/g, "") }));
    }
    if (name === "rego") {
      const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
      return setEditData((p) => ({ ...p, rego: clean }));
    }
    if (name === "badge") {
      return setEditData((p) => ({ ...p, badge: value.slice(0, 4) }));
    }
    setEditData((p) => ({ ...p, [name]: value }));
  };

  // outside click to close/save
  useEffect(() => {
    if (!editTarget.id) return;
    const onDown = (e) => {
      const box = overlayRef.current;
      if (!box) return;
      if (!box.contains(e.target)) {
        if (editTarget.field === "stage" && !stageDirtyRef.current) return closeEditor();
        void saveChanges();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTarget, editData]);

  const refreshAfterSave = async (updated) => {
    if (onSaved) onSaved(updated?.data || null);
    if (listOverride) {
      // embedded: rely on parent refresh; just close.
      closeEditor();
      return;
    }
    if (updated?.data) {
      setCars((prev) => prev.map((c) => (c._id === updated.data._id ? updated.data : c)));
    } else {
      await fetchCars();
    }
    closeEditor();
  };

  const saveChanges = async () => {
    if (!editTarget.id || saving) return;
    setSaving(true);
    try {
      let payload = {};
      switch (editTarget.field) {
        case "car":
          payload = {
            make: (editData.make ?? "").trim(),
            model: (editData.model ?? "").trim(),
            badge: (editData.badge ?? "").trim(),
            rego: (editData.rego ?? "").trim(),
            year: editData.year === "" ? undefined : Number(editData.year),
            description: (editData.description ?? "").trim(),
          };
          break;
        case "location":
          payload = { location: (editData.location ?? "").trim() };
          break;
        case "next":
          payload = { nextLocation: (editData.nextLocation ?? "").trim() };
          break;
        case "checklist":
          payload = { checklist: (editData.checklist ?? "").trim() };
          break;
        case "notes":
          payload = { notes: (editData.notes ?? "").trim() };
          break;
        case "stage":
          payload = { stage: (editData.stage ?? "In Works").trim() };
          break;
        default:
          break;
      }

      const res = await api.put(`/cars/${editTarget.id}`, payload, {
        headers: { "Content-Type": "application/json" },
      });

      await refreshAfterSave(res.data);
      setErrMsg(null);
    } catch (e) {
      setErrMsg(e?.response?.data?.message || e.message || "Error saving");
    } finally {
      setSaving(false);
    }
  };

  const SortChevron = ({ dir }) => (
    <span style={{ marginLeft: 6, opacity: 0.8 }}>
      {dir === "desc" ? "↓" : dir === "asc" ? "↑" : ""}
    </span>
  );

  const Table = ({ list, title }) => (
    <div className="panel">
      <div className="panel-head">
        <h3>{title}</h3>
        <div className="search">
          <input
            className="input"
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {errMsg && (
        <div className="alert" role="alert" style={{ margin: "10px 12px 0" }}>
          {errMsg}
        </div>
      )}

      <div className="table-wrap compact">
        <table className="car-table">
          <colgroup>
            <col className="col-car" />
            <col className="col-loc" />
            <col className="col-notes" />
            <col className="col-stage" />
            <col className="col-act" />
          </colgroup>
          <thead>
            <tr>
              <th>
                <button className="thbtn" onClick={() => clickSort("car")}>
                  Car {sort.key === "car" && <SortChevron dir={sort.dir} />}
                </button>
              </th>
              <th>
                <button className="thbtn" onClick={() => clickSort("location")}>
                  Location {sort.key === "location" && <SortChevron dir={sort.dir} />}
                </button>
              </th>
              <th>
                <button className="thbtn" onClick={() => clickSort("notes")}>
                  Notes {sort.key === "notes" && <SortChevron dir={sort.dir} />}
                </button>
              </th>
              <th style={{ width: 90 }}>
                <button className="thbtn" onClick={() => clickSort("stage")}>
                  Stage {sort.key === "stage" && <SortChevron dir={sort.dir} />}
                </button>
              </th>
              <th style={{ width: 100 }}>Act</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty">
                  No cars.
                </td>
              </tr>
            ) : (
              list.map((car) => {
                const editing = editTarget.id === car._id;
                return (
                  <tr key={car._id} data-id={car._id} className={`row ${editing ? "row--editing" : ""}`}>
                    <td onDoubleClick={() => beginEdit(car, "car")} style={{ position: "relative" }}>
                      <span className="cell">{carString(car) || "-"}</span>
                    </td>

                    <td onDoubleClick={() => beginEdit(car, "location")} style={{ position: "relative" }}>
                      <span className="cell">{car.location || "-"}</span>
                    </td>

                    <td onDoubleClick={() => beginEdit(car, "notes")} style={{ position: "relative" }}>
                      <span className="cell">{car.notes || "-"}</span>
                    </td>

                    <td onDoubleClick={() => beginEdit(car, "stage")} style={{ position: "relative" }}>
                      {editTarget.id === car._id && editTarget.field === "stage" ? (
                        <select
                          ref={overlayRef}
                          className="input input--select-lg"
                          name="stage"
                          value={editData.stage}
                          onChange={(e) => {
                            setEditData((p) => ({ ...p, stage: e.target.value }));
                            stageDirtyRef.current = true;
                          }}
                          onBlur={() => {
                            if (stageDirtyRef.current) void saveChanges();
                            else closeEditor();
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {STAGES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="cell">{car.stage || "-"}</span>
                      )}
                    </td>

                    <td>
                      <div className="actions">
                        <button className="btn btn--muted btn--xs" onClick={() => openNext(car)}>
                          Next
                        </button>
                        <button className="btn btn--muted btn--xs" onClick={() => openChecklist(car)}>
                          Checklist
                        </button>
                      </div>
                    </td>

                    {/* EXPANDING OPAQUE OVERLAY EDITOR */}
                    {editing && editTarget.field !== "stage" && (
                      <td className="overlay-cell" colSpan={5}>
                        <div className="row-editor" ref={overlayRef} onClick={(e) => e.stopPropagation()}>
                          {editTarget.field === "car" && (
                            <div className="editor-grid">
                              <input className="input" name="make" placeholder="Make" value={editData.make} onChange={handleChange} />
                              <input className="input" name="model" placeholder="Model" value={editData.model} onChange={handleChange} />
                              <div className="inline-pair">
                                <input className="input" name="badge" maxLength={4} placeholder="Badge" value={editData.badge} onChange={handleChange} />
                                <input className="input" name="year" placeholder="Year" value={editData.year} onChange={handleChange} />
                              </div>
                              <input className="input" name="description" placeholder="Description" value={editData.description} onChange={handleChange} />
                              <input className="input" style={{ textTransform: "uppercase" }} name="rego" placeholder="REGO" value={editData.rego} onChange={handleChange} />
                            </div>
                          )}

                          {editTarget.field === "location" && (
                            <div className="editor-grid single">
                              <input className="input" name="location" placeholder="Current location…" value={editData.location} onChange={handleChange} autoFocus />
                            </div>
                          )}

                          {editTarget.field === "notes" && (
                            <div className="editor-grid single">
                              <input className="input" name="notes" placeholder="Short notes…" value={editData.notes} onChange={handleChange} autoFocus />
                            </div>
                          )}

                          {editTarget.field === "next" && (
                            <div className="editor-grid single">
                              <input className="input" name="nextLocation" placeholder="Next location…" value={editData.nextLocation} onChange={handleChange} autoFocus />
                            </div>
                          )}

                          {editTarget.field === "checklist" && (
                            <div className="editor-grid single">
                              <input className="input" name="checklist" placeholder="Checklist items (comma-separated)…" value={editData.checklist} onChange={handleChange} autoFocus />
                            </div>
                          )}

                          <div className="editor-actions">
                            <button className="btn" onClick={closeEditor} disabled={saving}>
                              Cancel
                            </button>
                            <button className="btn btn--primary" onClick={saveChanges} disabled={saving}>
                              {saving ? "Saving…" : "Save"}
                            </button>
                          </div>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (loading) return <div className="page-pad">Loading…</div>;

  return (
    <div className="split-panels">
      <style>{overlayCss}</style>

      {/* Page-level banner too (non-embedded cases) */}
      {errMsg && <div className="alert" role="alert">{errMsg}</div>}

      <div className="chip-row" style={{ gridColumn: "1 / -1" }}>
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

      <Table list={leftList} title="Active (In Works / Online)" />
      <Table list={rightList} title="Sold" />

      {checklistModal.open && (
        <ChecklistFormModal
          open
          items={checklistModal.car?.checklist ?? []}
          onSave={async (items) => {
            try {
              await api.put(`/cars/${checklistModal.car._id}`, { checklist: items }, { headers: { "Content-Type": "application/json" } });
              if (!embedded) await fetchCars();
              setErrMsg(null);
            } catch (e) {
              setErrMsg(e?.response?.data?.message || e.message || "Error saving checklist");
            } finally {
              closeChecklist();
            }
          }}
          onClose={closeChecklist}
        />
      )}

      {nextModal.open && (
        <NextLocationsFormModal
          open
          items={
            Array.isArray(nextModal.car?.nextLocations)
              ? nextModal.car.nextLocations
              : nextModal.car?.nextLocation
              ? [nextModal.car.nextLocation]
              : []
          }
          onSave={async (items) => {
            try {
              await api.put(
                `/cars/${nextModal.car._id}`,
                { nextLocations: items, nextLocation: items[items.length - 1] ?? "" },
                { headers: { "Content-Type": "application/json" } }
              );
              if (!embedded) await fetchCars();
              setErrMsg(null);
            } catch (e) {
              setErrMsg(e?.response?.data?.message || e.message || "Error saving destinations");
            } finally {
              closeNext();
            }
          }}
          onSetCurrent={async (loc) => {
            try {
              const existing = Array.isArray(nextModal.car.nextLocations)
                ? nextModal.car.nextLocations
                : nextModal.car.nextLocation
                ? [nextModal.car.nextLocation]
                : [];
              const remaining = existing.filter((s) => s !== loc);
              await api.put(
                `/cars/${nextModal.car._id}`,
                { location: loc, nextLocations: remaining, nextLocation: remaining[remaining.length - 1] ?? "" },
                { headers: { "Content-Type": "application/json" } }
              );
              if (!embedded) await fetchCars();
              setErrMsg(null);
            } catch (e) {
              setErrMsg(e?.response?.data?.message || e.message || "Error setting current location");
            }
          }}
          onClose={closeNext}
        />
      )}
    </div>
  );
}

const overlayCss = `
.split-panels{ display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.panel{ background: var(--panel); border:1px solid var(--line); border-radius:14px; box-shadow: var(--shadow-lg); }
.panel-head{ display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; border-bottom:1px solid var(--line); }
.panel-head h3{ margin:0; font-size:14px; font-weight:700; }
.panel .search{ min-width:220px; max-width:420px; flex:1 1 auto; }

tbody tr{ position:relative; } /* anchor for overlay */
.overlay-cell{ position: relative; padding:0 !important; }
.row-editor{
  position:absolute;
  left:0; right:0; top:-1px;
  transform: translateY(-1px);
  background:#0b1220;
  border:1px solid #243041;
  border-radius:12px;
  padding:12px;
  z-index: 5;
  box-shadow: 0 10px 24px rgba(0,0,0,.35);
}
.editor-grid{
  display:grid; grid-template-columns: 1fr 1fr; gap:10px;
}
.editor-grid.single{ grid-template-columns: 1fr; }
.inline-pair{ display:grid; grid-template-columns: 100px 120px; gap:10px; }
.editor-actions{ display:flex; gap:8px; justify-content:flex-end; margin-top:10px; }

@media (max-width: 980px){
  .split-panels{ grid-template-columns:1fr; gap:12px; }
  .inline-pair{ grid-template-columns: 90px 100px; }
}
`;
