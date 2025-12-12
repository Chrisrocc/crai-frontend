// src/components/Car/CarListRegular.jsx
// Regular inventory view (with optional Split view embedded)
// - Photo column is toggleable (Show / Hide Photos)
// - Photo column hidden by default, normal row height
// - Show/Hide Photos button sits inline with Upload CSV + Paste buttons

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
import CarListSplit from "./CarListSplit";
import "./CarList.css";
import HamburgerMenu from "../utils/HamburgerMenu";

const STAGES = ["In Works", "In Works/Online", "Online", "Sold"];

/* ------- page-level CSS: menu spacing + mobile behavior (only tables scroll) ------- */
const cssFix = `
html, body { width: 100%; margin:0; overflow-x:hidden; }
#root { overflow-x:hidden; }

/* Keep page padding modest and consistent */
.page-pad { padding: clamp(10px, 2vw, 18px); max-width:100vw; }

/* ===== Toolbar (shared) ===== */
.toolbar{
  display:flex; align-items:center; justify-content:center;
  gap:6px; row-gap:6px; column-gap:6px;
  flex-wrap:wrap;
  margin:6px 0;
}
.titlebox{ display:flex; flex-direction:column; gap:2px; min-width:0; }
.title{ margin:0 !important; }
.subtitle{ margin:0 !important; color:#9CA3AF; font-size:12px; }

/* Right side of header */
.split-toolbar{
  display:flex; flex-wrap:wrap; align-items:center; justify-content:center;
  gap:6px; row-gap:6px; column-gap:6px;
  flex: 1 1 600px; min-width:260px; max-width:100%;
}

/* chips + tabs */
.tabbar{display:inline-flex;gap:4px;background:#0b1220;border:1px solid #243041;padding:3px 4px;border-radius:10px;}
.tab{border:0;padding:5px 9px;border-radius:8px;background:transparent;color:#cbd5e1;cursor:pointer;font-weight:600;}
.tab.is-active{background:#1f2937;color:#fff;}
.chipbar{ display:flex; gap:6px; flex-wrap:wrap; }

/* inputs */
.input{
  background:#0b1220; color:#e5e7eb; border:1px solid #243041; border-radius:10px;
  padding:8px 10px; outline:none; min-width:140px;
  width: clamp(180px, 26vw, 360px); /* narrower so buttons + photos toggle stay on one line */
}
.input:focus{ border-color:#2E4B8F; box-shadow:0 0 0 3px rgba(37,99,235,.25); }
.input--compact{ padding:6px 8px; border-radius:8px; min-width:0; width:100%; }
.input--select-lg{ min-height:44px; font-size:16px; }

/* buttons */
.btn{ border:1px solid transparent; border-radius:8px; padding:7px 10px; font-weight:600; cursor:pointer; white-space:nowrap; }
.btn.btn--muted{ background:#1f2937; color:#e5e7eb; border:1px solid #243041; }
.btn.btn--primary{ background:#2563EB !important; color:#fff !important; }

/* small buttons so all 3 fit on one row */
.btn.btn--sm{ padding:5px 8px; font-size:12px; border-radius:8px; }

/* ===== Desktop header: keep everything inline ===== */
@media (min-width: 1024px){
  .split-toolbar{
    flex-wrap:nowrap;              /* prevent wrapping so Hide Photos stays inline */
    justify-content:flex-end;
  }

  .split-toolbar .input{
    flex:0 1 260px;
    max-width:340px;              /* shorter search bar, frees room for buttons */
  }
}

/* ===== Mobile/tablet tweaks (KILL vertical space) ===== */
@media (max-width: 1024px){
  .toolbar,
  .split-toolbar{
    gap:4px !important; row-gap:4px !important; column-gap:4px !important;
    margin:4px 0 !important;
  }
  .toolbar > *, .split-toolbar > * { margin:0 !important; }
  .title{ font-size:22px !important; }
  .subtitle{ font-size:12px !important; }
  .input{ width:min(520px, 100%) !important; }
}

/* ===== Table container scroll (unchanged) ===== */
.table-wrap{
  position:relative; overflow-x:auto; overflow-y:hidden; -webkit-overflow-scrolling:touch; max-width:100%;
}
.table-wrap::-webkit-scrollbar{ height:12px; }
.table-wrap::-webkit-scrollbar-track{ background:#0B1220; border-radius:10px; }
.table-wrap::-webkit-scrollbar-thumb{ background:#59637C; border:2px solid #0B1220; border-radius:10px; }
.table-wrap:hover::-webkit-scrollbar-thumb{ background:#7B88A6; }
`;

