// src/components/Car/CarListRegular.jsx
// Rewritten to use central API client (src/lib/api.js) + VITE_API_URL

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from "react";
import api from "../../lib/api"; // <-- central axios instance (baseURL from VITE_API_URL)
import CarFormModal from "./CarFormModal";
import CarProfileModal from "./CarProfileModal";
import ChecklistFormModal from "./ChecklistFormModal";
import NextLocationsFormModal from "./NextLocationsFormModal";
import CarListSplit from "./CarListSplit";
import "./CarList.css";
import HamburgerMenu from "../utils/HamburgerMenu";

const STAGES = ["In Works", "In Works/Online", "Online", "Sold"];

/* ------- page-level CSS: menu spacing + mobile behavior (only tables scroll) ------- */
const cssFix = `
html, body { width: 100%; margin:0; overflow-x:hidden; }
#root { overflow-x:hidden; }

/* keep header/toolbars clear of the fixed hamburger on desktop */
.with-ham .toolbar,
.with-ham .titlebar,
.with-ham .page-head { padding-left:56px; }

/* container padding but never exceed viewport width */
.page-pad { padding: clamp(12px, 2vw, 20px); max-width:100vw; }

/* ===== Toolbar (desktop-first, wraps when needed) ===== */
.toolbar{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:12px;
  flex-wrap:wrap;         /* allow wrapping to a new line if tight */
  margin-bottom:12px;
  max-width:100%;
  overflow-x:hidden;
}
.toolbar, .split-toolbar, .titlebox, .chipbar { min-width:0; }

.titlebox{ display:flex; flex-direction:column; gap:4px; min-width:180px; }
.title{ margin:0; font-size:28px; }
.subtitle{ margin:0; color:#9CA3AF; font-size:13px; }

/* Right-side controls block: takes remaining space and wraps nicely */
.split-toolbar{
  display:flex;
  flex-wrap:wrap;
  column-gap:8px;
  row-gap:8px;
  align-items:center;
  justify-content:flex-end;
  flex: 1 1 600px;   /* can grow and shrink */
  min-width: 260px;
  max-width:100%;
}

/* tabs */
.tabbar{display:inline-flex;gap:6px;background:#0b1220;border:1px solid #243041;padding:6px;border-radius:12px;}
.tab{border:0;padding:8px 14px;border-radius:10px;background:transparent;color:#cbd5e1;cursor:pointer;font-weight:600;}
.tab.is-active{background:#1f2937;color:#fff;}

/* inputs: responsive width, never force overflow */
.input{
  background:#0b1220; color:#e5e7eb; border:1px solid #243041; border-radius:10px;
  padding:10px 12px; outline:none;
  min-width: 140px;
  width: clamp(160px, 24vw, 320px); /* grows on wide screens, shrinks on tight ones */
}
.input:focus{ border-color:#2E4B8F; box-shadow:0 0 0 3px rgba(37,99,235,.25); }

/* buttons */
.btn{
  border:1px solid #243041; border-radius:10px;
  padding: clamp(8px, 1.6vw, 10px) clamp(10px, 2.4vw, 14px);
  font-weight:600; cursor:pointer; white-space:nowrap;
}
.btn.btn--muted{ background:#1f2937; color:#e5e7eb; border:1px solid #243041; }
.btn.btn--primary{ background:#2563EB !important; color:#fff !important; border-color:transparent !important; }
.btn.btn--primary:hover{ filter:brightness(1.05); }
.btn.btn--primary:active{ transform: translateY(0.5px); }

/* stage chips row can wrap */
.chipbar{ display:flex; gap:6px; flex-wrap:wrap; align-items:center; }

/* ---------- MOBILE/TABLET ---------- */
@media (max-width: 1024px){
  .with-ham .toolbar,
  .with-ham .titlebar,
  .with-ham .page-head { padding-left:0; }

  .toolbar{
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
  }

  .titlebox{
    min-width: 0; width: 100%;
    align-items: center; text-align: center;
  }

  .split-toolbar{
    justify-content:center;
    width: 100%;
  }

  .split-toolbar .input{
    width: min(520px, 100%) !important;
    min-width: 0;
  }
}

/* table: ONLY this scrolls horizontally */
.table-wrap{
  position:relative;
  overflow-x:auto;     /* horizontal scroll lives here */
  overflow-y:hidden;
  -webkit-overflow-scrolling:touch;
  max-width:100%;
}

/* Optional: nicer horizontal scrollbar on WebKit */
.table-wrap::-webkit-scrollbar{ height:12px; }
.table-wrap::-webkit-scrollbar-track{ background:#0B1220; border-radius:10px; }
.table-wrap::-webkit-scrollbar-thumb{ background:#59637C; border:2px solid #0B1220; border-radius:10px; }
.table-wrap:hover::-webkit-scrollbar-thumb{ background:#7B88A6; }

/* tiny phones tweak */
@media (max-width:480px){
  .with-ham .toolbar,
  .with-ham .titlebar,
  .with-ham .page-head { padding-left:0; }
}
`;

