// src/components/Car/CarListSplit.jsx
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import api from "../../lib/api";
import CarFormModal from "./CarFormModal";
import CarProfileModal from "./CarProfileModal";
import ChecklistFormModal from "./ChecklistFormModal";
import NextLocationsFormModal from "./NextLocationsFormModal";
import "./CarList.css";

const STAGES = ["In Works", "In Works/Online", "Online", "Sold"];

/* ---------- Icons ---------- */
const TrashIcon = ({ size = 16 }) => (
  <svg
    className="icon"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M3 6h18"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M10 11v6M14 11v6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

/* ---------- Helpers ---------- */

const isSold = (car = {}) =>
  String(car.stage || "").trim().toLowerCase() === "sold";

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

const nextDir = (d) =>
  d === null ? "desc" : d === "desc" ? "asc" : null;

const norm = (v) =>
  v == null
    ? ""
    : Array.isArray(v)
    ? v.join(", ")
    : String(v);

const compareStr = (a, b, dir) => {
  const A = norm(a).toLowerCase();
  const B = norm(b).toLowerCase();
  if (A === B) return 0;
  return dir === "desc" ? (A < B ? 1 : -1) : A < B ? -1 : 1;
};

const compareNum = (a, b, dir) => {
  const A = Number(a ?? NaN);
  const B = Number(b ?? NaN);
  const aNaN = Number.isNaN(A);
  const bNaN = Number.isNaN(B);
  if (aNaN && bNaN) return 0;
  if (aNaN) return dir === "desc" ? 1 : -1;
  if (bNaN) return dir === "desc" ? -1 : 1;
  return dir === "desc" ? B - A : A - B;
};

const SortChevron = ({ dir }) => (
  <span style={{ marginLeft: 6, opacity: 0.8 }}>
    {dir === "desc" ? "↓" : dir === "asc" ? "↑" : ""}
  </span>
);

/* =================================================================== */

export default function CarListSplit({
  embedded = false,
  listOverride,
  sortState,
  onSortChange,
}) {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState(null);

  // header UI (only meaningful when not embedded)
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState(
    () => new Set(STAGES)
  );
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");

  // per-cell editing
  const [editTarget, setEditTarget] = useState({
    id: null,
    field: null,
  });
  const [editData, setEditData] = useState({});
  const savingRef = useRef(false);
  const activeRef = useRef(null);
  const caretRef = useRef({ name: null, start: null, end: null });
  const stageDirtyRef = useRef(false);

  // modals
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedCar, setSelectedCar] = useState(null);
  const [checklistModal, setChecklistModal] = useState({
    open: false,
    car: null,
  });
  const [nextModal, setNextModal] = useState({
    open: false,
    car: null,
  });

  // sort: internal when uncontrolled, external when used by CarListRegular
  const isControlled = !!onSortChange;
  const [internalSort, setInternalSort] = useState({
    key: null,
    dir: null,
  });
  const sort = isControlled
    ? sortState || { key: null, dir: null }
    : internalSort;

  /* ---------- fetch ---------- */
  useEffect(() => {
    if (listOverride) {
      setCars(listOverride);
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await api.get("/cars", {
          headers: { "Cache-Control": "no-cache" },
        });
        setCars(res.data?.data || []);
      } catch (err) {
        setErrMsg(
          err.response?.data?.message ||
            err.message ||
            "Error fetching cars"
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [listOverride]);

  const refreshCars = useCallback(async () => {
    if (listOverride) return;
    try {
      const res = await api.get("/cars", {
        headers: { "Cache-Control": "no-cache" },
      });
      setCars(res.data?.data || []);
    } catch (err) {
      setErrMsg(
        err.response?.data?.message ||
          err.message ||
          "Error fetching cars"
      );
    }
  }, [listOverride]);

  /* ---------- sort: header click handler ---------- */
  const handleSortClick = (key) => {
    if (isControlled) {
      const curr = sort || { key: null, dir: null };
      const dir = curr.key === key ? nextDir(curr.dir) : "desc";
      const next =
        dir === null
          ? { key: null, dir: null }
          : { key, dir };
      onSortChange(next);
    } else {
      setInternalSort((prev) => {
        const dir =
          prev.key === key ? nextDir(prev.dir) : "desc";
        return dir === null
          ? { key: null, dir: null }
          : { key, dir };
      });
    }
  };

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
      if (!root) return;
      const el =
        (focusName &&
          root.querySelector(
            `[name="${CSS.escape(focusName)}"]`
          )) ||
        root.querySelector("input, textarea, select");
      if (el) {
        el.focus();
        el.select?.();
      }
    });
  };

  const rememberCaret = (e) => {
    const { name, selectionStart, selectionEnd } = e.target;
    caretRef.current = {
      name,
      start: selectionStart ?? null,
      end: selectionEnd ?? null,
    };
  };

  const handleChange = (e) => {
    rememberCaret(e);
    const { name, value } = e.target;
    if (name === "year") {
      return setEditData((p) => ({
        ...p,
        year: value.replace(/[^\d]/g, ""),
      }));
    }
    if (name === "badge") {
      return setEditData((p) => ({
        ...p,
        badge: value.slice(0, 4),
      }));
    }
    if (name === "rego") {
      const clean = value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
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
      (name &&
        root.querySelector(
          `[name="${CSS.escape(name)}"]`
        )) ||
      root.querySelector("input, textarea, select");
    if (!el) return;
    if (document.activeElement !== el) el.focus();
    if (
      typeof el.setSelectionRange === "function" &&
      "value" in el
    ) {
      const v = el.value ?? "";
      const s =
        typeof start === "number"
          ? Math.min(start, v.length)
          : v.length;
      const ee =
        typeof end === "number"
          ? Math.min(end, v.length)
          : v.length;
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
            year:
              editData.year === ""
                ? undefined
                : Number(editData.year),
            description: (editData.description || "").trim(),
          };
          break;
        case "location":
          payload = {
            location: (editData.location || "").trim(),
          };
          break;
        case "notes":
          payload = { notes: (editData.notes || "").trim() };
          break;
        case "stage":
          payload = {
            stage: (editData.stage || "In Works").trim(),
          };
          break;
        default:
          break;
      }

      const res = await api.put(
        `/cars/${editTarget.id}`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (res?.data?.data) {
        const updated = res.data.data;
        if (listOverride && Array.isArray(listOverride)) {
          const ix = listOverride.findIndex(
            (c) => c && c._id === updated._id
          );
          if (ix !== -1) {
            Object.assign(listOverride[ix], updated);
          }
        } else {
          setCars((prev) =>
            prev.map((c) =>
              c._id === updated._id ? updated : c
            )
          );
        }
      } else if (!listOverride) {
        await refreshCars();
      }

      setEditTarget({ id: null, field: null });
    } catch (err) {
      alert(
        "Error updating car: " +
          (err.response?.data?.message ||
            err.message)
      );
      if (!listOverride) await refreshCars();
      setEditTarget({ id: null, field: null });
    } finally {
      savingRef.current = false;
    }
  };

  useEffect(() => {
    const onDown = (e) => {
      if (!editTarget.id) return;
      const rowEl = document.querySelector(
        `tr[data-id="${editTarget.id}"]`
      );
      if (!rowEl) return;
      if (!rowEl.contains(e.target)) {
        if (
          editTarget.field === "stage" &&
          !stageDirtyRef.current
        ) {
          setEditTarget({ id: null, field: null });
        } else {
          saveChanges();
        }
      }
    };
    if (editTarget.id)
      document.addEventListener("mousedown", onDown);
    if (editTarget.id)
      document.addEventListener("touchstart", onDown, {
        passive: true,
      });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTarget, editData]);

  const handleDelete = async (carId) => {
    if (!window.confirm("Delete this car?")) return;
    try {
      await api.delete(
        `/cars/${encodeURIComponent(carId)}`
      );
      setCars((prev) =>
        prev.filter((c) => c._id !== carId)
      );
      await refreshCars();
    } catch (err) {
      const status = err?.response?.status;
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Delete failed";
      if (status === 404) {
        alert(
          "Car not found (may already be deleted). Refreshing list."
        );
        await refreshCars();
      } else if (status === 401) {
        alert("Not authorized. Please log in again.");
      } else {
        alert(`Delete failed: ${msg}`);
      }
    }
  };

  /* ---------- header actions (standalone Split only) ---------- */
  const triggerCsv = () =>
    fileInputRef.current?.click();

  const handleCsvChosen = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("defaultStage", "In Works");
      const res = await api.post(
        "/cars/import-csv",
        form,
        {
          headers: {
            "Content-Type":
              "multipart/form-data",
          },
        }
      );
      const {
        createdCount = 0,
        skippedCount = 0,
        errorCount = 0,
      } = res.data || {};
      alert(
        `Import complete\nCreated: ${createdCount}\nSkipped: ${skippedCount}\nErrors: ${errorCount}`
      );
      await refreshCars();
    } catch (err) {
      alert(
        `CSV import failed: ${
          err.response?.data?.message ||
          err.message
        }`
      );
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
        {
          headers: {
            "Content-Type":
              "application/json",
          },
        }
      );
      const d = res.data?.data || {};
      alert(
        `Processed.\nChanged: ${
          d.totals?.changed ?? 0
        }\nSkipped: ${
          d.totals?.skipped ?? 0
        }\nNot found: ${
          d.totals?.notFound ?? 0
        }`
      );
      setPasteOpen(false);
      setPasteText("");
      await refreshCars();
    } catch (e) {
      alert(
        e.response?.data?.message ||
          e.message ||
          "Error processing pasted list"
      );
    }
  };

  /* ---------- data shaping + sorting ---------- */

  const [leftList, rightList] = useMemo(() => {
    // base list: either coming from parent or local state
    let list = cars;

    // Embedded + listOverride: parent (CarListRegular) already:
    // - applied filters/search
    // - applied sorting
    // - put Sold first (soldFirstList)
    // Here we ONLY handle "Sold pinned to left column".
    if (embedded && listOverride) {
      const sold = list.filter(isSold);
      const other = list.filter((c) => !isSold(c));

      const total = sold.length + other.length;
      const targetLeft = Math.ceil(total / 2);
      const othersOnLeft = Math.max(
        0,
        targetLeft - sold.length
      );

      const left = [
        ...sold,
        ...other.slice(0, othersOnLeft),
      ];
      const right = other.slice(othersOnLeft);
      return [left, right];
    }

    // Standalone Split view: we own filters + sorting.
    // Stage filter
    if (!embedded) {
      list =
        stageFilter.size > 0
          ? list.filter((c) =>
              stageFilter.has(c?.stage ?? "")
            )
          : [];

      // Search
      const q = query.trim().toLowerCase();
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
            ...(Array.isArray(
              car.nextLocations
            )
              ? car.nextLocations
              : [car.nextLocation]),
            ...(Array.isArray(car.checklist)
              ? car.checklist
              : []),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return hay.includes(q);
        });
      }
    }

    // Split into Sold vs Other
    let sold = [];
    let other = [];
    for (const c of list) {
      (isSold(c) ? sold : other).push(c);
    }

    // Apply sort (pinned-sold semantics):
    // sort each group separately so Sold stay together.
    if (sort?.key && sort?.dir) {
      const { key, dir } = sort;

      const cmp = (a, b) => {
        switch (key) {
          case "car": {
            const byMake = compareStr(
              a.make,
              b.make,
              dir
            );
            if (byMake !== 0) return byMake;
            return compareStr(
              a.model,
              b.model,
              dir
            );
          }
          case "location":
            return compareStr(
              a.location,
              b.location,
              dir
            );
          case "next": {
            const an =
              Array.isArray(
                a.nextLocations
              ) && a.nextLocations.length
                ? a.nextLocations.join(", ")
                : a.nextLocation;
            const bn =
              Array.isArray(
                b.nextLocations
              ) && b.nextLocations.length
                ? b.nextLocations.join(", ")
                : b.nextLocation;
            return compareStr(an, bn, dir);
          }
          case "checklist": {
            const ac =
              Array.isArray(a.checklist)
                ? a.checklist.join(", ")
                : a.checklist;
            const bc =
              Array.isArray(b.checklist)
                ? b.checklist.join(", ")
                : b.checklist;
            return compareStr(ac, bc, dir);
          }
          case "notes":
            return compareStr(
              a.notes,
              b.notes,
              dir
            );
          case "stage":
            return compareStr(
              a.stage,
              b.stage,
              dir
            );
          case "year":
            return compareNum(
              a.year,
              b.year,
              dir
            );
          default:
            return 0;
        }
      };

      sold = sold.slice().sort(cmp);
      other = other.slice().sort(cmp);
    }

    // Now distribute rows into two columns:
    // - all Sold stay in LEFT
    // - fill left with some "other" rows to balance height
    // - right only ever contains "other" rows
    const total = sold.length + other.length;
    const targetLeft = Math.ceil(total / 2);
    const othersOnLeft = Math.max(
      0,
      targetLeft - sold.length
    );

    const left = [
      ...sold,
      ...other.slice(0, othersOnLeft),
    ];
    const right = other.slice(othersOnLeft);

    return [left, right];
  }, [
    cars,
    listOverride,
    query,
    stageFilter,
    embedded,
    sort?.key,
    sort?.dir,
  ]);

  if (loading)
    return <div className="page-pad">Loading…</div>;

  return (
    <div className="page-pad">
      <style>{`
        /* Split grid */
        .split-panels{
          display:grid;
          grid-template-columns: 1fr;
          gap:12px;
        }
        @media (min-width: 1100px){
          .split-panels{
            grid-template-columns: 1fr 1fr;
          }
        }

        .table-wrap{
          position:relative;
          overflow-x:auto;
          overflow-y:hidden;
          -webkit-overflow-scrolling:touch;
          border:1px solid #1d2a3a;
          border-radius:10px;
          background:#0b1220;
        }

        .car-table{
          width:100%;
          table-layout:fixed;
          border-collapse:separate;
          border-spacing:0;
          font-size:13px;
          line-height:1.25;
        }
        .car-table th,
        .car-table td{
          padding:6px 8px;
          vertical-align:middle;
        }
        .car-table thead th{
          position:sticky;
          top:0;
          background:#0f1a2b;
          z-index:1;
        }

        .car-table col.col-car{ width:340px; }
        .car-table col.col-loc{ width:100px; }
        .car-table col.col-next{ width:160px; }
        .car-table col.col-chk{ width:220px; }
        .car-table col.col-notes{ width:160px; }
        .car-table col.col-stage{ width:84px; }
        .car-table col.col-act{ width:74px; }

        @media (min-width: 1400px){
          .car-table{ font-size:12px; }
          .car-table th,
          .car-table td{ padding:4px 6px; }
          .car-table col.col-car{ width:300px; }
          .car-table col.col-loc{ width:88px; }
          .car-table col.col-next{ width:140px; }
          .car-table col.col-chk{ width:200px; }
          .car-table col.col-notes{ width:150px; }
          .car-table col.col-stage{ width:80px; }
          .car-table col.col-act{ width:70px; }
        }

        .car-table .cell{
          display:block;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
          max-width:100%;
        }

        .thbtn{
          all:unset;
          cursor:pointer;
          color:#cbd5e1;
          padding:4px 6px;
          border-radius:6px;
        }
        .thbtn:hover{
          background:#1f2937;
        }

        /* Editing */
        td.is-editing{
          background:#0c1a2e;
          box-shadow: inset 0 0 0 1px #2b3b54;
          border-radius:8px;
          position:relative;
          z-index:5;
          overflow:visible;
        }
        .edit-cell{
          display:flex;
          align-items:center;
          gap:8px;
        }
        .edit-cell-group{
          display:flex;
          flex-direction:column;
          gap:6px;
        }
        .edit-inline{
          display:flex;
          gap:6px;
        }
        .edit-actions{
          display:flex;
          gap:6px;
          margin-top:2px;
        }
        .input.input--compact{
          padding:7px 9px;
          font-size:12.5px;
          line-height:1.25;
        }
        .edit-cell-group .input{
          width:100%;
        }
        td.is-editing .input--wider{
          width:auto;
          min-width:260px;
          max-width:min(640px, 70vw);
        }
        td.is-editing .textarea--wider{
          width:auto;
          min-width:360px;
          max-width:min(720px, 80vw);
          min-height:40px;
          resize:vertical;
        }

        .btn{
          border:1px solid transparent;
          border-radius:10px;
          padding:6px 10px;
          cursor:pointer;
          font-weight:600;
        }
        .btn--xs{
          font-size:12px;
          padding:4px 8px;
        }
        .btn--icon{
          padding:4px;
          width:28px;
          height:24px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
        }
        .btn--danger{
          background:#DC2626;
          color:#fff;
        }
        .btn--kebab{
          background:#1f2a3e;
          color:#c9d3e3;
        }

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

      {/* Header (hidden when embedded inside Regular) */}
      {!embedded && (
        <div className="toolbar header-row">
          <h1 className="title" style={{ margin: 0 }}>
            Car Inventory
          </h1>
          <p className="subtitle" style={{ margin: 0 }}>
            {cars.length} cars
          </p>

          <div
            className="chip-row"
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
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
            style={{
              flex: "1 1 360px",
              minWidth: 220,
            }}
          />

          <div
            className="btn-row"
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <button
              className="btn btn--primary"
              onClick={() => setShowForm(true)}
            >
              + Add New Car
            </button>
            <button
              className="btn btn--muted"
              onClick={triggerCsv}
              disabled={uploading}
            >
              {uploading ? "Uploading…" : "Upload CSV"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: "none" }}
              onChange={handleCsvChosen}
            />
            <button
              className="btn btn--muted"
              onClick={() => setPasteOpen(true)}
            >
              Paste Online List
            </button>
          </div>
        </div>
      )}

      {errMsg && (
        <div className="alert alert--error">
          {errMsg}
        </div>
      )}

      {/* Two tables side by side */}
      <div className="split-panels">
        <Table
          list={leftList}
          sort={sort}
          onSortClick={handleSortClick}
          {...{
            editTarget,
            setEditTarget,
            editData,
            startEdit,
            rememberCaret,
            handleChange,
            saveChanges,
            stageDirtyRef,
            activeRef,
            setProfileOpen,
            setSelectedCar,
            setChecklistModal,
            setNextModal,
            handleDelete,
          }}
        />
        <Table
          list={rightList}
          sort={sort}
          onSortClick={handleSortClick}
          {...{
            editTarget,
            setEditTarget,
            editData,
            startEdit,
            rememberCaret,
            handleChange,
            saveChanges,
            stageDirtyRef,
            activeRef,
            setProfileOpen,
            setSelectedCar,
            setChecklistModal,
            setNextModal,
            handleDelete,
          }}
        />
      </div>

      {/* Modals */}
      {showForm && (
        <CarFormModal
          show={showForm}
          onClose={() => setShowForm(false)}
          onSave={refreshCars}
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
          onSave={async (items) => {
            if (!checklistModal.car) return;
            try {
              await api.put(
                `/cars/${checklistModal.car._id}`,
                { checklist: items },
                {
                  headers: {
                    "Content-Type":
                      "application/json",
                  },
                }
              );
              await refreshCars();
            } catch (e) {
              alert(
                e.response?.data?.message ||
                  e.message ||
                  "Error saving checklist"
              );
            } finally {
              setChecklistModal({
                open: false,
                car: null,
              });
            }
          }}
          onClose={() =>
            setChecklistModal({
              open: false,
              car: null,
            })
          }
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
            if (!nextModal.car) return;
            try {
              await api.put(
                `/cars/${nextModal.car._id}`,
                {
                  nextLocations: items,
                  nextLocation:
                    items[items.length - 1] ?? "",
                },
                {
                  headers: {
                    "Content-Type":
                      "application/json",
                  },
                }
              );
              await refreshCars();
            } catch (e) {
              alert(
                e.response?.data?.message ||
                  e.message ||
                  "Error saving destinations"
              );
            } finally {
              setNextModal({
                open: false,
                car: null,
              });
            }
          }}
          onSetCurrent={async (loc) => {
            if (!nextModal.car) return;
            try {
              const existing = Array.isArray(
                nextModal.car.nextLocations
              )
                ? nextModal.car.nextLocations
                : nextModal.car.nextLocation
                ? [nextModal.car.nextLocation]
                : [];
              const remaining = existing.filter(
                (s) => s !== loc
              );
              await api.put(
                `/cars/${nextModal.car._id}`,
                {
                  location: loc,
                  nextLocations: remaining,
                  nextLocation:
                    remaining[
                      remaining.length - 1
                    ] ?? "",
                },
                {
                  headers: {
                    "Content-Type":
                      "application/json",
                  },
                }
              );
              await refreshCars();
            } catch (e) {
              alert(
                e.response?.data?.message ||
                  e.message ||
                  "Error setting current location"
              );
            }
          }}
          onClose={() =>
            setNextModal({
              open: false,
              car: null,
            })
          }
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
            <div
              style={{
                padding: 14,
                borderBottom:
                  "1px solid #243041",
              }}
            >
              <h3 style={{ margin: 0 }}>
                Paste Autogate List
              </h3>
              <p
                style={{
                  margin: "4px 0 0",
                  color: "#9CA3AF",
                  fontSize: 13,
                }}
              >
                We’ll set cars to <b>Online</b>{" "}
                only if they’re currently{" "}
                <b>In Works</b>.
              </p>
            </div>
            <div style={{ padding: 14 }}>
              <textarea
                className="input"
                style={{
                  width: "100%",
                  minHeight: 280,
                  resize: "vertical",
                }}
                placeholder="Paste the whole Autogate block here…"
                value={pasteText}
                onChange={(e) =>
                  setPasteText(e.target.value)
                }
              />
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  justifyContent:
                    "flex-end",
                  marginTop: 10,
                }}
              >
                <button
                  className="btn"
                  onClick={() =>
                    setPasteOpen(false)
                  }
                >
                  Cancel
                </button>
                <button
                  className="btn btn--primary"
                  onClick={submitPaste}
                >
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

/* ---------- Table (dumb, uses provided sort + click handler) ---------- */
function Table({
  list,
  sort,
  onSortClick,
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
  const Sort = ({ col }) =>
    sort?.key === col ? (
      <SortChevron dir={sort.dir} />
    ) : null;

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
            <th>
              <button
                className="thbtn"
                onClick={() => onSortClick("car")}
              >
                Car <Sort col="car" />
              </button>
            </th>
            <th>
              <button
                className="thbtn"
                onClick={() =>
                  onSortClick("location")
                }
              >
                Location{" "}
                <Sort col="location" />
              </button>
            </th>
            <th>
              <button
                className="thbtn"
                onClick={() =>
                  onSortClick("next")
                }
              >
                Next Loc <Sort col="next" />
              </button>
            </th>
            <th>
              <button
                className="thbtn"
                onClick={() =>
                  onSortClick(
                    "checklist"
                  )
                }
              >
                Checklist{" "}
                <Sort col="checklist" />
              </button>
            </th>
            <th>
              <button
                className="thbtn"
                onClick={() =>
                  onSortClick("notes")
                }
              >
                Notes <Sort col="notes" />
              </button>
            </th>
            <th>
              <button
                className="thbtn"
                onClick={() =>
                  onSortClick("stage")
                }
              >
                Stage <Sort col="stage" />
              </button>
            </th>
            <th>Act</th>
          </tr>
        </thead>
        <tbody>
          {list.length === 0 ? (
            <tr>
              <td
                colSpan={7}
                className="empty"
              >
                No cars.
              </td>
            </tr>
          ) : (
            list.map((car) => {
              const editing =
                editTarget.id === car._id
                  ? editTarget.field
                  : null;
              const refCb = editing
                ? (el) => {
                    if (el)
                      activeRef.current =
                        el;
                  }
                : null;

              return (
                <tr
                  key={car._id}
                  data-id={car._id}
                  className={
                    isSold(car)
                      ? "row--sold"
                      : ""
                  }
                  ref={refCb}
                >
                  {/* CAR */}
                  <td
                    onDoubleClick={() =>
                      editing !==
                        "car" &&
                      startEdit(
                        car,
                        "car",
                        "make"
                      )
                    }
                    className={
                      editing ===
                      "car"
                        ? "is-editing"
                        : ""
                    }
                  >
                    {editing ===
                    "car" ? (
                      <div className="edit-cell-group">
                        <input
                          className="input input--compact"
                          name="make"
                          value={
                            editData.make
                          }
                          onChange={
                            handleChange
                          }
                          onKeyUp={
                            rememberCaret
                          }
                          onClick={
                            rememberCaret
                          }
                          placeholder="Make"
                        />
                        <input
                          className="input input--compact"
                          name="model"
                          value={
                            editData.model
                          }
                          onChange={
                            handleChange
                          }
                          onKeyUp={
                            rememberCaret
                          }
                          onClick={
                            rememberCaret
                          }
                          placeholder="Model"
                        />
                        <div className="edit-inline">
                          <input
                            className="input input--compact"
                            name="badge"
                            value={
                              editData.badge
                            }
                            maxLength={
                              4
                            }
                            onChange={
                              handleChange
                            }
                            onKeyUp={
                              rememberCaret
                            }
                            onClick={
                              rememberCaret
                            }
                            placeholder="Badge"
                          />
                          <input
                            className="input input--compact"
                            name="year"
                            value={
                              editData.year
                            }
                            onChange={
                              handleChange
                            }
                            onKeyUp={
                              rememberCaret
                            }
                            onClick={
                              rememberCaret
                            }
                            placeholder="Year"
                          />
                        </div>
                        <input
                          className="input input--compact"
                          name="description"
                          value={
                            editData.description
                          }
                          onChange={
                            handleChange
                          }
                          onKeyUp={
                            rememberCaret
                          }
                          onClick={
                            rememberCaret
                          }
                          placeholder="Description"
                        />
                        <input
                          className="input input--compact"
                          name="rego"
                          value={
                            editData.rego
                          }
                          onChange={
                            handleChange
                          }
                          onKeyUp={
                            rememberCaret
                          }
                          onClick={
                            rememberCaret
                          }
                          placeholder="REGO"
                          style={{
                            textTransform:
                              "uppercase",
                          }}
                        />
                        <div className="edit-actions">
                          <button
                            className="btn btn--primary"
                            onClick={
                              saveChanges
                            }
                          >
                            Save
                          </button>
                          <button
                            className="btn"
                            onClick={() =>
                              setEditTarget(
                                {
                                  id: null,
                                  field: null,
                                }
                              )
                            }
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span
                        className="cell"
                        title={carString(
                          car
                        )}
                      >
                        {carString(
                          car
                        ) ||
                          "-"}
                      </span>
                    )}
                  </td>

                  {/* LOCATION */}
                  <td
                    onDoubleClick={() =>
                      editing !==
                        "location" &&
                      startEdit(
                        car,
                        "location",
                        "location"
                      )
                    }
                    className={
                      editing ===
                      "location"
                        ? "is-editing"
                        : ""
                    }
                  >
                    {editing ===
                    "location" ? (
                      <div className="edit-cell">
                        <input
                          className="input input--compact input--wider"
                          name="location"
                          value={
                            editData.location
                          }
                          onChange={
                            handleChange
                          }
                          onKeyUp={
                            rememberCaret
                          }
                          onClick={
                            rememberCaret
                          }
                          placeholder="Location"
                        />
                        <div className="edit-actions">
                          <button
                            className="btn btn--primary"
                            onClick={
                              saveChanges
                            }
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span
                        className="cell"
                        title={
                          car.location ||
                          ""
                        }
                      >
                        {car.location ||
                          "-"}
                      </span>
                    )}
                  </td>

                  {/* NEXT (modal) */}
                  <td
                    onDoubleClick={() =>
                      setNextModal({
                        open: true,
                        car,
                      })
                    }
                  >
                    <span
                      className="cell"
                      title={
                        Array.isArray(
                          car.nextLocations
                        ) &&
                        car
                          .nextLocations
                          .length
                          ? car.nextLocations.join(
                              ", "
                            )
                          : car.nextLocation ||
                            ""
                      }
                    >
                      {Array.isArray(
                        car.nextLocations
                      ) &&
                      car
                        .nextLocations
                        .length
                        ? car.nextLocations.join(
                            ", "
                          )
                        : car.nextLocation ||
                          "-"}
                    </span>
                  </td>

                  {/* CHECKLIST (modal) */}
                  <td
                    onDoubleClick={() =>
                      setChecklistModal({
                        open: true,
                        car,
                      })
                    }
                    onClick={() =>
                      setChecklistModal({
                        open: true,
                        car,
                      })
                    }
                  >
                    <span
                      className="cell"
                      title={
                        Array.isArray(
                          car.checklist
                        )
                          ? car.checklist.join(
                              ", "
                            )
                          : ""
                      }
                    >
                      {Array.isArray(
                        car.checklist
                      ) &&
                      car
                        .checklist
                        .length
                        ? car.checklist.join(
                            ", "
                          )
                        : "-"}
                    </span>
                  </td>

                  {/* NOTES */}
                  <td
                    onDoubleClick={() =>
                      editing !==
                        "notes" &&
                      startEdit(
                        car,
                        "notes",
                        "notes"
                      )
                    }
                    className={
                      editing ===
                      "notes"
                        ? "is-editing"
                        : ""
                    }
                  >
                    {editing ===
                    "notes" ? (
                      <div className="edit-cell">
                        <textarea
                          className="input input--compact textarea--wider"
                          name="notes"
                          rows={2}
                          value={
                            editData.notes
                          }
                          onChange={
                            handleChange
                          }
                          onKeyUp={
                            rememberCaret
                          }
                          onClick={
                            rememberCaret
                          }
                          placeholder="Notes"
                        />
                        <div className="edit-actions">
                          <button
                            className="btn btn--primary"
                            onClick={
                              saveChanges
                            }
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span
                        className="cell"
                        title={
                          car.notes ||
                          ""
                        }
                      >
                        {car.notes ||
                          "-"}
                      </span>
                    )}
                  </td>

                  {/* STAGE */}
                  <td
                    onDoubleClick={() =>
                      editing !==
                        "stage" &&
                      startEdit(
                        car,
                        "stage",
                        "stage"
                      )
                    }
                    className={
                      editing ===
                      "stage"
                        ? "is-editing"
                        : ""
                    }
                  >
                    {editing ===
                    "stage" ? (
                      <div className="edit-cell">
                        <select
                          className="input input--compact input--select-lg input--wider"
                          name="stage"
                          value={
                            editData.stage
                          }
                          onChange={(
                            e
                          ) => {
                            stageDirtyRef.current = true;
                            return handleChange(
                              e
                            );
                          }}
                          onBlur={() => {
                            if (
                              stageDirtyRef.current
                            )
                              saveChanges();
                            else
                              setEditTarget(
                                {
                                  id: null,
                                  field: null,
                                }
                              );
                          }}
                          onClick={(
                            e
                          ) =>
                            e.stopPropagation()
                          }
                          onMouseDown={(
                            e
                          ) =>
                            e.stopPropagation()
                          }
                          onTouchStart={(
                            e
                          ) =>
                            e.stopPropagation()
                          }
                        >
                          {STAGES.map(
                            (
                              s
                            ) => (
                              <option
                                key={
                                  s
                                }
                                value={
                                  s
                                }
                              >
                                {
                                  s
                                }
                              </option>
                            )
                          )}
                        </select>
                      </div>
                    ) : (
                      <span className="cell">
                        {car.stage ||
                          "-"}
                      </span>
                    )}
                  </td>

                  {/* ACTIONS */}
                  <td>
                    <div
                      className="actions"
                      style={{
                        display:
                          "flex",
                        gap: 6,
                      }}
                    >
                      <button
                        className="btn btn--kebab btn--xs"
                        title="Open car profile"
                        onClick={() => {
                          setSelectedCar(
                            car
                          );
                          setProfileOpen(
                            true
                          );
                        }}
                      >
                        ⋯
                      </button>
                      <button
                        className="btn btn--danger btn--xs btn--icon"
                        title="Delete car"
                        aria-label="Delete"
                        onClick={() =>
                          handleDelete(
                            car._id
                          )
                        }
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
      </table>
    </div>
  );
}
