// src/components/Car/CarListSplit.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import api from "../../lib/api";
// import CarFormModal from "./CarFormModal"; // unused
import CarProfileModal from "./CarProfileModal";
import ChecklistFormModal from "./ChecklistFormModal";
import NextLocationsFormModal from "./NextLocationsFormModal";
import "./CarList.css";

const STAGES = ["In Works", "In Works/Online", "Online", "Sold"];
const isSold = (car = {}) => String(car.stage || "").trim().toLowerCase() === "sold";

/* icons */
const TrashIcon = ({ size = 16 }) => (
  <svg className="icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
    <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const carString = (car) => {
  const head = [car.make, car.model].filter(Boolean).join(" ").trim();
  const tail = [];
  if (car.badge) tail.push(car.badge);
  if (car.year) tail.push(car.year);
  if (car.description) tail.push(car.description);
  if (car.rego) tail.push(car.rego);
  return [head, tail.join(", ")].filter(Boolean).join(", ");
};

/** simple mobile detection without extra deps */
function useIsMobile(breakpoint = 900) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= breakpoint : false
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return isMobile;
}

export default function CarListSplit({ listOverride }) {
  const [cars, setCars] = useState([]);
  const [_loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedCar, setSelectedCar] = useState(null);
  const [checklistModal, setChecklistModal] = useState({ open: false, car: null });
  const [nextModal, setNextModal] = useState({ open: false, car: null });

  const [editTarget, setEditTarget] = useState({ id: null, field: null });
  const [editData, setEditData] = useState({});
  const savingRef = useRef(false);

  const isMobile = useIsMobile(900);

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
      } catch (error) {
        setErrMsg(error.response?.data?.message || error.message || "Error fetching cars");
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
    } catch (error) {
      setErrMsg(error.response?.data?.message || error.message || "Error fetching cars");
    }
  };

  const handleDelete = async (carId) => {
    if (!window.confirm("Delete this car?")) return;
    try {
      await api.delete(`/cars/${carId}`);
      await refreshCars();
    } catch (error) {
      alert("Delete failed: " + (error.response?.data?.message || error.message));
    }
  };

  const startEdit = (car, field) => {
    setEditTarget({ id: car._id, field });
    setEditData({
      make: car.make ?? "",
      model: car.model ?? "",
      badge: car.badge ?? "",
      rego: car.rego ?? "",
      year: car.year ?? "",
      description: car.description ?? "",
      location: car.location ?? "",
      notes: car.notes ?? "",
      stage: car.stage ?? "In Works",
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditData((p) => ({ ...p, [name]: value }));
  };

  const saveChanges = async () => {
    if (!editTarget.id || savingRef.current) return;
    savingRef.current = true;
    try {
      await api.put(`/cars/${editTarget.id}`, editData);
      await refreshCars();
      setEditTarget({ id: null, field: null });
    } catch (error) {
      alert("Update failed: " + (error.response?.data?.message || error.message));
    } finally {
      savingRef.current = false;
    }
  };

  const ordered = useMemo(() => {
    const sold = [], other = [];
    for (const c of cars) (isSold(c) ? sold : other).push(c);
    return [...sold, ...other];
  }, [cars]);

  const mid = Math.ceil(ordered.length / 2);
  const leftList = ordered.slice(0, mid);
  const rightList = ordered.slice(mid);

  if (_loading) {
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

      {isMobile ? (
        <div className="table-wrap">
          <Table
            list={ordered}
            editTarget={editTarget}
            editData={editData}
            startEdit={startEdit}
            handleChange={handleChange}
            saveChanges={saveChanges}
            setProfileOpen={setProfileOpen}
            setSelectedCar={setSelectedCar}
            setChecklistModal={setChecklistModal}
            setNextModal={setNextModal}
            handleDelete={handleDelete}
            isMobile
          />
        </div>
      ) : (
        <div className="split-grid">
          <Table
            list={leftList}
            editTarget={editTarget}
            editData={editData}
            startEdit={startEdit}
            handleChange={handleChange}
            saveChanges={saveChanges}
            setProfileOpen={setProfileOpen}
            setSelectedCar={setSelectedCar}
            setChecklistModal={setChecklistModal}
            setNextModal={setNextModal}
            handleDelete={handleDelete}
          />
          <Table
            list={rightList}
            editTarget={editTarget}
            editData={editData}
            startEdit={startEdit}
            handleChange={handleChange}
            saveChanges={saveChanges}
            setProfileOpen={setProfileOpen}
            setSelectedCar={setSelectedCar}
            setChecklistModal={setChecklistModal}
            setNextModal={setNextModal}
            handleDelete={handleDelete}
          />
        </div>
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
              await api.put(`/cars/${checklistModal.car._id}`, { checklist: items });
              await refreshCars();
            } catch (error) {
              alert(error.message);
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
          items={Array.isArray(nextModal.car?.nextLocations)
            ? nextModal.car.nextLocations
            : nextModal.car?.nextLocation
            ? [nextModal.car.nextLocation]
            : []}
          onSave={async (items) => {
            try {
              await api.put(`/cars/${nextModal.car._id}`, {
                nextLocations: items,
                nextLocation: items[items.length - 1] ?? "",
              });
              await refreshCars();
            } catch (error) {
              alert(error.message);
            } finally {
              setNextModal({ open: false, car: null });
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
  editData,
  startEdit,
  handleChange,
  saveChanges,
  setProfileOpen,
  setSelectedCar,
  setChecklistModal,
  setNextModal,
  handleDelete,
  isMobile = false,
}) {
  return (
    <div className="table-wrap">
      <table className={`car-table ${isMobile ? "car-table--mobile" : ""}`}>
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
              return (
                <tr key={car._id} className={isSold(car) ? "row--sold" : ""}>
                  <td onDoubleClick={() => startEdit(car, "car")}>
                    {editing === "car" ? (
                      <div className="inline-edit">
                        <input name="make" value={editData.make} onChange={handleChange} placeholder="Make" />
                        <input name="model" value={editData.model} onChange={handleChange} placeholder="Model" />
                        <button className="btn btn--xs btn--primary" onClick={saveChanges}>Save</button>
                      </div>
                    ) : (
                      carString(car) || "-"
                    )}
                  </td>
                  <td className="cell">{car.location || "-"}</td>
                  <td className="cell" onDoubleClick={() => setNextModal({ open: true, car })}>
                    {car.nextLocation || "-"}
                  </td>
                  <td className="cell" onDoubleClick={() => setChecklistModal({ open: true, car })}>
                    {Array.isArray(car.checklist) && car.checklist.length
                      ? car.checklist.join(", ")
                      : "-"}
                  </td>
                  <td className="cell">{car.notes || "-"}</td>
                  <td className="cell">{car.stage || "-"}</td>
                  <td>
                    <div className="actions">
                      <button
                        className="btn btn--kebab btn--xs"
                        onClick={() => {
                          setSelectedCar(car);
                          setProfileOpen(true);
                        }}
                        aria-label="Open profile"
                        title="Open profile"
                      >
                        ⋯
                      </button>
                      <button className="btn btn--danger btn--xs" onClick={() => handleDelete(car._id)} title="Delete">
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

/* ---------- Styles ---------- */
const cssFix = `
.page-pad{padding:12px;}
/* DESKTOP: two-column split */
.split-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}

.table-wrap{overflow-x:auto;}
.car-table{width:100%;border-collapse:collapse;table-layout:fixed;}
.car-table th,.car-table td{padding:6px 8px;text-align:left;vertical-align:middle;}
.car-table th{color:#9ca3af;font-size:12px;font-weight:600;}
.cell{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.inline-edit{display:flex;gap:6px;align-items:center;}
.actions{display:flex;gap:6px;justify-content:center;}
.btn{border:none;border-radius:8px;padding:4px 8px;cursor:pointer;}
.btn--xs{padding:2px 6px;font-size:12px;}
.btn--primary{background:#2563eb;color:#fff;}
.btn--danger{background:#dc2626;color:#fff;}
.btn--kebab{background:#374151;color:#fff;}
.row--sold td{background:rgba(14,165,233,.12);}
.empty{text-align:center;color:#9ca3af;padding:10px;}

/* MOBILE: single list, dense spacing */
@media(max-width:900px){
  .split-grid{display:block;}
  .page-pad{padding:8px;}
  .car-table--mobile th,.car-table--mobile td{padding:6px 6px;font-size:13px;line-height:1.2;}
  .car-table--mobile th{font-size:11px;}
  .actions{gap:4px}
  .btn--xs{padding:2px 5px}
}
`;