/* Stage chip visual theme (shared) */
const stageChipCss = `
.chipbar{ display:flex; gap:6px; flex-wrap:wrap; }
.chip{
  border:1px solid #243041; border-radius:999px; padding:8px 12px; cursor:pointer;
  background:#0b1220; color:#cbd5e1; font-weight:600;
  transition:filter .1s ease, transform .02s ease, background .15s ease, color .15s ease;
}
.chip:hover{ filter:brightness(1.1); }
.chip:active{ transform: translateY(0.5px); }
.chip.chip--on{
  background:#2563EB; color:#fff; border-color:transparent;
}
`;

/* Red-trash-can icon (strokes inherit currentColor) */
const TrashIcon = ({ size = 16 }) => (
  <svg className="icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
    <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// helpers
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

export default function CarListRegular() {
  const [view, setView] = useState("regular");
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState(null);

  const [showForm, setShowForm] = useState(false);

  // row edit
  const [editRow, setEditRow] = useState(null);
  const [editData, setEditData] = useState({});
  const savingRef = useRef(false);

  // caret restore
  const activeRef = useRef(null);
  const caretRef = useRef({ name: null, start: null, end: null });

  // modals
  const [checklistModal, setChecklistModal] = useState({ open: false, car: null });
  const [nextModal, setNextModal] = useState({ open: false, car: null });

  // profile modal
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedCar, setSelectedCar] = useState(null);

  // search + sort
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ key: null, dir: null });

  // Stage filter
  const [stageFilter, setStageFilter] = useState(() => new Set(STAGES));

  // CSV upload
  const [uploading, setUploading] = useState(false);
  const fileInputRefRegular = useRef(null);
  const fileInputRefSplit = useRef(null);

  // Paste-Online
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");

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

  const refreshCars = useCallback(async () => {
    try {
      const res = await api.get("/cars", { headers: { "Cache-Control": "no-cache" } });
      const data = (res.data?.data || []).map((c, idx) => ({ ...c, __idx: idx }));
      setCars(data);
    } catch (err) {
      setErrMsg(err.response?.data?.message || err.message || "Error fetching cars");
    }
  }, []);

  const handleSave = refreshCars;

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

  const triggerCsvRegular = () => fileInputRefRegular.current?.click();
  const triggerCsvSplit = () => fileInputRefSplit.current?.click();

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

  const openChecklistModal = (car) => setChecklistModal({ open: true, car });
  const closeChecklistModal = () => setChecklistModal({ open: false, car: null });
  const saveChecklist = async (items) => {
    if (!checklistModal.car) return;
    try {
      await api.put(
        `/cars/${checklistModal.car._id}`,
        { checklist: items },
        { headers: { "Content-Type": "application/json" } }
      );
      await refreshCars();
    } catch (e) {
      alert(e.response?.data?.message || e.message || "Error saving checklist");
    } finally {
      closeChecklistModal();
    }
  };

  const openNextModal = (car) => setNextModal({ open: true, car });
  const closeNextModal = () => setNextModal({ open: false, car: null });
  const saveNextLocations = async (items) => {
    if (!nextModal.car) return;
    try {
      await api.put(
        `/cars/${nextModal.car._id}`,
        {
          nextLocations: items,
          nextLocation: items[items.length - 1] ?? "",
        },
        { headers: { "Content-Type": "application/json" } }
      );
      await refreshCars();
    } catch (e) {
      alert(e.response?.data?.message || e.message || "Error saving destinations");
    } finally {
      closeNextModal();
    }
  };

  const setCurrentFromNext = async (loc) => {
    if (!nextModal.car) return;
    try {
      const existing = Array.isArray(nextModal.car.nextLocations)
        ? nextModal.car.nextLocations
        : nextModal.car.nextLocation
        ? [nextModal.car.nextLocation]
        : [];
      const remaining = existing.filter((s) => s !== loc);
      await api.put(
        `/cars/${nextModal.car._id}`,
        {
          location: loc,
          nextLocations: remaining,
          nextLocation: remaining[remaining.length - 1] ?? "",
        },
        { headers: { "Content-Type": "application/json" } }
      );
      await refreshCars();
    } catch (e) {
      alert(e.response?.data?.message || e.message || "Error setting current location");
    }
  };

  const handleDoubleClick = (car, initialField = "make") => {
    const lastNext =
      Array.isArray(car.nextLocations) && car.nextLocations.length
        ? car.nextLocations[car.nextLocations.length - 1]
        : car.nextLocation ?? "";

    setEditRow(car._id);
    setEditData({
      _id: car._id,
      make: car.make ?? "",
      model: car.model ?? "",
      badge: (car.badge ?? "").slice(0, 4),
      rego: car.rego ?? "",
      year: car.year ?? "",
      description: car.description ?? "",
      notes: car.notes ?? "",
      checklist: Array.isArray(car.checklist) ? car.checklist.join(", ") : "",
      location: car.location ?? "",
      nextLocation: lastNext || "",
      stage: car.stage ?? "In Works",
    });

    caretRef.current = { name: initialField, start: null, end: null };
    requestAnimationFrame(() => {
      const root = activeRef.current;
      if (!root) return;
      const el =
        root.querySelector(`[name="${CSS.escape(initialField)}"]`) ||
        root.querySelector("input, textarea, select");
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
    if (name === "rego") {
      const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
      return setEditData((p) => ({ ...p, rego: clean }));
    }
    if (name === "badge") return setEditData((p) => ({ ...p, badge: value.slice(0, 4) }));
    setEditData((p) => ({ ...p, [name]: value }));
  };

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
      const payload = {
        make: (editData.make ?? "").trim(),
        model: (editData.model ?? "").trim(),
        badge: (editData.badge ?? "").trim(),
        rego: (editData.rego ?? "").trim(),
        year: editData.year === "" ? undefined : Number(editData.year),
        description: (editData.description ?? "").trim(),
        notes: (editData.notes ?? "").trim(),
        checklist: (editData.checklist ?? "").trim(),
        location: (editData.location ?? "").trim(),
        nextLocation: (editData.nextLocation ?? "").trim(),
        stage: (editData.stage ?? "In Works").trim(),
      };

      const res = await api.put(`/cars/${editRow}`, payload, {
        headers: { "Content-Type": "application/json" },
      });

      if (res.data?.data) {
        setCars((prev) => prev.map((c) => (c._id === editRow ? { ...res.data.data, __idx: c.__idx } : c)));
      } else {
        await refreshCars();
      }
      setEditRow(null);
    } catch (err) {
      console.error("Update failed", err.response?.data || err.message);
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
    if (editRow) document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editRow, editData]);

  useLayoutEffect(() => {
    if (!editRow) return;
    const { name, start, end } = caretRef.current || {};
    const root = activeRef.current;
    if (!root) return;
    const el = (name && root.querySelector(`[name="${CSS.escape(name)}"]`)) || root.querySelector("input, textarea, select");
    if (!el) return;
    if (document.activeElement !== el) el.focus();
    if (typeof el.setSelectionRange === "function" && "value" in el) {
      const v = el.value ?? "";
      const s = typeof start === "number" ? Math.min(start, v.length) : v.length;
      const e = typeof end === "number" ? Math.min(end, v.length) : v.length;
      el.setSelectionRange(s, e);
    }
  }, [editData, editRow]);

  const filteredSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = cars;

    if (stageFilter.size > 0) {
      list = list.filter((car) => stageFilter.has(car?.stage ?? ""));
    } else {
      list = [];
    }

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
        case "next":
          return compareStr(
            Array.isArray(a.nextLocations) && a.nextLocations.length ? a.nextLocations.join(", ") : a.nextLocation,
            Array.isArray(b.nextLocations) && b.nextLocations.length ? b.nextLocations.join(", ") : b.nextLocation,
            dir
          );
        case "checklist":
          return compareStr(
            Array.isArray(a.checklist) ? a.checklist.join(", ") : a.checklist,
            Array.isArray(b.checklist) ? b.checklist.join(", ") : b.checklist,
            dir
          );
        case "notes":
          return compareStr(a.notes, b.notes, dir);
        case "stage":
          return compareStr(a.stage, b.stage, dir);
        case "year":
          return compareNum(a.year, b.year, dir);
        default:
          return 0;
      }
    };

    return list.slice().sort(cmp);
  }, [cars, query, sort, stageFilter]);

  const soldFirstList = useMemo(() => {
    const sold = [];
    const other = [];
    for (const c of filteredSorted) (isSold(c) ? sold : other).push(c);
    return [...sold, ...other];
  }, [filteredSorted]);

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

  const SortChevron = ({ dir }) => <span style={{ marginLeft: 6, opacity: 0.8 }}>{dir === "desc" ? "↓" : dir === "asc" ? "↑" : ""}</span>;

  const clickSort = (key) => {
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
            Car {sort.key === "car" && <SortChevron dir={sort.dir} />}
          </button>
        </th>
        <th style={{ minWidth: 140 }}>
          <button className="thbtn" onClick={() => clickSort("location")}>
            Location {sort.key === "location" && <SortChevron dir={sort.dir} />}
          </button>
        </th>
        <th style={{ minWidth: 280 }}>
          <button className="thbtn" onClick={() => clickSort("next")}>
            Next Loc {sort.key === "next" && <SortChevron dir={sort.dir} />}
          </button>
        </th>
        <th style={{ minWidth: 440 }}>
          <button className="thbtn" onClick={() => clickSort("checklist")}>
            Checklist {sort.key === "checklist" && <SortChevron dir={sort.dir} />}
          </button>
        </th>
        <th style={{ minWidth: 300 }}>
          <button className="thbtn" onClick={() => clickSort("notes")}>
            Notes {sort.key === "notes" && <SortChevron dir={sort.dir} />}
          </button>
        </th>
        <th style={{ minWidth: 90 }}>
          <button className="thbtn" onClick={() => clickSort("stage")}>
            Stage {sort.key === "stage" && <SortChevron dir={sort.dir} />}
          </button>
        </th>
        <th style={{ width: 90 }}>Act</th>
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
          <tr>
            <td colSpan={visibleCols} className="empty">
              No cars found.
            </td>
          </tr>
        ) : (
          list.map((car) => {
            const isEditing = editRow === car._id;
            return (
              <tr
                key={car._id}
                data-id={car._id}
                className={`row ${isEditing ? "row--editing" : ""} ${isSold(car) ? "row--sold" : ""}`}
                ref={isEditing ? (el) => { activeRef.current = el; } : null}
              >
                <td onDoubleClick={() => !isEditing && handleDoubleClick(car, "make")}>
                  {isEditing ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "nowrap" }}>
                      <input className="input input--compact" name="make" value={editData.make} onChange={handleChange} onKeyUp={rememberCaret} onClick={rememberCaret} placeholder="Make" style={{ width: 120 }} />
                      <input className="input input--compact" name="model" value={editData.model} onChange={handleChange} onKeyUp={rememberCaret} onClick={rememberCaret} placeholder="Model" style={{ width: 140 }} />
                      <input className="input input--compact" name="badge" value={editData.badge} maxLength={4} onChange={handleChange} onKeyUp={rememberCaret} onClick={rememberCaret} placeholder="Bdge" style={{ width: 60 }} />
                      <input className="input input--compact" name="rego" value={editData.rego} onChange={handleChange} onKeyUp={rememberCaret} onClick={rememberCaret} placeholder="REGO" style={{ width: 100, textTransform: "uppercase" }} />
                      <input className="input input--compact" name="year" value={editData.year} onChange={handleChange} onKeyUp={rememberCaret} onClick={rememberCaret} placeholder="Year" style={{ width: 70 }} />
                      <input className="input input--compact" name="description" value={editData.description} onChange={handleChange} onKeyUp={rememberCaret} onClick={rememberCaret} placeholder="Description" style={{ flex: 1, minWidth: 140 }} />
                    </div>
                  ) : (
                    <Cell>{carString(car) || "-"}</Cell>
                  )}
                </td>

                <td onDoubleClick={() => !isEditing && handleDoubleClick(car, "location")}>
                  {isEditing ? (
                    <input className="input input--compact" name="location" value={editData.location} onChange={handleChange} onKeyUp={rememberCaret} onClick={rememberCaret} />
                  ) : (
                    <Cell>{car.location || "-"}</Cell>
                  )}
                </td>

                <td onDoubleClick={() => !isEditing && openNextModal(car)}>
                  <Cell>
                    {Array.isArray(car.nextLocations) && car.nextLocations.length
                      ? car.nextLocations.join(", ")
                      : car.nextLocation || "-"}
                  </Cell>
                </td>

                <td onDoubleClick={() => !isEditing && openChecklistModal(car)} title={Array.isArray(car.checklist) ? car.checklist.join(", ") : ""}>
                  {isEditing ? (
                    <input className="input input--compact" name="checklist" value={editData.checklist} onChange={handleChange} onKeyUp={rememberCaret} onClick={rememberCaret} placeholder="Tyres, Service, Detail" />
                  ) : (
                    <Cell>{car.checklist && car.checklist.length > 0 ? car.checklist.join(", ") : "-"}</Cell>
                  )}
                </td>

                <td onDoubleClick={() => !isEditing && handleDoubleClick(car, "notes")}>
                  {isEditing ? (
                    <input className="input input--compact" name="notes" value={editData.notes} onChange={handleChange} onKeyUp={rememberCaret} onClick={rememberCaret} placeholder="Short notes" />
                  ) : (
                    <Cell>{car.notes || "-"}</Cell>
                  )}
                </td>

                <td onDoubleClick={() => !isEditing && handleDoubleClick(car, "stage")}>
                  {isEditing ? (
                    <select className="input input--compact" name="stage" value={editData.stage} onChange={handleChange} onClick={rememberCaret}>
                      {STAGES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Cell>{car.stage || "-"}</Cell>
                  )}
                </td>

                <td>
                  <div className="actions">
                    <button
                      className="btn btn--kebab btn--xs"
                      title="Open car profile"
                      onClick={() => {
                        setSelectedCar(car);
                        setProfileOpen(true);
                      }}
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
        .car-table col.col-car{width:auto;}
        .car-table col.col-loc{width:140px;}
        .car-table col.col-next{width:280px;}
        .car-table col.col-chk{width:440px;}
        .car-table col.col-notes{width:300px;}
        .car-table col.col-stage{width:90px;}
        .car-table col.col-act{width:90px;}
        .car-table .cell{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;}
        .thbtn{all:unset;cursor:pointer;color:#cbd5e1;padding:4px 6px;border-radius:6px;}
        .thbtn:hover{background:#1f2937;}

        .btn{ border:1px solid transparent; border-radius:10px; padding:6px 10px; cursor:pointer; font-weight:600; }
        .btn--danger{ background:#DC2626; color:#fff; }
        .btn--xs{ font-size:12px; padding:4px 8px; }
        .btn--icon{ padding:6px; width:32px; height:28px; display:inline-flex; align-items:center; justify-content:center; }

        :root{
          --sold-bg: rgba(14, 165, 233, 0.12);
          --sold-bg-hover: rgba(14, 165, 233, 0.18);
          --sold-border: rgba(14, 165, 233, 0.35);
        }
        .car-table tr.row--sold td{
          background: var(--sold-bg);
          box-shadow: inset 0 0 0 1px var(--sold-border);
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

  // SPLIT view
  if (view === "split") {
    return (
      <div className="page-pad with-ham">
        <HamburgerMenu />
        <style>{cssFix}</style>

        <div className="toolbar">
          <div className="titlebox">
            <h1 className="title">Car Inventory</h1>
            <p className="subtitle">{soldFirstList.length} cars</p>
          </div>

          <div className="split-toolbar">
            <div className="tabbar">
              <button className="tab" onClick={() => setView("regular")}>
                Regular
              </button>
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
                    title={s}
                  >
                    {s}
                  </button>
                );
              })}
            </div>

            <input
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search cars…"
            />
            <button className="btn btn--primary" onClick={() => setShowForm(true)}>
              + Add New Car
            </button>

            <button className="btn btn--muted" onClick={triggerCsvSplit} disabled={uploading}>
              {uploading ? "Uploading…" : "Upload CSV"}
            </button>
            <input
              ref={fileInputRefSplit}
              type="file"
              accept=".csv,text/csv"
              style={{ display: "none" }}
              onChange={handleCsvChosen}
            />

            <button className="btn btn--muted" onClick={() => setPasteOpen(true)}>
              Paste Online List
            </button>
          </div>
        </div>

        <CarListSplit embedded listOverride={soldFirstList} sortState={sort} />

        <style>{stageChipCss}</style>

        {showForm && <CarFormModal show={showForm} onClose={() => setShowForm(false)} onSave={handleSave} />}

        {pasteOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
            onClick={() => setPasteOpen(false)}
          >
            <div
              style={{ background: "#0b1220", border: "1px solid #243041", borderRadius: 12, width: "min(900px, 92vw)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: 14, borderBottom: "1px solid #243041" }}>
                <h3 style={{ margin: 0 }}>Paste Autogate List</h3>
                <p style={{ margin: "4px 0 0", color: "#9CA3AF", fontSize: 13 }}>
                  We’ll set cars to <b>Online</b> only if they’re currently <b>In Works</b>.
                </p>
              </div>
              <div style={{ padding: 14 }}>
                <textarea
                  className="input"
                  style={{ width: "100%", minHeight: 280, resize: "vertical" }}
                  placeholder="Paste the whole Autogate block here…"
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
                  <button className="btn" onClick={() => setPasteOpen(false)}>
                    Cancel
                  </button>
                  <button className="btn btn--primary" onClick={submitPaste}>
                    Process
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // REGULAR view
    // REGULAR view
  if (loading)
    return (
      <div className="page-pad with-ham">
        <HamburgerMenu />
        <style>{cssFix}</style>
        Loading…
      </div>
    );

  return (
    <div className="page-pad with-ham">
      <HamburgerMenu />
      <style>{cssFix}</style>

      <div className="toolbar">
        <div className="titlebox">
          <h1 className="title">Car Inventory</h1>
          <p className="subtitle">{soldFirstList.length} cars</p>
        </div>

        <div className="split-toolbar">
          <div className="tabbar">
            <button className="tab is-active">Regular</button>
            <button className="tab" onClick={() => setView("split")}>
              Split
            </button>
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
                  title={s}
                >
                  {s}
                </button>
              );
            })}
          </div>

          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cars…"
          />
          <button className="btn btn--primary" onClick={() => setShowForm(true)}>
            + Add New Car
          </button>

          <button className="btn btn--muted" onClick={triggerCsvRegular} disabled={uploading}>
            {uploading ? "Uploading…" : "Upload CSV"}
          </button>
          <input
            ref={fileInputRefRegular}
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            onChange={handleCsvChosen}
          />

          <button className="btn btn--muted" onClick={() => setPasteOpen(true)}>
            Paste Online List
          </button>
        </div>
      </div>

      <style>{stageChipCss}</style>

      {errMsg && <div className="alert alert--error">{errMsg}</div>}

      <Table list={soldFirstList} />

      {showForm && (
        <CarFormModal
          show={showForm}
          onClose={() => setShowForm(false)}
          onSave={handleSave}
        />
      )}

      {profileOpen && (
        <CarProfileModal
          open={profileOpen}
          car={selectedCar}
          onClose={() => setProfileOpen(false)}
        />
      )}

      {checklistModal.open && (
        <ChecklistFormModal
          open
          items={checklistModal.car?.checklist ?? []}
          onSave={saveChecklist}
          onClose={closeChecklistModal}
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
          onSave={saveNextLocations}
          onSetCurrent={setCurrentFromNext}
          onClose={closeNextModal}
        />
      )}

      {pasteOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setPasteOpen(false)}
        >
          <div
            style={{
              background: "#0b1220",
              border: "1px solid #243041",
              borderRadius: 12,
              width: "min(900px, 92vw)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: 14, borderBottom: "1px solid #243041" }}>
              <h3 style={{ margin: 0 }}>Paste Autogate List</h3>
              <p style={{ margin: "4px 0 0", color: "#9CA3AF", fontSize: 13 }}>
                We’ll set cars to <b>Online</b> only if they’re currently <b>In Works</b>.
              </p>
            </div>
            <div style={{ padding: 14 }}>
              <textarea
                className="input"
                style={{ width: "100%", minHeight: 280, resize: "vertical" }}
                placeholder="Paste the whole Autogate block here…"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
              />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
                <button className="btn" onClick={() => setPasteOpen(false)}>
                  Cancel
                </button>
                <button className="btn btn--primary" onClick={submitPaste}>
                  Process
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