/* chip theme */
const stageChipCss = `
.chipbar{ display:flex; gap:6px; flex-wrap:wrap; }
.chip{
  border:1px solid #243041; border-radius:999px; padding:8px 12px; cursor:pointer;
  background:#0b1220; color:#cbd5e1; font-weight:600;
  transition:filter .1s ease, transform .02s ease, background .15s ease, color .15s ease;
}
.chip:hover{ filter:brightness(1.1); }
.chip:active{ transform: translateY(0.5px); }
.chip.chip--on{ background:#2563EB; color:#fff; border-color:transparent; }

/* Larger, easy-to-tap select for Stage */
.input--select-lg{
  min-height: 44px;
  font-size: 16px;
  width: 100%;
}
`;

/* trash icon */
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

// helpers
const nextDir = (d) => (d === null ? "desc" : d === "desc" ? "asc" : null);
const normalize = (v) =>
  v == null ? "" : Array.isArray(v) ? v.join(", ") : String(v);
const compareStr = (a, b, dir) => {
  const A = normalize(a).toLowerCase();
  const B = normalize(b).toLowerCase();
  if (A === B) return 0;
  return dir === "desc" ? (A < B ? 1 : -1) : A < B ? -1 : 1;
};
const compareNum = (a, b, dir) => {
  const A = Number(a ?? NaN);
  const B = Number(b ?? NaN);
  if (Number.isNaN(A) && Number.isNaN(B)) return 0;
  if (Number.isNaN(A)) return dir === "desc" ? 1 : -1;
  if (Number.isNaN(B)) return dir === "desc" ? -1 : 1;
  return dir === "desc" ? B - A : A - B;
};
const isSold = (car = {}) =>
  String(car.stage || "").trim().toLowerCase() === "sold";

/* --- days-at-location helper (matches history logic) --- */
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const dateOnly = (d) => {
  const dt = new Date(d || Date.now());
  dt.setHours(0, 0, 0, 0);
  return dt;
};

const daysAtCurrentLocation = (car) => {
  if (!car?.location) return null;
  const history = Array.isArray(car.history) ? car.history : [];
  if (!history.length) return null;

  // Prefer an open segment at this location (no endDate)
  let current = history.find((h) => !h.endDate && h.location === car.location);

  // Fallback: latest segment with this location
  if (!current) {
    const sameLoc = history.filter((h) => h.location === car.location);
    if (!sameLoc.length) return null;
    current = sameLoc[sameLoc.length - 1];
  }

  if (!current?.startDate) return null;

  const start = dateOnly(current.startDate);
  const end = current.endDate ? dateOnly(current.endDate) : dateOnly(Date.now());
  const diffDays = Math.max(1, Math.floor((end - start) / MS_PER_DAY));
  return diffDays;
};

/* ===========================
   STABLE TABLE COMPONENTS
   (MOVED OUTSIDE CarListRegular
   so scroll position doesn't reset)
   =========================== */

const SortChevron = ({ dir }) => (
  <span style={{ marginLeft: 6, opacity: 0.8 }}>
    {dir === "desc" ? "↓" : dir === "asc" ? "↑" : ""}
  </span>
);

