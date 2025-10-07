// src/components/Car/CarListSplit.jsx
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import api from "../../lib/api"; // env-based axios instance
import CarFormModal from "./CarFormModal";
import CarProfileModal from "./CarProfileModal";
import ChecklistFormModal from "./ChecklistFormModal";
import NextLocationsFormModal from "./NextLocationsFormModal";
import "./CarList.css";
import HamburgerMenu from "../utils/HamburgerMenu";

const STAGES = ["In Works", "In Works/Online", "Online", "Sold"];

/* Red-trash-can icon */
const TrashIcon = ({ size = 16 }) => (
  <svg className="icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
    <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const shortStage = (s) => {
  if (!s) return "-";
  const t = String(s).toLowerCase();
  if (t === "sold") return "S";
  if (t === "online") return "O";
  if (t.includes("works/online")) return "WO";
  if (t.includes("works")) return "IW";
  return String(s).slice(0, 2).toUpperCase();
};

// sort helpers
const nextDir = (d) => (d === null ? "desc" : d === "desc" ? "asc" : null);
const normalize = (v) => (v == null ? "" : Array.isArray(v) ? v.join(", ") : String(v));
const compareStr = (a, b, dir) => {
  const A = normalize(a).toLowerCase();
  const B = normalize(b).toLowerCase();
  if (A === B) return 0;
  return dir === "desc" ? (A < B ? 1 : -1) : (A < B ? -1 : 1);
};
const compareNum = (a, b, dir) => {
  const A = Number(a ?? NaN);
  const B = Number(b ?? NaN);
  if (Number.isNaN(A) && Number.isNaN(B)) return 0;
  if (Number.isNaN(A)) return dir === "desc" ? 1 : -1;
  if (Number.isNaN(B)) return dir === "desc" ? -1 : 1;
  return dir === "desc" ? B - A : A - B;
};

const isSold = (car = {}) => String(car.stage || "").trim().toLowerCase() === "sold";

export default function CarListSplit({ embedded = true, listOverride, sortState }) {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState(null);

  // Standalone search (parent filters when embedded)
  const [query, setQuery] = useState("");

  // Stage filter (chips). Default = all selected.
  const [stageFilter, setStageFilter] = useState(() => new Set(STAGES));

  const [showForm, setShowForm] = useState(false);

  // per-cell editing
  const [editRow, setEditRow] = useState(null);
  const [editField, setEditField] = useState(null);
  const [editData, setEditData] = useState({});
  const savingRef = useRef(false);
  const activeRef = useRef(null);

  // caret tracking
  const caretRef = useRef({ name: null, start: null, end: null });

  // modals
  const [checklistModal, setChecklistModal] = useState({ open: false, car: null });
  const [nextModal, setNextModal] = useState({ open: false, car: null });

  // profile modal
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedCar, setSelectedCar] = useState(null);

  // local sort (not used when embedded)
  const [sort, setSort] = useState(sortState ?? { key: null, dir: null });

  // fetch (only when standalone and no listOverride)
  useEffect(() => {
    if (listOverride) {
      setLoading(false);
      setErrMsg(null);
      return;
    }
    (async () => {
      try {
        const res = await api.get("/cars", { headers: { "Cache-Control": "no-cache" } });
        const data = (res.data?.data || []).map((c, idx) => ({ ...c, __idx: idx }));
        setCars(data);
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
      const data = (res.data?.data || []).map((c, idx) => ({ ...c, __idx: idx }));
      setCars(data);
    } catch (err) {
      setErrMsg(err.response?.data?.message || err.message || "Error fetching cars");
    }
  };

  const handleSave = refreshCars;

  // open editor / modals
  const openCell = (car, field) => {
    if (field === "checklist") { setChecklistModal({ open: true, car }); return; }
    if (field === "nextLocation") { setNextModal({ open: true, car }); return; }

    setEditRow(car._id);
    setEditField(field);

    if (field === "car") {
      setEditData({
        make: car.make ?? "",
        model: car.model ?? "",
        badge: (car.badge ?? "").slice(0, 4),
        rego: car.rego ?? "",
        year: car.year ?? "",
        description: car.description ?? "",
      });
      caretRef.current = { name: "make", start: null, end: null };
      requestAnimationFrame(() => {
        const el = activeRef.current?.querySelector('input[name="make"]');
        if (el) { el.focus(); el.select?.(); }
      });
    } else if (field === "location") {
      setEditData({ location: car.location ?? "" });
      caretRef.current = { name: "location", start: null, end: null };
    } else if (field === "notes") {
      setEditData({ notes: car.notes ?? "" });
      caretRef.current = { name: "notes", start: null, end: null };
    } else if (field === "stage") {
      setEditData({ stage: car.stage ?? "In Works" });
      caretRef.current = { name: "stage", start: null, end: null };
    } else {
      setEditData({});
    }
  };

  const rememberCaret = (e) => {
    const { name, selectionStart, selectionEnd } = e.target;
    caretRef.current = { name, start: selectionStart ?? null, end: selectionEnd ?? null };
  };

  const handleChange = (e) => {
    rememberCaret(e);
    const { name, value } = e.target;
    if (name === "year") return setEditData((p) => ({ ...p, year: value.replace(/[^\d]/g, "") }));
    if (name === "rego") {
      const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
      return setEditData((p) => ({ ...p, rego: clean }));
    }
    if (name === "badge") return setEditData((p) => ({ ...p, badge: value.slice(0, 4) }));
    setEditData((p) => ({ ...p, [name]: value }));
  };

  const handleKeyDown = (e) => {
    if (!editRow) return;
    if (e.key === "Enter") { e.preventDefault(); saveChanges(); }
    else if (e.key === "Escape") {
      e.preventDefault();
      setEditRow(null);
      setEditField(null);
      setEditData({});
      refreshCars();
    }
  };

  // focus + caret restore
  useLayoutEffect(() => {
    if (!editRow) return;
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
      const e = typeof end === "number" ? Math.min(end, v.length) : v.length;
      el.setSelectionRange(s, e);
    }
  }, [editData, editField, editRow]);

  const handleDelete = async (carId) => {
    if (!window.confirm("Are you sure you want to delete this car?")) return;
    try {
      await api.delete(`/cars/${carId}`);
      await refreshCars();
      alert("Car deleted successfully!");
    } catch (err) {
      alert("Error deleting car: " + (err.response?.data?.message || err.message));
    }
  };

  const saveChanges = async () => {
    if (!editRow || savingRef.current) return;
    savingRef.current = true;

    try {
      let payload = {};
      if (editField === "car") {
        payload = {
          make: (editData.make ?? "").trim(),
          model: (editData.model ?? "").trim(),
          badge: (editData.badge ?? "").trim(),
          rego: (editData.rego ?? "").trim(),
          year: editData.year === "" ? undefined : Number(editData.year),
          description: (editData.description ?? "").trim(),
        };
      } else if (editField === "location") {
        payload = { location: (editData.location ?? "").trim() };
      } else if (editField === "notes") {
        payload = { notes: (editData.notes ?? "").trim() };
      } else if (editField === "stage") {
        payload = { stage: (editData.stage ?? "In Works").trim() };
      } else {
        savingRef.current = false;
        return;
      }

      const res = await api.put(`/cars/${editRow}`, payload, {
        headers: { "Content-Type": "application/json" },
      });

      if (!listOverride) {
        if (res.data?.data) {
          setCars((prev) =>
            prev.map((c) => (c._id === editRow ? { ...res.data.data, __idx: c.__idx } : c))
          );
        } else {
          await refreshCars();
        }
      }

      setEditRow(null);
      setEditField(null);
      setEditData({});
    } catch (err) {
      console.error("Update failed", err.response?.data || err.message);
      alert("Error updating car: " + (err.response?.data?.message || err.message));
      await refreshCars();
    } finally {
      savingRef.current = false;
    }
  };

  // save on outside click
  useEffect(() => {
    const onDown = (e) => {
      if (!editRow) return;
      const rowEl = document.querySelector(`tr[data-id="${editRow}"]`);
      if (!rowEl) return;
      if (!rowEl.contains(e.target)) saveChanges();
    };
    if (editRow) document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [editRow, editData]); // eslint-disable-line react-hooks/exhaustive-deps

  // base list
  const baseList = useMemo(() => (listOverride ? listOverride : cars), [listOverride, cars]);

  // filter/sort
  const filteredSorted = useMemo(() => {
    let list = baseList;

    // Stage filter
    if (stageFilter.size > 0) {
      list = list.filter((car) => stageFilter.has(car?.stage ?? ""));
    } else {
      list = [];
    }

    // Standalone search
    if (!embedded) {
      const q = query.trim().toLowerCase();
      if (q) {
        list = list.filter((car) => {
          const hay = [
            car.make, car.model, car.badge, car.rego, car.year, car.description,
            car.location, car.stage,
            ...(Array.isArray(car.nextLocations) ? car.nextLocations : [car.nextLocation]),
            ...(Array.isArray(car.checklist) ? car.checklist : []),
          ].filter(Boolean).join(" ").toLowerCase();
          return hay.includes(q);
        });
      }
    }

    // Local sort only when standalone
    if (embedded || !sort.key || !sort.dir) return list;

    const dir = sort.dir;
    const cmp = (a, b) => {
      switch (sort.key) {
        case "car": {
          const byMake = compareStr(a.make, b.make, dir);
          if (byMake !== 0) return byMake;
          return compareStr(a.model, b.model, dir);
        }
        case "location": return compareStr(a.location, b.location, dir);
        case "next": {
          const an = Array.isArray(a.nextLocations) && a.nextLocations.length ? a.nextLocations.join(", ") : a.nextLocation;
          const bn = Array.isArray(b.nextLocations) && b.nextLocations.length ? b.nextLocations.join(", ") : b.nextLocation;
          return compareStr(an, bn, dir);
        }
        case "checklist": {
          const ac = Array.isArray(a.checklist) ? a.checklist.join(", ") : a.checklist;
          const bc = Array.isArray(b.checklist) ? b.checklist.join(", ") : b.checklist;
          return compareStr(ac, bc, dir);
        }
        case "notes": return compareStr(a.notes, b.notes, dir);
        case "stage": return compareStr(a.stage, b.stage, dir);
        case "year": return compareNum(a.year, b.year, dir);
        default: return 0;
      }
    };

    return list.slice().sort(cmp);
  }, [baseList, embedded, query, sort, stageFilter]);

  // SOLD to the top (keep relative order inside buckets)
  const soldFirstList = useMemo(() => {
    const sold = [];
    const other = [];
    for (const c of filteredSorted) (isSold(c) ? sold : other).push(c);
    return [...sold, ...other];
  }, [filteredSorted]);

  if (loading) {
    return (
      <div className={embedded ? "with-ham-ctx" : "page-pad with-ham"}>
        <style>{cssFix}</style>
        <style>{stageChipCss}</style>
        Loading…
      </div>
    );
  }

  const SortChevron = ({ dir }) => (
    <span style={{ marginLeft: 6, opacity: 0.8 }}>
      {dir === "desc" ? "↓" : dir === "asc" ? "↑" : ""}
    </span>
  );

  const clickSort = (key) => {
    if (embedded) return;
    setSort((prev) => {
      const dir = prev.key === key ? nextDir(prev.dir) : "desc";
      return { key: dir ? key : null, dir };
    });
  };

  const Header = () => (
    <thead>
      <tr>
        <th>
          <button className="thbtn" onClick={() => clickSort("car")}>
            Car {(!embedded && sort.key === "car") && <SortChevron dir={sort.dir} />}
          </button>
        </th>
        <th>
          <button className="thbtn" onClick={() => clickSort("location")}>
            Location {(!embedded && sort.key === "location") && <SortChevron dir={sort.dir} />}
          </button>
        </th>
        <th>
          <button className="thbtn" onClick={() => clickSort("next")}>
            Next Loc {(!embedded && sort.key === "next") && <SortChevron dir={sort.dir} />}
          </button>
        </th>
        <th>
          <button className="thbtn" onClick={() => clickSort("checklist")}>
            Checklist {(!embedded && sort.key === "checklist") && <SortChevron dir={sort.dir} />}
          </button>
        </th>
        <th>
          <button className="thbtn" onClick={() => clickSort("notes")}>
            Notes {(!embedded && sort.key === "notes") && <SortChevron dir={sort.dir} />}
          </button>
        </th>
        <th>
          <button className="thbtn" onClick={() => clickSort("stage")}>
            Stg {(!embedded && sort.key === "stage") && <SortChevron dir={sort.dir} />}
          </button>
        </th>
        <th>Act</th>
      </tr>
    </thead>
  );

  const Cell = ({ children, title }) => (
    <span className="cell" title={title ?? (typeof children === "string" ? children : "")}>
      {children}
    </span>
  );

  const carString = (car) => {
    const head = [car.make, car.model].filter(Boolean).join(" ").trim();
    const tail = [];
    const b = (car.badge || "").slice(0, 4).trim();
    if (b) tail.push(b);
    if (car.rego) tail.push(car.rego);
    if (car.year) tail.push(String(car.year));
    if (car.description) tail.push(car.description);
    const right = tail.join(", ");
    return [head, right].filter(Boolean).join(", ");
  };

  const Rows = ({ list }) => {
    const visibleCols = 7;
    return (
      <tbody onKeyDown={handleKeyDown}>
        {list.length === 0 ? (
          <tr><td colSpan={visibleCols} className="empty">No cars found.</td></tr>
        ) : (
          list.map((car) => {
            const isEditing = editRow === car._id;
            const nextList =
              Array.isArray(car.nextLocations) && car.nextLocations.length
                ? car.nextLocations.join(", ")
                : (car.nextLocation || "");

            if (isEditing && editField === "car") {
              return (
                <tr key={car._id} data-id={car._id} className="row row--editing-car">
                  <td colSpan={visibleCols} className="edit-td">
                    <div ref={activeRef} className="editor-wrap editor-wrap--wide">
                      <div className="car-editor-grid">
                        <input className="editor-input" name="make" value={editData.make} onChange={handleChange} onKeyUp={rememberCaret} onClick={rememberCaret} placeholder="Make" />
                        <input className="editor-input" name="model" value={editData.model} onChange={handleChange} onKeyUp={rememberCaret} onClick={rememberCaret} placeholder="Model" />
                        <input className="editor-input" name="badge" value={editData.badge} onChange={handleChange} onKeyUp={rememberCaret} onClick={rememberCaret} maxLength={4} placeholder="Badge" />
                        <input className="editor-input" name="rego" value={editData.rego} onChange={handleChange} onKeyUp={rememberCaret} onClick={rememberCaret} placeholder="REGO" style={{ textTransform: "uppercase" }} />
                        <input className="editor-input" name="year" value={editData.year} onChange={handleChange} onKeyUp={rememberCaret} onClick={rememberCaret} placeholder="Year" />
                        <input className="editor-input" name="description" value={editData.description} onChange={handleChange} onKeyUp={rememberCaret} onClick={rememberCaret} placeholder="Description" />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            }

            return (
              <tr key={car._id} data-id={car._id} className={`row ${isEditing ? "row--editing" : ""} ${isSold(car) ? "row--sold" : ""}`}>
                {/* Car */}
                <td onDoubleClick={() => !isEditing && openCell(car, "car")}>
                  <Cell>{carString(car) || "-"}</Cell>
                </td>

                {/* Location */}
                <td onDoubleClick={() => !isEditing && openCell(car, "location")}>
                  {isEditing && editField === "location" ? (
                    <div ref={activeRef} className="editor-wrap">
                      <input className="editor-input" name="location" value={editData.location} onChange={handleChange} onKeyUp={rememberCaret} onClick={rememberCaret} />
                    </div>
                  ) : (
                    <Cell>{car.location || "-"}</Cell>
                  )}
                </td>

                {/* Next Loc -> modal */}
                <td onDoubleClick={() => !isEditing && openCell(car, "nextLocation")}>
                  <Cell>{nextList || "-"}</Cell>
                </td>

                {/* Checklist -> modal */}
                <td onDoubleClick={() => !isEditing && openCell(car, "checklist")}>
                  <Cell title={Array.isArray(car.checklist) ? car.checklist.join(", ") : ""}>
                    {Array.isArray(car.checklist) && car.checklist.length > 0 ? car.checklist.join(", ") : "-"}
                  </Cell>
                </td>

                {/* Notes */}
                <td onDoubleClick={() => !isEditing && openCell(car, "notes")}>
                  {isEditing && editField === "notes" ? (
                    <div ref={activeRef} className="editor-wrap">
                      <input className="editor-input" name="notes" value={editData.notes} onChange={handleChange} onKeyUp={rememberCaret} onClick={rememberCaret} placeholder="Short notes" />
                    </div>
                  ) : (
                    <Cell>{car.notes || "-"}</Cell>
                  )}
                </td>

                {/* Stage */}
                <td onDoubleClick={() => !isEditing && openCell(car, "stage")}>
                  {isEditing && editField === "stage" ? (
                    <div ref={activeRef} className="editor-wrap">
                      <select className="editor-input" name="stage" value={editData.stage} onChange={handleChange} onClick={rememberCaret}>
                        {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  ) : (
                    <Cell>{shortStage(car.stage)}</Cell>
                  )}
                </td>

                {/* Actions */}
                <td>
                  <div className="actions">
                    <button
                      className="btn btn--kebab btn--xs"
                      title="Open car profile"
                      onClick={() => { setSelectedCar(car); setProfileOpen(true); }}
                    >
                      ⋯
                    </button>
                    <button
                      className="btn btn--danger btn--xs btn--icon"
                      title="Delete car"
                      aria-label="Delete"
                      onClick={() => handleDelete(car._id)}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    );
  };

  const Table = ({ list }) => (
    <div className="table-wrap">
      <style>{`
        .table-wrap{position:relative; overflow-x:auto; overflow-y:hidden; -webkit-overflow-scrolling:touch;}
        .car-table{
          width:100%;
          table-layout:fixed;
          border-collapse:separate;
          border-spacing:0;
          min-width:760px;
        }
        .car-table th,.car-table td{
          padding:6px 8px;
          vertical-align:middle;
          position:relative;
          border:0;
        }
        /* soft row separators */
        .car-table tbody tr + tr td{ box-shadow: inset 0 -1px 0 #152233; }

        /* column widths */
        .car-table col.col-car{width:auto; min-width:280px;}
        .car-table col.col-loc{width:110px;}
        .car-table col.col-next{width:180px;}
        .car-table col.col-chk{width:220px;}
        .car-table col.col-notes{width:200px;}
        .car-table col.col-stage{width:64px;}
        .car-table col.col-act{width:96px;} /* widened to prevent overlap */

        .cell{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;}

        .editor-wrap{ box-sizing:border-box;width:100%;background:#0b1220;border:1px solid #243041;border-radius:10px;padding:8px;overflow:hidden; }
        .editor-wrap--wide{ box-shadow:0 0 0 1px rgba(36,48,65,.4) inset; }
        .editor-input{ width:100%;box-sizing:border-box;background:#0f172a !important;border:1px solid #243041 !important;border-radius:8px;padding:6px 8px;color:#e5e7eb;outline:none; }
        .car-editor-grid{ display:grid;grid-template-columns: 1fr 1fr 88px 110px 80px 2fr;gap:8px;width:100%;max-width:100%; }
        .edit-td{padding:8px 8px;}

        .thbtn{all:unset;cursor:pointer;color:#cbd5e1;padding:4px 6px;border-radius:6px;}
        .thbtn:hover{background:#1f2937;}

        /* actions */
        .actions{display:flex;gap:8px;justify-content:center;align-items:center;}
        .btn{ border:1px solid transparent; border-radius:999px; padding:0; cursor:pointer; font-weight:600; }
        .btn--xs{ width:36px; height:36px; display:flex; align-items:center; justify-content:center; }
        .btn--icon{ width:36px; height:36px; display:flex; align-items:center; justify-content:center; }
        .btn--danger{ background:#DC2626; color:#fff; }
        .btn--kebab{ background:#374151; color:#E5E7EB; }
        .btn--icon .icon{ width:18px; height:18px; }

        /* --- Sold rows: cyan tint --- */
        :root{
          --sold-bg: rgba(14, 165, 233, 0.12);
          --sold-bg-hover: rgba(14, 165, 233, 0.18);
          --sold-border: rgba(14, 165, 233, 0.35);
        }
        .car-table tr.row--sold td{
          background: var(--sold-bg);
          box-shadow: inset 0 0 0 1px var(--sold-border), inset 0 -1px 0 #152233;
        }
        .car-table tr.row--sold:hover td{
          background: var(--sold-bg-hover);
        }
      `}</style>

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
        <Header />
        <Rows list={list} />
      </table>
    </div>
  );

  // Split AFTER lifting sold cars
  const listForUI = soldFirstList;
  const mid = Math.ceil(listForUI.length / 2);

  return (
    <div className={embedded ? "with-ham-ctx is-split" : "page-pad with-ham is-split"}>
      <style>{cssFix}</style>
      <style>{stageChipCss}</style>

      {/* Standalone topbar (all in one line) */}
      {!embedded && (
        <div className="topbar">
          <HamburgerMenu />

          <div className="topbar-title">
            <h1>Car Inventory</h1>
            <span>{listForUI.length} cars</span>
          </div>

          <div className="topbar-tabs" role="tablist" aria-label="Layout mode">
            <button className="tab" onClick={() => window.history.back()}>Regular</button>
            <button className="tab is-active" aria-current="page">Split</button>
          </div>

          <div className="topbar-chips" title="Filter by stage">
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
                >
                  {s}
                </button>
              );
            })}
          </div>

          <input
            className="topbar-search"
            placeholder="Search cars…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <button className="btn btn--primary" onClick={() => setShowForm(true)}>
            + Add New Car
          </button>
        </div>
      )}

      {errMsg && <div className="alert alert--error">{errMsg}</div>}

      <div className="split-panels">
        <Table list={listForUI.slice(0, mid)} />
        <Table list={listForUI.slice(mid)} />
      </div>

      {/* Modals */}
      {showForm && (
        <CarFormModal show={showForm} onClose={() => setShowForm(false)} onSave={handleSave} />
      )}

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

/* ---------- page-level CSS: single-line topbar + responsive ---------- */
const cssFix = `
:root{ --ham-offset:52px; }
@media (max-width:480px){ :root{ --ham-offset:46px; } }
html, body, #root, .with-ham, .with-ham-ctx, .page-pad { overflow-x:hidden; }

/* ---------- TOPBAR (single line) ---------- */
.topbar{
  display:flex; align-items:center; gap:10px;
  padding:8px; margin:0 8px 12px var(--ham-offset);
  background:#0b1220; border:1px solid #243041; border-radius:12px;
}
.topbar > * { flex:0 0 auto; }

.topbar-title{ display:flex; flex-direction:column; margin-right:4px; }
.topbar-title h1{ margin:0; font-size:20px; line-height:1.1; }
.topbar-title span{ font-size:12px; color:#9ca3af; }

/* layout tabs */
.topbar-tabs{ display:inline-flex; gap:6px; background:#0b1220; border:1px solid #243041; padding:6px; border-radius:10px; }
.tab{ border:0; padding:8px 14px; border-radius:10px; background:transparent; color:#cbd5e1; cursor:pointer; }
.tab.is-active{ background:#1f2937; color:#fff; }

/* chips live inline */
.topbar-chips{ display:flex; gap:6px; }

/* search expands to fill the line */
.topbar-search{
  flex:1 1 420px; min-width:240px;
  background:#0b1220; color:#e5e7eb; border:1px solid #243041; border-radius:10px;
  padding:10px 12px; outline:none;
}
.topbar-search:focus{ border-color:#2E4B8F; box-shadow:0 0 0 3px rgba(37,99,235,.25); }

/* buttons */
.btn{ border:1px solid transparent; border-radius:999px; padding:10px 14px; cursor:pointer; font-weight:600; }
.btn--primary{ background:#2563EB !important; color:#fff !important; border-color:transparent !important; }
.btn--primary:hover{ filter:brightness(1.05); }
.btn--primary:active{ transform: translateY(.5px); }

/* content grid */
.split-panels{ display:grid; grid-template-columns:1fr 1fr; gap:12px; align-items:start; }
@media (max-width: 1000px){ .split-panels{ grid-template-columns:1fr; } }

/* table wrap remains */
.table-wrap{ position:relative; overflow-x:auto; overflow-y:hidden; -webkit-overflow-scrolling:touch; }

/* Wrap gracefully on smaller screens: move search to a new row */
@media (max-width:1200px){
  .topbar{ flex-wrap:wrap; }
  .topbar-search{ order:99; width:100%; }
}
`;

/* ------- stage chips ------- */
const stageChipCss = `
.chip{
  border:1px solid #243041; border-radius:999px; padding:8px 12px; cursor:pointer;
  background:#0b1220; color:#cbd5e1; font-weight:600;
  transition:filter .1s ease, transform .02s ease, background .15s ease, color .15s ease;
  white-space:nowrap;
}
.chip:hover{ filter:brightness(1.1); }
.chip:active{ transform: translateY(.5px); }
.chip.chip--on{ background:#2563EB; color:#fff; border-color:transparent; }
`;
