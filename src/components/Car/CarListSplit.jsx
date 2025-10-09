// src/components/Car/CarListSplit.jsx
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import api from "../../lib/api";
import CarFormModal from "./CarFormModal";
import CarProfileModal from "./CarProfileModal";
import ChecklistFormModal from "./ChecklistFormModal";
import NextLocationsFormModal from "./NextLocationsFormModal";
import "./CarList.css";
import HamburgerMenu from "../utils/HamburgerMenu";

const STAGES = ["In Works", "In Works/Online", "Online", "Sold"];

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

/* ---------------- Component ---------------- */
export default function CarListSplit() {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState(null);

  const [showForm, setShowForm] = useState(false);

  // filters & search
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState(() => new Set(STAGES));

  // sorting (only local)
  const [sort, setSort] = useState({ key: null, dir: null });

  // inline editing (per cell)
  const [editRow, setEditRow] = useState(null);
  const [editField, setEditField] = useState(null);
  const [editData, setEditData] = useState({});
  const savingRef = useRef(false);

  // caret restore
  const activeRef = useRef(null);
  const caretRef = useRef({ name: null, start: null, end: null });

  // modals
  const [checklistModal, setChecklistModal] = useState({ open: false, car: null });
  const [nextModal, setNextModal] = useState({ open: false, car: null });
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedCar, setSelectedCar] = useState(null);

  useEffect(() => {
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
  }, []);

  const refreshCars = async () => {
    try {
      const res = await api.get("/cars", { headers: { "Cache-Control": "no-cache" } });
      const data = (res.data?.data || []).map((c, idx) => ({ ...c, __idx: idx }));
      setCars(data);
    } catch (err) {
      setErrMsg(err.response?.data?.message || err.message || "Error fetching cars");
    }
  };

  const handleSave = refreshCars;

  // ---------- editing ----------
  const openCell = (car, field) => {
    if (field === "checklist") return setChecklistModal({ open: true, car });
    if (field === "next") return setNextModal({ open: true, car });

    setEditRow(car._id);
    setEditField(field);

    if (field === "car") {
      setEditData({
        make: car.make ?? "",
        model: car.model ?? "",
        badge: (car.badge ?? "").slice(0, 4),
        rego: (car.rego ?? "").toUpperCase(),
        year: car.year ?? "",
        description: car.description ?? "",
      });
      caretRef.current = { name: "make", start: null, end: null };
      requestAnimationFrame(() => {
        const el = activeRef.current?.querySelector('input[name="make"]');
        el?.focus();
        el?.select?.();
      });
    } else if (field === "location") {
      setEditData({ location: car.location ?? "" });
      caretRef.current = { name: "location", start: null, end: null };
    } else if (field === "notes") {
      setEditData({ notes: car.notes ?? "" });
      caretRef.current = { name: "notes", start: null, end: null };
    } else if (field === "stage") {
      setEditData({ stage: car.stage ?? "In Works" });
      caretRef.current = { name: null, start: null, end: null };
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

  useLayoutEffect(() => {
    if (!editRow || editField === "stage") return;
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

      if (res.data?.data) {
        setCars((prev) => prev.map((c) => (c._id === editRow ? { ...res.data.data, __idx: c.__idx } : c)));
      } else {
        await refreshCars();
      }

      setEditRow(null);
      setEditField(null);
      setEditData({});
    } catch (err) {
      alert("Error updating car: " + (err.response?.data?.message || err.message));
      await refreshCars();
    } finally {
      savingRef.current = false;
    }
  };

  useEffect(() => {
    const onDown = (e) => {
      if (!editRow) return;
      const rowEl = document.querySelector(`tr[data-id="${editRow}"]`);
      if (!rowEl) return;
      if (!rowEl.contains(e.target)) saveChanges();
    };
    if (editRow) {
      document.addEventListener("mousedown", onDown);
      document.addEventListener("touchstart", onDown, { passive: true });
    }
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [editRow, editData]); // eslint-disable-line

  const handleDelete = async (carId) => {
    if (!window.confirm("Delete this car?")) return;
    try {
      await api.delete(`/cars/${carId}`);
      await refreshCars();
    } catch (err) {
      alert("Delete failed: " + (err.response?.data?.message || err.message));
    }
  };

  // ---------- filtering/sorting ----------
  const baseList = cars;
  const filteredSorted = useMemo(() => {
    let list = stageFilter.size > 0 ? baseList.filter((car) => stageFilter.has(car?.stage ?? "")) : [];
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

    if (!sort.key || !sort.dir) return list;

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
  }, [baseList, query, sort, stageFilter]);

  const soldFirstList = useMemo(() => {
    const sold = [], other = [];
    for (const c of filteredSorted) (isSold(c) ? sold : other).push(c);
    return [...sold, ...other];
  }, [filteredSorted]);

  // ---------- UI bits ----------
  const SortChevron = ({ dir }) => <span style={{ marginLeft: 6, opacity: 0.8 }}>{dir === "desc" ? "↓" : dir === "asc" ? "↑" : ""}</span>;
  const clickSort = (key) => setSort((prev) => ({ key: prev.key === key && prev.dir ? key : key, dir: prev.key === key ? nextDir(prev.dir) : "desc" }));

  const carString = (car) => {
    const head = [car.make, car.model].filter(Boolean).join(" ").trim();
    const tail = [];
    const b = (car.badge || "").slice(0, 4).trim();
    if (b) tail.push(b);
    if (car.year) tail.push(String(car.year));
    if (car.description) tail.push(car.description);
    if (car.rego) tail.push(car.rego);
    const right = tail.join(", ");
    return [head, right].filter(Boolean).join(", ");
  };

  const Header = () => (
    <thead>
      <tr>
        <th><button className="thbtn" onClick={() => clickSort("car")}>Car {sort.key === "car" && <SortChevron dir={sort.dir} />}</button></th>
        <th><button className="thbtn" onClick={() => clickSort("location")}>Location {sort.key === "location" && <SortChevron dir={sort.dir} />}</button></th>
        <th><button className="thbtn" onClick={() => clickSort("next")}>Next Loc {sort.key === "next" && <SortChevron dir={sort.dir} />}</button></th>
        <th><button className="thbtn" onClick={() => clickSort("checklist")}>Checklist {sort.key === "checklist" && <SortChevron dir={sort.dir} />}</button></th>
        <th><button className="thbtn" onClick={() => clickSort("notes")}>Notes {sort.key === "notes" && <SortChevron dir={sort.dir} />}</button></th>
        <th><button className="thbtn" onClick={() => clickSort("stage")}>Stage {sort.key === "stage" && <SortChevron dir={sort.dir} />}</button></th>
        <th>Act</th>
      </tr>
    </thead>
  );

  const Cell = ({ children, title }) => (
    <span className="cell" title={title ?? (typeof children === "string" ? children : "")}>
      {children}
    </span>
  );

  const Rows = ({ list }) => {
    const visibleCols = 7;
    return (
      <tbody>
        {list.length === 0 ? (
          <tr><td colSpan={visibleCols} className="empty">No cars found.</td></tr>
        ) : (
          list.map((car) => {
            const isEditing = editRow === car._id;
            const isCar = isEditing && editField === "car";
            const isLoc = isEditing && editField === "location";
            const isNotes = isEditing && editField === "notes";
            const isStage = isEditing && editField === "stage";
            const nextList =
              Array.isArray(car.nextLocations) && car.nextLocations.length
                ? car.nextLocations.join(", ")
                : car.nextLocation || "";

            return (
              <tr key={car._id} data-id={car._id} className={`row ${isSold(car) ? "row--sold" : ""}`}>
                {/* Car */}
                <td onDoubleClick={() => !isCar && openCell(car, "car")} className={isCar ? "is-editing" : ""}>
                  {isCar ? (
                    <div ref={activeRef} className="edit-cell-group">
                      <input className="input input--compact" name="make" value={editData.make} onChange={handleChange} onKeyUp={rememberCaret} onClick={rememberCaret} placeholder="Make" />
                      <input className="input input--compact" name="model" value={editData.model} onChange={handleChange} onKeyUp={rememberCaret} onClick={rememberCaret} placeholder="Model" />
                      <div className="edit-inline">
                        <input className="input input--compact" name="badge" value={editData.badge} onChange={handleChange} onKeyUp={rememberCaret} onClick={rememberCaret} maxLength={4} placeholder="Badge" />
                        <input className="input input--compact" name="year" value={editData.year} onChange={handleChange} onKeyUp={rememberCaret} onClick={rememberCaret} placeholder="Year" />
                      </div>
                      <input className="input input--compact" name="description" value={editData.description} onChange={handleChange} onKeyUp={rememberCaret} onClick={rememberCaret} placeholder="Description" />
                      <input className="input input--compact" name="rego" value={editData.rego} onChange={handleChange} onKeyUp={rememberCaret} onClick={rememberCaret} placeholder="REGO" style={{ textTransform: "uppercase" }} />
                      <div className="edit-actions">
                        <button className="btn btn--primary btn--xs" onClick={saveChanges}>Save</button>
                        <button className="btn btn--xs" onClick={() => { setEditRow(null); setEditField(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <Cell>{carString(car) || "-"}</Cell>
                  )}
                </td>

                {/* Location */}
                <td onDoubleClick={() => !isLoc && openCell(car, "location")} className={isLoc ? "is-editing" : ""}>
                  {isLoc ? (
                    <div ref={activeRef} className="edit-cell">
                      <input className="input input--compact" name="location" value={editData.location} onChange={handleChange} onKeyUp={rememberCaret} onClick={rememberCaret} />
                      <div className="edit-actions">
                        <button className="btn btn--primary btn--xs" onClick={saveChanges}>Save</button>
                      </div>
                    </div>
                  ) : (
                    <Cell>{car.location || "-"}</Cell>
                  )}
                </td>

                {/* Next (modal) */}
                <td onDoubleClick={() => openCell(car, "next")}>
                  <Cell>{nextList || "-"}</Cell>
                </td>

                {/* Checklist (modal) */}
                <td onDoubleClick={() => openCell(car, "checklist")}>
                  <Cell title={Array.isArray(car.checklist) ? car.checklist.join(", ") : ""}>
                    {Array.isArray(car.checklist) && car.checklist.length > 0 ? car.checklist.join(", ") : "-"}
                  </Cell>
                </td>

                {/* Notes */}
                <td onDoubleClick={() => !isNotes && openCell(car, "notes")} className={isNotes ? "is-editing" : ""}>
                  {isNotes ? (
                    <div ref={activeRef} className="edit-cell">
                      <input className="input input--compact" name="notes" value={editData.notes} onChange={handleChange} onKeyUp={rememberCaret} onClick={rememberCaret} placeholder="Short notes" />
                      <div className="edit-actions">
                        <button className="btn btn--primary btn--xs" onClick={saveChanges}>Save</button>
                      </div>
                    </div>
                  ) : (
                    <Cell>{car.notes || "-"}</Cell>
                  )}
                </td>

                {/* Stage */}
                <td onDoubleClick={() => !isStage && openCell(car, "stage")} className={isStage ? "is-editing" : ""}>
                  {isStage ? (
                    <div ref={activeRef} className="edit-cell">
                      <select
                        className="input input--compact input--select-lg"
                        name="stage"
                        value={editData.stage}
                        onChange={(e) => setEditData((p) => ({ ...p, stage: e.target.value }))}
                        onBlur={saveChanges}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                      >
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
    );
  };

  const Table = ({ list }) => (
    <div className="table-wrap">
      <style>{`
        .table-wrap{position:relative; overflow-x:auto; overflow-y:hidden; -webkit-overflow-scrolling:touch;}
        .car-table{width:100%;table-layout:fixed;border-collapse:separate;border-spacing:0; min-width:1200px;}
        .car-table th,.car-table td{padding:6px 10px;vertical-align:middle;}

        .car-table col.col-car{width:420px;}
        .car-table col.col-loc{width:140px;}
        .car-table col.col-next{width:280px;}
        .car-table col.col-chk{width:440px;}
        .car-table col.col-notes{width:300px;}
        .car-table col.col-stage{width:90px;}
        .car-table col.col-act{width:90px;}

        .car-table .cell{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;}
        .thbtn{all:unset;cursor:pointer;color:#cbd5e1;padding:4px 6px;border-radius:6px;}
        .thbtn:hover{background:#1f2937;}

        td.is-editing{ background:#0c1a2e; box-shadow: inset 0 0 0 1px #2b3b54; border-radius:8px; }
        .edit-cell{ display:flex; align-items:center; gap:8px; }
        .edit-cell-group{ display:flex; flex-direction:column; gap:8px; }
        .edit-inline{ display:flex; gap:8px; }
        .edit-actions{ display:flex; gap:8px; margin-top:4px; }

        .btn{ border:1px solid transparent; border-radius:10px; padding:6px 10px; cursor:pointer; font-weight:600; }
        .btn--danger{ background:#DC2626; color:#fff; }
        .btn--xs{ font-size:12px; padding:4px 8px; }
        .btn--icon{ padding:6px; width:32px; height:28px; display:inline-flex; align-items:center; justify-content:center; }
        .btn--kebab{ background:#374151; color:#E5E7EB; }

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

  const listForUI = soldFirstList;
  const mid = Math.ceil(listForUI.length / 2);
    if (loading) {
    return (
      <div className="page-pad with-ham">
        <HamburgerMenu />
        <style>{cssTopbar}</style>
        <div style={{ padding: "40px", textAlign: "center", color: "#9CA3AF", fontSize: "16px" }}>
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="page-pad with-ham">
      <HamburgerMenu />
      <style>{cssTopbar}</style>
      <style>{stageChipCss}</style>

      {/* SINGLE-LINE TOPBAR (matches Regular) */}
      <div className="toolbar">
        <div className="titlebox">
          <h1 className="title">Car Inventory</h1>
          <p className="subtitle">{listForUI.length} cars</p>
        </div>

        <div className="split-toolbar">
          <div className="tabbar">
            <button className="tab" onClick={() => (window.location.href = "/cars")}>Regular</button>
            <button className="tab is-active">Split</button>
          </div>

          <div className="chipbar">
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
            className="input"
            placeholder="Search cars…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <button className="btn btn--primary" onClick={() => setShowForm(true)}>
            + Add New Car
          </button>
        </div>
      </div>

      {errMsg && <div className="alert alert--error">{errMsg}</div>}

      {/* SPLIT PANELS */}
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

/* ======= Styles (match Regular; tightened mobile spacing) ======= */
const cssTopbar = `
html, body { width: 100%; margin:0; overflow-x:hidden; }
#root { overflow-x:hidden; }

/* Menu spacing */
.with-ham .toolbar,
.with-ham .titlebar,
.with-ham .page-head { padding-left:56px; }

.page-pad { padding: clamp(12px, 2vw, 20px); max-width:100vw; }

/* SINGLE-LINE TOOLBAR */
.toolbar{
  display:flex; align-items:flex-end; justify-content:space-between;
  gap:12px; flex-wrap:wrap; margin-bottom:10px; max-width:100%; overflow-x:hidden;
}
.toolbar, .split-toolbar, .titlebox, .chipbar { min-width:0; }

.titlebox{ display:flex; flex-direction:column; gap:4px; min-width:180px; }
.title{ margin:0; font-size:28px; }
.subtitle{ margin:0; color:#9CA3AF; font-size:13px; }

/* Right side of toolbar */
.split-toolbar{
  display:flex; align-items:center; gap:8px; flex-wrap:wrap;
  justify-content:flex-end; flex: 1 1 800px; min-width:260px; max-width:100%;
}

/* Tabs */
.tabbar{display:inline-flex;gap:6px;background:#0b1220;border:1px solid #243041;padding:6px;border-radius:12px;}
.tab{border:0;padding:8px 14px;border-radius:10px;background:transparent;color:#cbd5e1;cursor:pointer;font-weight:600;}
.tab.is-active{background:#1f2937;color:#fff;}

/* Chips */
.chipbar{ display:flex; gap:6px; flex-wrap:wrap; }
.chip{
  border:1px solid #243041; border-radius:999px; padding:8px 12px; cursor:pointer;
  background:#0b1220; color:#cbd5e1; font-weight:600;
}
.chip:hover{ filter:brightness(1.1); }
.chip.chip--on{ background:#2563EB; color:#fff; border-color:transparent; }

/* Search */
.input{
  background:#0b1220; color:#e5e7eb; border:1px solid #243041; border-radius:10px;
  padding:10px 12px; outline:none; min-width:160px; width: clamp(200px, 28vw, 420px);
}
.input:focus{ border-color:#2E4B8F; box-shadow:0 0 0 3px rgba(37,99,235,.25); }

/* Buttons */
.btn{
  border:1px solid #243041; border-radius:10px;
  padding: 10px 14px; font-weight:600; cursor:pointer; white-space:nowrap;
}
.btn--primary{ background:#2563EB !important; color:#fff !important; border-color:transparent !important; }

/* Content grid */
.split-panels{ display:grid; grid-template-columns:1fr 1fr; gap:12px; align-items:start; }
@media (max-width: 1000px){ .split-panels{ grid-template-columns:1fr; } }

/* Compact inputs used inside cells */
.input--compact{ padding:8px 10px; border-radius:8px; min-width:0; width:100%; }
.input--select-lg{ min-height:44px; font-size:16px; width:100%; }

/* Mobile tweaks: remove big gaps between controls and table */
@media (max-width: 1024px){
  .with-ham .toolbar, .with-ham .titlebar, .with-ham .page-head { padding-left:0; }
  .toolbar{ flex-direction: column; align-items:center; gap:8px; text-align:center; }
  .titlebox{ min-width:0; width:100%; align-items:center; }
  .split-toolbar{ justify-content:center; width:100%; }
  .input{ width:min(520px, 100%) !important; min-width:0; }
}

/* Table wrapper scroll only */
.table-wrap{
  position:relative; overflow-x:auto; overflow-y:hidden; -webkit-overflow-scrolling:touch; max-width:100%;
}
`;

const stageChipCss = `
/* kept for parity if imported elsewhere */
`;
