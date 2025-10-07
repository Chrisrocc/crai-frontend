// src/components/Home/CustomerAppointmentHome.jsx
// Uses central API client (src/lib/api.js) so it respects VITE_API_URL.

import { useEffect, useMemo, useRef, useState } from "react";
import api from "../../lib/api";
import CarPickerModal from "../CarPicker/CarPickerModal";
import { standardizeDayTime, dayTimeHighlightClass } from "../utils/dateTime";

export default function CustomerAppointmentsHome() {
  const [rows, setRows] = useState([]);
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [editRow, setEditRow] = useState(null);
  const [editData, setEditData] = useState({});
  const savingRef = useRef(false);

  const [carPicker, setCarPicker] = useState({ open: false, forId: null });

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [a, c] = await Promise.all([
          api.get("/customer-appointments", { headers: { "Cache-Control": "no-cache" } }),
          api.get("/cars", { headers: { "Cache-Control": "no-cache" } }),
        ]);
        if (!alive) return;
        setCars(Array.isArray(c.data?.data) ? c.data.data : []);
        setRows(Array.isArray(a.data?.data) ? a.data.data : []);
      } catch (e) {
        if (!alive) return;
        setErr(e.response?.data?.message || e.message || "Failed to load");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const refresh = async () => {
    const res = await api.get("/customer-appointments", { headers: { "Cache-Control": "no-cache" } });
    setRows(Array.isArray(res.data?.data) ? res.data.data : []);
  };

  const formatWhen = (raw) => {
    const { date, label } = standardizeDayTime(raw);
    if (!date) return label || (raw || "—");
    const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()];
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mi = String(date.getMinutes()).padStart(2, "0");
    const hasTime = !(date.getHours() === 0 && date.getMinutes() === 0);
    return hasTime ? `${wd} ${dd}/${mm} ${hh}:${mi}` : `${wd} ${dd}/${mm}`;
  };

  const isToday = (raw) => {
    const { date } = standardizeDayTime(raw);
    if (!date) return false;
    const n = new Date();
    return date.getFullYear() === n.getFullYear() && date.getMonth() === n.getMonth() && date.getDate() === n.getDate();
  };
  const isTomorrow = (raw) => {
    const { date } = standardizeDayTime(raw);
    if (!date) return false;
    const n = new Date();
    const t = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
    return date.getFullYear() === t.getFullYear() && date.getMonth() === t.getMonth() && date.getDate() === t.getDate();
  };

  const filtered = useMemo(
    () => rows.filter((r) => isToday(r.dateTime || r.dayTime) || isTomorrow(r.dateTime || r.dayTime)),
    [rows]
  );

  const ordered = useMemo(() => {
    return filtered.slice().sort((a, b) => {
      const A = standardizeDayTime(a.dateTime || a.dayTime).date?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const B = standardizeDayTime(b.dateTime || b.dayTime).date?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return A - B;
    });
  }, [filtered]);

  const renderCarCell = (a) => {
    if (a.car) return `${a.car.rego} • ${a.car.make} ${a.car.model}`;
    if (a.carText) return a.carText;
    return "—";
  };

  const carLabelFromId = (id) => {
    const c = cars.find((x) => x._id === id);
    return c ? `${c.rego} • ${c.make} ${c.model}` : "";
  };

  const enterEdit = (a) => {
    setEditRow(a._id);
    setEditData({
      _id: a._id,
      name: a.name ?? "",
      dateTime: a.dateTime ?? "",
      notes: a.notes ?? "",
      car: a.car?._id || "",
    });
  };
  const handleChange = (e) => setEditData((p) => ({ ...p, [e.target.name]: e.target.value }));

  const openCarPicker = (a) => {
    if (editRow !== a._id) enterEdit(a);
    setCarPicker({ open: true, forId: a._id });
  };
  const onCarPicked = (carOrNull) => {
    setEditData((prev) => ({ ...prev, car: carOrNull?._id || "" }));
    setCarPicker({ open: false, forId: null });
  };

  const saveChanges = async () => {
    if (!editRow || savingRef.current) return;
    savingRef.current = true;
    try {
      const payload = {
        name: (editData.name ?? "").trim(),
        dateTime: (editData.dateTime ?? "").trim(),
        notes: editData.notes ?? "",
      };
      if (editData.car) payload.car = editData.car;
      payload.dayTime = payload.dateTime;

      setRows((prev) => prev.map((a) => (a._id === editRow ? { ...a, ...payload, car: a.car } : a)));

      const res = await api.put(`/customer-appointments/${editRow}`, payload, {
        headers: { "Content-Type": "application/json" },
      });

      if (res.data?.data) {
        setRows((prev) => prev.map((a) => (a._id === editRow ? res.data.data : a)));
      } else {
        await refresh();
      }
      setEditRow(null);
    } catch (e) {
      alert("Error updating: " + (e.response?.data?.message || e.message));
      await refresh();
    } finally {
      savingRef.current = false;
    }
  };

  const handleDelete = async (a) => {
    if (!window.confirm("Delete this entry?")) return;
    await api.delete(`/customer-appointments/${a._id}`);
    await refresh();
  };

  const moveToDelivery = async (a) => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      const payload = { isDelivery: true, originalDateTime: a.dateTime || "", dateTime: "TBC" };
      await api.put(`/customer-appointments/${a._id}`, payload, { headers: { "Content-Type": "application/json" } });
      await refresh();
    } catch (e) {
      alert("Error moving to Delivery: " + (e.response?.data?.message || e.message));
    } finally {
      savingRef.current = false;
    }
  };

  const undoDelivery = async (a) => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      const payload = { isDelivery: false, dateTime: a.originalDateTime || "", originalDateTime: "" };
      await api.put(`/customer-appointments/${a._id}`, payload, { headers: { "Content-Type": "application/json" } });
      await refresh();
    } catch (e) {
      alert("Error undoing Delivery: " + (e.response?.data?.message || e.message));
    } finally {
      savingRef.current = false;
    }
  };

  useEffect(() => {
    const onDown = (e) => {
      if (!editRow) return;
      const rowEl = document.querySelector(`tr[data-id="${editRow}"]`);
      if (rowEl && !rowEl.contains(e.target)) saveChanges();
    };
    if (editRow) document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [editRow, editData]);

  return (
    <div className="cust-appt-wrap">
      <style>{css}</style>

      <CarPickerModal
        show={carPicker.open}
        cars={cars}
        onClose={() => setCarPicker({ open: false, forId: null })}
        onSelect={onCarPicked}
      />

      <div className="table-wrap" role="region" aria-label="Customer Appointments & Deliveries (Today & Tomorrow)">
        <table className="appt-table" role="grid">
          <colgroup>
            <col className="col-name" />
            <col className="col-daytime" />
            <col className="col-car" />
            <col className="col-notes" />
            <col className="col-type" />
            <col className="col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th>Name</th>
              <th>Day/Time</th>
              <th>Car</th>
              <th>Notes</th>
              <th>Type</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="6" className="empty">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && err && (
              <tr>
                <td colSpan="6" className="empty error">
                  {err}
                </td>
              </tr>
            )}
            {!loading && !err && ordered.length === 0 && (
              <tr>
                <td colSpan="6" className="empty">
                  No entries for today or tomorrow.
                </td>
              </tr>
            )}
            {!loading &&
              !err &&
              ordered.map((a) => {
                const isEditing = editRow === a._id;
                const rowCls = dayTimeHighlightClass(a.dateTime || a.dayTime);
                return (
                  <tr
                    key={a._id}
                    data-id={a._id}
                    className={rowCls}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      enterEdit(a);
                    }}
                  >
                    <td>
                      {isEditing ? (
                        <input name="name" value={editData.name} onChange={handleChange} className="cal-input" autoFocus />
                      ) : (
                        a.name || "—"
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          name="dateTime"
                          value={editData.dateTime}
                          onChange={handleChange}
                          className="cal-input"
                          placeholder="e.g. Mon 30/09 09:00"
                        />
                      ) : (
                        formatWhen(a.dateTime || a.dayTime || "")
                      )}
                    </td>
                    <td onDoubleClick={() => openCarPicker(a)} title="Double-click to pick a car">
                      {isEditing ? (
                        <div className="car-edit">
                          <input className="cal-input" value={carLabelFromId(editData.car)} readOnly placeholder="No Car" />
                          <button className="btn btn--ghost btn--sm" onClick={() => openCarPicker(a)}>
                            Pick
                          </button>
                        </div>
                      ) : (
                        renderCarCell(a)
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input name="notes" value={editData.notes} onChange={handleChange} className="cal-input" />
                      ) : (
                        a.notes || "—"
                      )}
                    </td>
                    <td>{a.isDelivery ? "Delivery" : "Appointment"}</td>
                    <td className="cal-actions">
                      {isEditing ? (
                        <>
                          <button className="btn btn--primary btn--sm" onClick={saveChanges}>
                            Save
                          </button>
                          <button className="btn btn--ghost btn--sm" onClick={() => setEditRow(null)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          {a.isDelivery ? (
                            <button className="btn btn--ghost btn--sm" onClick={() => undoDelivery(a)}>
                              Undo
                            </button>
                          ) : (
                            <button className="btn btn--primary btn--sm" onClick={() => moveToDelivery(a)}>
                              Delivery
                            </button>
                          )}
                          <button
                            className="btn btn--danger btn--sm btn--icon"
                            onClick={() => handleDelete(a)}
                            title="Delete"
                            aria-label="Delete appointment"
                          >
                            <TrashIcon />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* styles: ONLY the wrapper scrolls horizontally on mobile; table forces width */
const css = `
.cust-appt-wrap { width:100%; min-width:0; }

/* Bordered wrapper: this is the scroller */
.table-wrap{
  position:relative;
  border:1px solid #1F2937; border-radius:14px;
  background:#0F172A;
  overflow-x:auto;
  overflow-y:hidden;
  -webkit-overflow-scrolling:touch;
  padding-bottom:14px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.02), 0 10px 30px rgba(0,0,0,0.25);
  max-width:100%;
}

/* Table must be wider than phones so wrapper scrolls, not the page */
.appt-table{
  width:100%;
  border-collapse:separate; border-spacing:0; table-layout:fixed;
  min-width:720px;
}

/* Head + body */
.appt-table thead th{
  position:sticky; top:0; z-index:1;
  background:#0F172A;
  border-bottom:1px solid #1F2937;
  text-align:left; font-size:12px; color:#9CA3AF;
  padding:12px 12px;
}
.appt-table tbody td{
  padding:12px 12px; border-bottom:1px solid #1F2937;
  font-size:14px; color:#E5E7EB; vertical-align:middle;
  background: transparent; /* cells stay transparent so row highlight shows through */
}
/* Zebra and hover on <tr> so highlight covers full height */
.appt-table tbody tr:nth-child(odd) { background: rgba(255,255,255,0.01); }
.appt-table tbody tr:hover { background:#0B1428; }

/* Column sizing */
.col-name{ width:18%; } .col-daytime{ width:20%; } .col-car{ width:24%; } .col-notes{ width:24%; } .col-type{ width:8%; }
.col-actions{ width:160px; text-align:right; }

/* === FULL-ROW HIGHLIGHTS (covers Actions cell to the bottom) === */
.appt-table tbody tr.is-today{
  background:#10321a !important;
  box-shadow: inset 0 0 0 1px #1e3a23;
}
.appt-table tbody tr.is-tomorrow{
  background:#2a1f12 !important;
  box-shadow: inset 0 0 0 1px #3a2e1e;
}
/* ensure cells never repaint over the highlighted row */
.appt-table tbody tr.is-today > td,
.appt-table tbody tr.is-tomorrow > td{
  background: transparent !important;
}
/* Actions cell should never add a background */
.appt-table td.cal-actions { background: transparent; }

/* Inputs + buttons */
.cal-input{ width:100%; padding:8px 10px; border-radius:10px; border:1px solid #243041; background:#0B1220; color:#E5E7EB; outline:none; }
.cal-input:focus{ border-color:#2E4B8F; box-shadow:0 0 0 3px rgba(37,99,235,0.25); }
.cal-actions{ display:flex; align-items:center; justify-content:flex-end; gap:8px; white-space:nowrap; }

.btn{ border:1px solid transparent; border-radius:10px; padding:6px 10px; cursor:pointer; font-weight:600; }
.btn--primary{ background:#2563EB; color:#fff; } .btn--ghost{ background:#111827; color:#E5E7EB; border-color:#243041; } .btn--danger{ background:#DC2626; color:#fff; }
.btn--sm{ font-size:12px; }
.btn--icon{ padding:6px; width:32px; height:28px; display:inline-flex; align-items:center; justify-content:center; }

.car-edit{ display:flex; align-items:center; gap:8px; }
.empty{ text-align:center; color:#9CA3AF; padding:16px 10px; } .error{ color:#ef9a9a; }

/* Nice horizontal scrollbar (optional) */
.table-wrap::-webkit-scrollbar{ height:12px; }
.table-wrap::-webkit-scrollbar-track{ background:#0B1220; border-radius:10px; }
.table-wrap::-webkit-scrollbar-thumb{ background:#59637C; border:2px solid #0B1220; border-radius:10px; }
.table-wrap:hover::-webkit-scrollbar-thumb{ background:#7B88A6; }
`;