const TableHeader = ({ showPhotos, sort, onClickSort }) => (
  <thead>
    <tr>
      {showPhotos && (
        <th className="photo-header" style={{ width: 70 }}>
          Photo
        </th>
      )}
      <th>
        <button className="thbtn" onClick={() => onClickSort("car")}>
          Car {sort.key === "car" && <SortChevron dir={sort.dir} />}
        </button>
      </th>
      <th style={{ minWidth: 140 }}>
        <button className="thbtn" onClick={() => onClickSort("location")}>
          Location {sort.key === "location" && <SortChevron dir={sort.dir} />}
        </button>
      </th>
      <th style={{ minWidth: 220 }}>
        <button className="thbtn" onClick={() => onClickSort("next")}>
          Next Loc {sort.key === "next" && <SortChevron dir={sort.dir} />}
        </button>
      </th>
      <th style={{ minWidth: 440 }}>
        <button className="thbtn" onClick={() => onClickSort("checklist")}>
          Checklist {sort.key === "checklist" && <SortChevron dir={sort.dir} />}
        </button>
      </th>
      <th style={{ minWidth: 300 }}>
        <button className="thbtn" onClick={() => onClickSort("notes")}>
          Notes {sort.key === "notes" && <SortChevron dir={sort.dir} />}
        </button>
      </th>
      <th style={{ minWidth: 90 }}>
        <button className="thbtn" onClick={() => onClickSort("stage")}>
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

function CarRows({
  list,
  showPhotos,
  editTarget,
  editData,
  photoCache,
  activeRef,
  rememberCaret,
  handleChange,
  saveChanges,
  setEditTarget,
  startEdit,
  openNextModal,
  openChecklistModal,
  setSelectedCar,
  setProfileOpen,
  handleDelete,
  stageDirtyRef,
  carString,
}) {
  const visibleCols = 7 + (showPhotos ? 1 : 0);

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
          const isEditingCar = editTarget.id === car._id && editTarget.field === "car";
          const isEditingLoc = editTarget.id === car._id && editTarget.field === "location";
          const isEditingNotes = editTarget.id === car._id && editTarget.field === "notes";
          const isEditingStage = editTarget.id === car._id && editTarget.field === "stage";

          const thumbUrl = photoCache[car._id];

          return (
            <tr
              key={car._id}
              data-id={car._id}
              className={`row ${isSold(car) ? "row--sold" : ""}`}
              ref={
                isEditingCar || isEditingLoc || isEditingNotes || isEditingStage
                  ? (el) => {
                      activeRef.current = el;
                    }
                  : null
              }
            >
              {/* PHOTO cell (optional) */}
              {showPhotos && (
                <td
                  className="photo-cell"
                  onClick={() => {
                    setSelectedCar(car);
                    setProfileOpen(true);
                  }}
                >
                  <div className="photo-box">
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={carString(car) || car.rego || "Car photo"}
                      />
                    ) : (
                      <div className="thumb-empty" />
                    )}
                  </div>
                </td>
              )}

              {/* CAR cell */}
              <td
                onDoubleClick={() => !isEditingCar && startEdit(car, "car", "make")}
                className={isEditingCar ? "is-editing" : ""}
              >
                {isEditingCar ? (
                  <div className="car-edit">
                    <div className="car-edit-grid">
                      <label className="car-edit-field">
                        <span className="car-edit-label">Make</span>
                        <input
                          className="input input--compact"
                          name="make"
                          value={editData.make}
                          onChange={handleChange}
                          onKeyUp={rememberCaret}
                          onClick={rememberCaret}
                          placeholder="Make"
                        />
                      </label>

                      <label className="car-edit-field">
                        <span className="car-edit-label">Model</span>
                        <input
                          className="input input--compact"
                          name="model"
                          value={editData.model}
                          onChange={handleChange}
                          onKeyUp={rememberCaret}
                          onClick={rememberCaret}
                          placeholder="Model"
                        />
                      </label>

                      <label className="car-edit-field">
                        <span className="car-edit-label">Badge</span>
                        <input
                          className="input input--compact"
                          name="badge"
                          value={editData.badge}
                          maxLength={4}
                          onChange={handleChange}
                          onKeyUp={rememberCaret}
                          onClick={rememberCaret}
                          placeholder="GLX…"
                        />
                      </label>

                      <label className="car-edit-field">
                        <span className="car-edit-label">Year</span>
                        <input
                          className="input input--compact"
                          name="year"
                          value={editData.year}
                          onChange={handleChange}
                          onKeyUp={rememberCaret}
                          onClick={rememberCaret}
                          placeholder="2014"
                        />
                      </label>

                      <label className="car-edit-field car-edit-rego">
                        <span className="car-edit-label">Description</span>
                        <input
                          className="input input--compact"
                          name="description"
                          value={editData.description}
                          onChange={handleChange}
                          onKeyUp={rememberCaret}
                          onClick={rememberCaret}
                          placeholder="Colour / body / extra info"
                        />
                      </label>

                      <label className="car-edit-field car-edit-rego">
                        <span className="car-edit-label">Rego</span>
                        <input
                          className="input input--compact"
                          name="rego"
                          value={editData.rego}
                          onChange={handleChange}
                          onKeyUp={rememberCaret}
                          onClick={rememberCaret}
                          placeholder="1AT8QG"
                          style={{ textTransform: "uppercase" }}
                        />
                      </label>
                    </div>

                    <div className="edit-actions">
                      <button className="btn btn--primary" onClick={saveChanges}>
                        Save
                      </button>
                      <button
                        className="btn"
                        onClick={() => setEditTarget({ id: null, field: null })}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <Cell>{carString(car) || "-"}</Cell>
                )}
              </td>

              {/* LOCATION */}
              <td
                onDoubleClick={() => !isEditingLoc && startEdit(car, "location", "location")}
                className={isEditingLoc ? "is-editing" : ""}
              >
                {isEditingLoc ? (
                  <div className="edit-cell">
                    <input
                      className="input input--compact input--wide-inline"
                      name="location"
                      value={editData.location}
                      onChange={handleChange}
                      onKeyUp={rememberCaret}
                      onClick={rememberCaret}
                      placeholder="Location"
                    />
                    <div className="edit-actions">
                      <button className="btn btn--primary" onClick={saveChanges}>
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <Cell>
                    {car.location
                      ? (() => {
                          const d = daysAtCurrentLocation(car);
                          return d ? `${car.location} (${d})` : car.location;
                        })()
                      : "-"}
                  </Cell>
                )}
              </td>

              {/* NEXT (open modal) */}
              <td onDoubleClick={() => openNextModal(car)}>
                <Cell>
                  {Array.isArray(car.nextLocations) && car.nextLocations.length
                    ? car.nextLocations.join(", ")
                    : car.nextLocation || "-"}
                </Cell>
              </td>

              {/* CHECKLIST (open modal) */}
              <td onClick={() => openChecklistModal(car)} onDoubleClick={() => openChecklistModal(car)}>
                <Cell title={Array.isArray(car.checklist) ? car.checklist.join(", ") : ""}>
                  {car.checklist && car.checklist.length > 0 ? car.checklist.join(", ") : "-"}
                </Cell>
              </td>

              {/* NOTES */}
              <td
                onDoubleClick={() => !isEditingNotes && startEdit(car, "notes", "notes")}
                className={isEditingNotes ? "is-editing" : ""}
              >
                {isEditingNotes ? (
                  <div className="edit-cell">
                    <input
                      className="input input--compact"
                      name="notes"
                      value={editData.notes}
                      onChange={handleChange}
                      onKeyUp={rememberCaret}
                      onClick={rememberCaret}
                      placeholder="Short notes"
                    />
                    <div className="edit-actions">
                      <button className="btn btn--primary" onClick={saveChanges}>
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <Cell>{car.notes || "-"}</Cell>
                )}
              </td>

              {/* STAGE (select, save on blur / outside click) */}
              <td
                onDoubleClick={() => !isEditingStage && startEdit(car, "stage", "stage")}
                className={isEditingStage ? "is-editing" : ""}
              >
                {isEditingStage ? (
                  <div className="edit-cell">
                    <select
                      className="input input--compact input--select-lg"
                      name="stage"
                      value={editData.stage}
                      onChange={(e) => {
                        // parent owns editData via handler
                        handleChange({
                          target: { name: "stage", value: e.target.value },
                        });
                        stageDirtyRef.current = true;
                      }}
                      onBlur={() => {
                        if (stageDirtyRef.current) {
                          saveChanges();
                        } else {
                          setEditTarget({ id: null, field: null });
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                    >
                      {STAGES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <Cell>{car.stage || "-"}</Cell>
                )}
              </td>

              {/* ACTIONS */}
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
}

function CarTable({
  list,
  showPhotos,
  sort,
  onClickSort,
  editTarget,
  editData,
  photoCache,
  activeRef,
  rememberCaret,
  handleChange,
  saveChanges,
  setEditTarget,
  startEdit,
  openNextModal,
  openChecklistModal,
  setSelectedCar,
  setProfileOpen,
  handleDelete,
  stageDirtyRef,
  carString,
}) {
  // ✅ drag-to-scroll (same logic as CarListSplit)
  const wrapRef = useRef(null);
  const dragRef = useRef({
    tracking: false,
    active: false,
    startX: 0,
    scrollLeft: 0,
    pointerId: null,
    justDragged: false,
  });
  const [dragging, setDragging] = useState(false);

  const isFormElement = (el) => {
    if (!el) return false;
    const tag = el.tagName;
    if (!tag) return false;
    const t = tag.toUpperCase();
    if (["INPUT", "TEXTAREA", "SELECT", "BUTTON", "OPTION", "LABEL"].includes(t)) return true;
    if (el.closest(".is-editing")) return true;
    return false;
  };

  const onPointerDown = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const el = wrapRef.current;
    if (!el) return;
    if (isFormElement(e.target)) return;

    dragRef.current = {
      tracking: true,
      active: false,
      startX: e.clientX,
      scrollLeft: el.scrollLeft,
      pointerId: e.pointerId,
      justDragged: false,
    };
  };

  const onPointerMove = (e) => {
    const st = dragRef.current;
    if (!st.tracking) return;
    const el = wrapRef.current;
    if (!el) return;

    const dx = e.clientX - st.startX;

    if (!st.active) {
      if (Math.abs(dx) > 5) {
        st.active = true;
        setDragging(true);
        try {
          el.setPointerCapture(st.pointerId);
        } catch {
          // ignore
        }
      } else {
        return;
      }
    }

    el.scrollLeft = st.scrollLeft - dx;
  };

  const endDrag = () => {
    const st = dragRef.current;
    if (!st.tracking) return;

    const el = wrapRef.current;
    const wasActive = st.active;

    st.tracking = false;
    st.active = false;
    setDragging(false);

    if (el && st.pointerId != null) {
      try {
        if (el.hasPointerCapture(st.pointerId)) {
          el.releasePointerCapture(st.pointerId);
        }
      } catch {
        // ignore
      }
    }

    st.justDragged = !!wasActive;
  };

  const onClickCapture = (e) => {
    if (dragRef.current.justDragged) {
      e.stopPropagation();
      e.preventDefault();
      dragRef.current.justDragged = false;
    }
  };

  return (
    <div
      className={"table-wrap" + (dragging ? " is-dragging" : "")}
      ref={wrapRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      onClickCapture={onClickCapture}
    >
      <style>{`
        .table-wrap{position:relative; overflow-x:auto; overflow-y:hidden; -webkit-overflow-scrolling:touch;}
        .table-wrap{ cursor: grab; }
        .table-wrap.is-dragging{ cursor: grabbing; }

        .car-table{width:100%;table-layout:fixed;border-collapse:separate;border-spacing:0; min-width:1150px;}
        .car-table th,.car-table td{padding:4px 10px;vertical-align:middle;}

        /* narrower photo col */
        .car-table col.col-photo{width:70px;}
        .car-table col.col-car{width:370px;}
        .car-table col.col-loc{width:140px;}
        .car-table col.col-next{width:220px;}
        .car-table col.col-chk{width:440px;}
        .car-table col.col-notes{width:300px;}
        .car-table col.col-stage{width:90px;}
        .car-table col.col-act{width:90px;}

        .car-table .cell{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;}
        .thbtn{all:unset;cursor:pointer;color:#cbd5e1;padding:4px 6px;border-radius:6px;}
        .thbtn:hover{background:#1f2937;}

        td.is-editing{
          background:#0c1a2e;
          box-shadow: inset 0 0 0 1px #2b3b54;
          border-radius:8px;
        }
        .edit-cell{ display:flex; align-items:center; gap:8px; }
        .edit-actions{ display:flex; gap:8px; margin-top:4px; }

        td.is-editing .input--wide-inline{
          width:auto;
          min-width:260px;
          max-width:min(640px, 70vw);
        }

        .car-edit{
          display:flex;
          flex-direction:column;
          gap:8px;
          max-width:720px;
        }
        .car-edit-grid{
          display:grid;
          grid-template-columns:repeat(2, minmax(0, 1fr));
          gap:8px 12px;
        }
        .car-edit-field{
          display:flex;
          flex-direction:column;
          gap:3px;
          font-size:12px;
        }
        .car-edit-label{
          color:#9CA3AF;
          font-size:11px;
          text-transform:uppercase;
          letter-spacing:0.04em;
        }
        .car-edit-rego{
          grid-column:1 / -1;
        }
        .car-edit-field .input{
          width:100%;
        }
        @media (max-width: 900px){
          .car-edit-grid{
            grid-template-columns:1fr;
          }
        }

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
        .car-table tr.row--sold:hover td{ background: var(--sold-bg-hover); }

        .photo-cell{
          padding-left:4px;
          padding-right:4px;
          text-align:center;
        }

        /* smaller thumbnail = shorter row */
        .photo-box{
          width:56px;
          height:40px;
          border-radius:6px;
          overflow:hidden;
          background:#111827;
          margin:0 auto;
          display:flex;
          align-items:center;
          justify-content:center;
        }
        .photo-box img{
          width:100%;
          height:100%;
          object-fit:cover;
          display:block;
          cursor:pointer;
        }
        .thumb-empty{
          width:100%;
          height:100%;
          background:#1E293B;
        }
      `}</style>

      <table className="car-table">
        <colgroup>
          {showPhotos && <col className="col-photo" />}
          <col className="col-car" />
          <col className="col-loc" />
          <col className="col-next" />
          <col className="col-chk" />
          <col className="col-notes" />
          <col className="col-stage" />
          <col className="col-act" />
        </colgroup>

        <TableHeader showPhotos={showPhotos} sort={sort} onClickSort={onClickSort} />

        <CarRows
          list={list}
          showPhotos={showPhotos}
          editTarget={editTarget}
          editData={editData}
          photoCache={photoCache}
          activeRef={activeRef}
          rememberCaret={rememberCaret}
          handleChange={handleChange}
          saveChanges={saveChanges}
          setEditTarget={setEditTarget}
          startEdit={startEdit}
          openNextModal={openNextModal}
          openChecklistModal={openChecklistModal}
          setSelectedCar={setSelectedCar}
          setProfileOpen={setProfileOpen}
          handleDelete={handleDelete}
          stageDirtyRef={stageDirtyRef}
          carString={carString}
        />
      </table>
    </div>
  );
}

export default function CarListRegular() {
  const [view, setView] = useState("regular");
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState(null);

  const [showForm, setShowForm] = useState(false);

  // toggle for photo column (shared Regular + embedded Split)
  const [showPhotos, setShowPhotos] = useState(false);

  // ---------- EDITING (per-cell) ----------
  // editTarget.field: "car" | "location" | "next" | "checklist" | "notes" | "stage"
  const [editTarget, setEditTarget] = useState({ id: null, field: null });
  const [editData, setEditData] = useState({});
  const savingRef = useRef(false);

  // caret restore
  const activeRef = useRef(null);
  const caretRef = useRef({ name: null, start: null, end: null });

  // track if Stage changed to decide whether to save on blur/outside click
  const stageDirtyRef = useRef(false);

  // modals
  const [checklistModal, setChecklistModal] = useState({ open: false, car: null });
  const [nextModal, setNextModal] = useState({ open: false, car: null });
  const openNextModal = (car) => setNextModal({ open: true, car });
  const closeNextModal = () => setNextModal({ open: false, car: null });
  const openChecklistModal = (car) => setChecklistModal({ open: true, car });
  const closeChecklistModal = () => setChecklistModal({ open: false, car: null });

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

  // Photo cache for thumbnail column
  const [photoCache, setPhotoCache] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/cars", {
          headers: { "Cache-Control": "no-cache" },
        });
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
      const res = await api.get("/cars", {
        headers: { "Cache-Control": "no-cache" },
      });
      const data = (res.data?.data || []).map((c, idx) => ({ ...c, __idx: idx }));
      setCars(data);
    } catch (err) {
      setErrMsg(err.response?.data?.message || err.message || "Error fetching cars");
    }
  }, []);

  const handleSave = refreshCars;

  // Lazy fetch photo preview (first photo)
  const fetchPhoto = useCallback(
    async (car) => {
      if (!car?._id) return;
      if (photoCache[car._id]) return; // already have one
      try {
        const res = await api.get(`/cars/${car._id}/photo-preview`);
        const url = res?.data?.data || "";
        if (url) {
          setPhotoCache((prev) => (prev[car._id] ? prev : { ...prev, [car._id]: url }));
        }
      } catch (e) {
        console.warn(`❌ Error loading photo for ${car.rego}`, e);
      }
    },
    [photoCache]
  );

  // Prefetch thumbnails for cars that have photos
  useEffect(() => {
    if (!showPhotos) return; // only bother when visible
    cars.forEach((car) => {
      if (car?.photos?.length && !photoCache[car._id]) {
        fetchPhoto(car);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cars, showPhotos]);

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

  // ---------- Edit helpers ----------
  const startEdit = (car, field, initialNameForCaret = null) => {
    setEditTarget({ id: car._id, field });

    const lastNext =
      Array.isArray(car.nextLocations) && car.nextLocations.length
        ? car.nextLocations[car.nextLocations.length - 1]
        : car.nextLocation ?? "";

    const base = {
      _id: car._id,
      make: car.make ?? "",
      model: car.model ?? "",
      badge: (car.badge ?? "").slice(0, 4),
      rego: car.rego ?? "",
      year: car.year ?? "",
      description: car.description ?? "",
      notes: car.notes ?? "",
      checklist: Array.isArray(car.checklist) ? car.checklist.join(", ") : car.checklist ?? "",
      location: car.location ?? "",
      nextLocation: lastNext || "",
      stage: car.stage ?? "In Works",
    };
    setEditData(base);

    // For stage, don't auto-focus (and now table won't remount, so no scroll reset)
    if (field === "stage") {
      stageDirtyRef.current = false;
      caretRef.current = { name: null, start: null, end: null };
      return;
    }

    caretRef.current = { name: initialNameForCaret, start: null, end: null };

    requestAnimationFrame(() => {
      const root = activeRef.current;
      if (!root) return;
      const preferred =
        initialNameForCaret &&
        root.querySelector(`[name="${CSS.escape(initialNameForCaret)}"]`);
      const el = preferred || root.querySelector("input, textarea, select");
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
    // allow synthetic calls from stage dropdown in table rows
    const { name, value } = e?.target || {};
    if (!name) return;

    // only remember caret for real DOM inputs
    if (e?.target?.selectionStart != null || e?.target?.selectionEnd != null) {
      rememberCaret(e);
    }

    if (name === "year")
      return setEditData((p) => ({
        ...p,
        year: String(value ?? "").replace(/[^\d]/g, ""),
      }));

    if (name === "rego") {
      const clean = String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      return setEditData((p) => ({ ...p, rego: clean }));
    }

    if (name === "badge")
      return setEditData((p) => ({ ...p, badge: String(value ?? "").slice(0, 4) }));

    setEditData((p) => ({ ...p, [name]: value }));
  };

  const handleDelete = async (carId) => {
    if (!window.confirm("Are you sure you want to delete this car?")) return;
    try {
      await api.delete(`/cars/${encodeURIComponent(carId)}`);
      // Optimistic UI
      setCars((prev) => prev.filter((c) => c._id !== carId));
      await refreshCars();
      alert("Car deleted successfully!");
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || err?.message || "Error deleting car";
      if (status === 404) {
        alert("Car not found (it may already be deleted). Refreshing list.");
        await refreshCars();
      } else if (status === 401) {
        alert("Not authorized. Please log in again.");
      } else {
        alert(`Error deleting car: ${msg}`);
      }
    }
  };

  const saveChanges = async () => {
    if (!editTarget.id || savingRef.current) return;
    savingRef.current = true;
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

      if (res.data?.data) {
        setCars((prev) =>
          prev.map((c) => (c._id === editTarget.id ? { ...res.data.data, __idx: c.__idx } : c))
        );
      } else {
        await refreshCars();
      }
      setEditTarget({ id: null, field: null });
    } catch (err) {
      console.error("Update failed", err.response?.data || err.message);
      alert("Error updating car: " + (err.response?.data?.message || err.message));
      await refreshCars();
      setEditTarget({ id: null, field: null });
    } finally {
      savingRef.current = false;
    }
  };

  // click outside to save (for any field, including Stage)
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

  useLayoutEffect(() => {
    if (!editTarget.id || editTarget.field === "stage") return; // skip stage to avoid scroll jump
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

  const filteredSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = cars;

    list = stageFilter.size > 0 ? list.filter((car) => stageFilter.has(car?.stage ?? "")) : [];

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
            Array.isArray(a.nextLocations) && a.nextLocations.length
              ? a.nextLocations.join(", ")
              : a.nextLocation,
            Array.isArray(b.nextLocations) && b.nextLocations.length
              ? b.nextLocations.join(", ")
              : b.nextLocation,
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

  const clickSort = (key) =>
    setSort((prev) => ({
      key,
      dir: prev.key === key ? nextDir(prev.dir) : "desc",
    }));

  // SPLIT view (embedded)
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

            <button className="btn btn--muted btn--sm" onClick={triggerCsvSplit} disabled={uploading}>
              {uploading ? "Uploading…" : "Upload CSV"}
            </button>
            <input
              ref={fileInputRefSplit}
              type="file"
              accept=".csv,text/csv"
              style={{ display: "none" }}
              onChange={handleCsvChosen}
            />

            <button className="btn btn--muted btn--sm" onClick={() => setPasteOpen(true)}>
              Paste Online List
            </button>

            {/* INLINE Show/Hide Photos toggle */}
            <button className="btn btn--muted btn--sm" onClick={() => setShowPhotos((v) => !v)}>
              {showPhotos ? "Hide Photos" : "Show Photos"}
            </button>
          </div>
        </div>

        <CarListSplit
          embedded
          listOverride={soldFirstList}
          sortState={sort}
          onSortChange={setSort}
          showPhotos={showPhotos}
        />

        <style>{stageChipCss}</style>

        {showForm && (
          <CarFormModal
            show={showForm}
            onClose={() => setShowForm(false)}
            onSave={handleSave}
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

          <button className="btn btn--muted btn--sm" onClick={triggerCsvRegular} disabled={uploading}>
            {uploading ? "Uploading…" : "Upload CSV"}
          </button>
          <input
            ref={fileInputRefRegular}
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            onChange={handleCsvChosen}
          />

          <button className="btn btn--muted btn--sm" onClick={() => setPasteOpen(true)}>
            Paste Online List
          </button>

          {/* INLINE Show/Hide Photos toggle */}
          <button className="btn btn--muted btn--sm" onClick={() => setShowPhotos((v) => !v)}>
            {showPhotos ? "Hide Photos" : "Show Photos"}
          </button>
        </div>
      </div>

      <style>{stageChipCss}</style>

      {errMsg && <div className="alert alert--error">{errMsg}</div>}

      <CarTable
        list={soldFirstList}
        showPhotos={showPhotos}
        sort={sort}
        onClickSort={clickSort}
        editTarget={editTarget}
        editData={editData}
        photoCache={photoCache}
        activeRef={activeRef}
        rememberCaret={rememberCaret}
        handleChange={handleChange}
        saveChanges={saveChanges}
        setEditTarget={setEditTarget}
        startEdit={startEdit}
        openNextModal={openNextModal}
        openChecklistModal={openChecklistModal}
        setSelectedCar={setSelectedCar}
        setProfileOpen={setProfileOpen}
        handleDelete={handleDelete}
        stageDirtyRef={stageDirtyRef}
        carString={carString}
      />

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
          onSave={async (items) => {
            try {
              await api.put(
                `/cars/${nextModal.car._id}`,
                { nextLocations: items, nextLocation: items[items.length - 1] ?? "" },
                { headers: { "Content-Type": "application/json" } }
              );
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
                : nextModal.car.nextLocation
                ? [nextModal.car.nextLocation]
                : [];
              const remaining = existing.filter((s) => s !== loc);
              await api.put(
                `/cars/${nextModal.car._id}`,
                { location: loc, nextLocations: remaining, nextLocation: remaining[remaining.length - 1] ?? "" },
                { headers: { "Content-Type": "application/json" } }
              );
              await refreshCars();
            } catch (e) {
              alert(e.response?.data?.message || e.message || "Error setting current location");
            }
          }}
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
