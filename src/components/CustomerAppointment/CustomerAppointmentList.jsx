// src/components/CustomerAppointment/CustomerAppointmentList.jsx
import { useEffect, useRef, useState } from "react";
import api from "../../lib/api";
import CustomerAppointmentFormModal from "./CustomerAppointmentFormModal";
import CarPickerModal from "../CarPicker/CarPickerModal";
import HamburgerMenu from "../utils/HamburgerMenu";
import { standardizeDayTime, dayTimeHighlightClass } from "../utils/dateTime";

export default function CustomerAppointmentList() {
  const [appointments, setAppointments] = useState([]);
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);

  // Inline editing
  const [editRow, setEditRow] = useState(null);
  const [editData, setEditData] = useState({});

  // Car Picker modal
  const [carPicker, setCarPicker] = useState({ open: false, forId: null });

  const savingRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const [a, c] = await Promise.all([
          api.get("/customer-appointments", { headers: { "Cache-Control": "no-cache" } }),
          api.get("/cars", { headers: { "Cache-Control": "no-cache" } }),
        ]);
        setAppointments(a.data?.data || []);
        setCars(c.data?.data || []);
      } catch (e) {
        setError("Error fetching appointments: " + (e.response?.data?.message || e.message));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const refreshAppointments = async () => {
    const res = await api.get("/customer-appointments", { headers: { "Cache-Control": "no-cache" } });
    setAppointments(res.data?.data || []);
  };

  const enterEdit = (appointment) => {
    setEditRow(appointment._id);
    setEditData({
      _id: appointment._id,
      name: appointment.name ?? "",
      dateTime: appointment.dateTime ?? "",
      notes: appointment.notes ?? "",
      car: appointment.car?._id || "",
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this appointment?")) return;
    await api.delete(`/customer-appointments/${id}`);
    await refreshAppointments();
    alert("Appointment deleted successfully!");
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
      if (editData.car) payload.car = editData.car; // car _id
      payload.dayTime = payload.dateTime; // back-compat

      // optimistic
      setAppointments((prev) =>
        prev.map((a) =>
          a._id === editRow ? { ...a, name: payload.name, dateTime: payload.dateTime, notes: payload.notes } : a
        )
      );

      const res = await api.put(`/customer-appointments/${editRow}`, payload, {
        headers: { "Content-Type": "application/json" },
      });

      if (res.data?.data) {
        setAppointments((prev) => prev.map((a) => (a._id === editRow ? res.data.data : a)));
      } else {
        await refreshAppointments();
      }

      setEditRow(null);
      alert(res.data?.message || "Saved");
    } catch (e) {
      console.error("Save failed", e.response?.data || e.message);
      alert("Error updating appointment: " + (e.response?.data?.message || e.message));
      await refreshAppointments();
    } finally {
      savingRef.current = false;
    }
  };

  const moveToDelivery = async (appointment) => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      const payload = {
        isDelivery: true,
        originalDateTime: appointment.dateTime || "",
        dateTime: "TBC",
      };

      setAppointments((prev) => prev.map((a) => (a._id === appointment._id ? { ...a, ...payload } : a)));

      const res = await api.put(`/customer-appointments/${appointment._id}`, payload, {
        headers: { "Content-Type": "application/json" },
      });

      if (res.data?.data) {
        setAppointments((prev) => prev.map((a) => (a._id === appointment._id ? res.data.data : a)));
      } else {
        await refreshAppointments();
      }
    } catch (e) {
      console.error("Move to delivery failed", e.response?.data || e.message);
      alert("Error: " + (e.response?.data?.message || e.message));
      await refreshAppointments();
    } finally {
      savingRef.current = false;
    }
  };

  const undoDelivery = async (appointment) => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      const restoredTime = appointment.originalDateTime || "";
      const payload = { isDelivery: false, dateTime: restoredTime, originalDateTime: "" };

      setAppointments((prev) => prev.map((a) => (a._id === appointment._id ? { ...a, ...payload } : a)));

      const res = await api.put(`/customer-appointments/${appointment._id}`, payload, {
        headers: { "Content-Type": "application/json" },
      });

      if (res.data?.data) {
        setAppointments((prev) => prev.map((a) => (a._id === appointment._id ? res.data.data : a)));
      } else {
        await refreshAppointments();
      }
    } catch (e) {
      console.error("Undo delivery failed", e.response?.data || e.message);
      alert("Error: " + (e.response?.data?.message || e.message));
      await refreshAppointments();
    } finally {
      savingRef.current = false;
    }
  };

  // Car picker helpers
  const openCarPicker = (appointment) => {
    if (editRow !== appointment._id) enterEdit(appointment);
    setCarPicker({ open: true, forId: appointment._id });
  };
  const onCarPicked = (carOrNull) => {
    setEditData((prev) => ({ ...prev, car: carOrNull?._id || "" }));
    setCarPicker({ open: false, forId: null });
  };

  // Click-outside saves active row
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

  if (loading) {
    return (
      <div className="cal-wrap with-ham">
        <style>{css}</style>
        <HamburgerMenu />
        <div className="cal-loading">Loading…</div>
      </div>
    );
  }

  const fmtDateShort = (d) =>
    d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";

  const renderCarCell = (a) => {
    if (a.car) return `${a.car.rego} • ${a.car.make} ${a.car.model}`;
    if (a.carText) return a.carText;
    return "—";
  };

  const carLabelFromId = (id) => {
    const c = cars.find((x) => x._id === id);
    return c ? `${c.rego} • ${c.make} ${c.model}` : "";
  };

  const apptRows = appointments.filter((a) => !a.isDelivery);
  const deliveryRows = appointments.filter((a) => a.isDelivery);

  // Helper for Day/Time display
  const renderDayTime = (raw) => {
    const { label } = standardizeDayTime(raw);
    return label || (raw || "—");
  };

  // Helper to assign highlight class to rows
  const rowClassFor = (raw) => dayTimeHighlightClass(raw);

  return (
    <div className="cal-wrap with-ham">
      <style>{css}</style>

      <HamburgerMenu />

      <header className="cal-head">
        <div className="cal-head-titles">
          <h1>Appointments & Delivery</h1>
          <p className="cal-sub">Edit inline, move to Delivery, and keep everything up to date fast.</p>
        </div>
        <button className="btn btn--primary" onClick={() => setShowForm(true)}>+ New Appointment</button>
      </header>

      {error && <div className="cal-alert" role="alert">{error}</div>}

      <CustomerAppointmentFormModal
        show={showForm}
        onClose={() => setShowForm(false)}
        onSave={refreshAppointments}
        cars={cars}
      />

      {/* Car Picker modal (reusable) */}
      <CarPickerModal
        show={carPicker.open}
        cars={cars}
        onClose={() => setCarPicker({ open: false, forId: null })}
        onSelect={onCarPicked}
      />

      <main className="cal-grid">
        {/* LEFT: Appointments */}
        <section className="cal-panel" aria-label="Customer Appointments">
          <div className="cal-panel-head">
            <h2>Customer Appointments</h2>
            <p className="cal-sub">Double-click a row to edit. Double-click the car cell to pick a car.</p>
          </div>

          <div className="cal-table-scroll">
            <table className="cal-table" role="grid">
              <colgroup>
                <col className="col-name" />
                <col className="col-daytime" />
                <col className="col-car" />
                <col className="col-notes" />
                <col className="col-datecreated" />
                <col className="col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Day/Time</th>
                  <th>Car</th>
                  <th>Notes</th>
                  <th>Date Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {apptRows.length === 0 ? (
                  <tr><td colSpan="6" className="cal-empty">No appointments found.</td></tr>
                ) : (
                  apptRows.map((a) => {
                    const isEditing = editRow === a._id;
                    const rowCls = rowClassFor(a.dateTime);
                    return (
                      <tr
                        key={a._id}
                        data-id={a._id}
                        className={rowCls}
                        onDoubleClick={(e) => { e.stopPropagation(); enterEdit(a); }}
                      >
                        <td>
                          {isEditing ? (
                            <input name="name" value={editData.name} onChange={handleChange} className="cal-input" autoFocus />
                          ) : (a.name || "—")}
                        </td>
                        <td>
                          {isEditing ? (
                            <input
                              name="dateTime"
                              value={editData.dateTime}
                              onChange={handleChange}
                              className="cal-input"
                              placeholder="e.g. Thu 10:00"
                            />
                          ) : (
                            renderDayTime(a.dateTime)
                          )}
                        </td>
                        <td onDoubleClick={() => openCarPicker(a)} title="Double-click to pick a car">
                          {isEditing ? (
                            <div className="car-edit">
                              <input className="cal-input" value={carLabelFromId(editData.car)} readOnly placeholder="No Car" />
                              <button className="btn btn--ghost btn--sm" onClick={() => openCarPicker(a)}>Pick</button>
                            </div>
                          ) : (
                            renderCarCell(a)
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input name="notes" value={editData.notes} onChange={handleChange} className="cal-input" />
                          ) : (a.notes || "—")}
                        </td>
                        <td>{fmtDateShort(a.dateCreated)}</td>
                        <td className="cal-actions">
                          {isEditing ? (
                            <>
                              <button className="btn btn--primary btn--sm" onClick={saveChanges}>Save</button>
                              <button className="btn btn--ghost btn--sm" onClick={() => setEditRow(null)}>Cancel</button>
                            </>
                          ) : (
                            <>
                              <button
                                className="btn btn--primary btn--sm"
                                onClick={() => moveToDelivery(a)}
                                title="Move to Delivery (sets time to TBC)"
                              >
                                Delivery
                              </button>
                              <button
                                className="btn btn--danger btn--sm btn--icon"
                                onClick={() => handleDelete(a._id)}
                                title="Delete"
                                aria-label="Delete appointment"
                              >
                                <TrashIconSmall />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* RIGHT: Delivery */}
        <section className="cal-panel" aria-label="Delivery">
          <div className="cal-panel-head">
            <h2>Delivery</h2>
            <p className="cal-sub">Double-click to edit. Double-click the car cell to pick a car. “Undo” sends it back with the original time.</p>
          </div>

          <div className="cal-table-scroll">
            <table className="cal-table" role="grid">
              <colgroup>
                <col className="col-name" />
                <col className="col-daytime" />
                <col className="col-car" />
                <col className="col-notes" />
                <col className="col-datecreated" />
                <col className="col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Day/Time</th>
                  <th>Car</th>
                  <th>Notes</th>
                  <th>Date Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {deliveryRows.length === 0 ? (
                  <tr><td colSpan="6" className="cal-empty">No deliveries.</td></tr>
                ) : (
                  deliveryRows.map((a) => {
                    const isEditing = editRow === a._id;
                    const rowCls = rowClassFor(a.dateTime);
                    return (
                      <tr
                        key={a._id}
                        data-id={a._id}
                        className={rowCls}
                        onDoubleClick={(e) => { e.stopPropagation(); enterEdit(a); }}
                      >
                        <td>
                          {isEditing ? (
                            <input name="name" value={editData.name} onChange={handleChange} className="cal-input" autoFocus />
                          ) : (a.name || "—")}
                        </td>
                        <td>
                          {isEditing ? (
                            <input
                              name="dateTime"
                              value={editData.dateTime}
                              onChange={handleChange}
                              className="cal-input"
                              placeholder="TBC or set a time"
                            />
                          ) : (
                            renderDayTime(a.dateTime)
                          )}
                        </td>
                        <td onDoubleClick={() => openCarPicker(a)} title="Double-click to pick a car">
                          {isEditing ? (
                            <div className="car-edit">
                              <input className="cal-input" value={carLabelFromId(editData.car)} readOnly placeholder="No Car" />
                              <button className="btn btn--ghost btn--sm" onClick={() => openCarPicker(a)}>Pick</button>
                            </div>
                          ) : (
                            renderCarCell(a)
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input name="notes" value={editData.notes} onChange={handleChange} className="cal-input" />
                          ) : (a.notes || "—")}
                        </td>
                        <td>{fmtDateShort(a.dateCreated)}</td>
                        <td className="cal-actions">
                          {isEditing ? (
                            <>
                              <button className="btn btn--primary btn--sm" onClick={saveChanges}>Save</button>
                              <button className="btn btn--ghost btn--sm" onClick={() => setEditRow(null)}>Cancel</button>
                            </>
                          ) : (
                            <>
                              <button
                                className="btn btn--ghost btn--sm"
                                onClick={() => undoDelivery(a)}
                                title="Send back to Appointments with original time"
                              >
                                Undo
                              </button>
                              <button
                                className="btn btn--danger btn--sm btn--icon"
                                onClick={() => handleDelete(a._id)}
                                title="Delete"
                                aria-label="Delete delivery"
                              >
                                <TrashIconSmall />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function TrashIconSmall() {
  return (
    <svg className="icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- Styles (desktop fits; mobile scrolls) ---------- */
const css = `
:root { color-scheme: dark; }
html, body, #root { background: #0B1220; }
* { box-sizing: border-box; }

.cal-wrap {
  --bg: #0B1220;
  --panel: #0F172A;
  --muted: #9CA3AF;
  --text: #E5E7EB;
  --line: #1F2937;
  --primary: #2563EB;
  --danger: #DC2626;
  --ghost: #111827;
  --ring: #2E4B8F;
  color: var(--text);
  background: var(--bg);
  min-height: 100vh;
  padding: 20px;
  font-family: Inter, system-ui, -apple-system, Segoe UI, Arial;
}

/* keep header clear of fixed hamburger */
.with-ham .cal-head { padding-left: 56px; }
@media (max-width: 480px){ .with-ham .cal-head { padding-left: 48px; } }

.cal-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; }
.cal-head h1 { margin:0 0 2px; font-size:22px; letter-spacing:0.2px; }
.cal-sub { margin:0; color:var(--muted); font-size:12px; }
.cal-head-titles { display:flex; flex-direction:column; gap:4px; }
.cal-alert { background:#3B0D0D; border:1px solid #7F1D1D; color:#FECACA; padding:10px 12px; border-radius:12px; margin-bottom:12px; }

.btn { border:1px solid transparent; border-radius:12px; padding:10px 14px; cursor:pointer; font-weight:600; transition:transform .05s, box-shadow .2s, border-color .2s, background .2s; }
.btn:active { transform: translateY(1px); }
.btn:focus-visible { outline:none; box-shadow:0 0 0 3px var(--ring); }
.btn--primary { background:var(--primary); color:#fff; }
.btn--danger { background:var(--danger); color:#fff; }
.btn--ghost { background:var(--ghost); color:var(--text); border-color:#243041; }
.btn--sm { padding:6px 10px; border-radius:10px; font-size:12px; }
.btn--icon { padding:6px; width:32px; height:28px; display:inline-flex; align-items:center; justify-content:center; }
.btn .icon { display:inline-block; }

.cal-grid { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:16px; }
@media (max-width: 960px){ .cal-grid { grid-template-columns:1fr; } }

.cal-panel { background:transparent; display:flex; flex-direction:column; gap:10px; min-width:0; }
.cal-panel-head h2 { margin:0 0 2px; font-size:18px; }
.cal-panel-head .cal-sub { margin:0; }

/* Table container */
.cal-table-scroll { position:relative; border:1px solid var(--line); border-radius:14px; background:var(--panel); overflow:hidden; box-shadow: inset 0 1px 0 rgba(255,255,255,0.02), 0 10px 30px rgba(0,0,0,0.25); }

/* Desktop widths */
@media (min-width: 1024px){
  .cal-table { width:100%; table-layout:fixed; }
  .cal-table thead th, .cal-table tbody td { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .cal-table-scroll { overflow-x:hidden; }

  .cal-table col.col-name        { width: 16%; }
  .cal-table col.col-daytime     { width: 22%; }
  .cal-table col.col-car         { width: 15%; }
  .cal-table col.col-notes       { width: 35%; }
  .cal-table col.col-datecreated { width: 12%; }
  .cal-table col.col-actions     { width: 120px; }
}
@media (min-width: 1400px){
  .cal-table col.col-notes { width: 36%; }
}

/* Mobile/tablet */
@media (max-width: 1023px){
  .cal-table-scroll { overflow-x:auto; -webkit-overflow-scrolling:touch; }
  .cal-table { table-layout:auto; min-width:720px; }
  .cal-table thead th, .cal-table tbody td { white-space:nowrap; }
}

/* Table base */
.cal-table { border-collapse:separate; border-spacing:0; }
.cal-table thead th { position:sticky; top:0; z-index:1; background:var(--panel); border-bottom:1px solid var(--line); text-align:left; font-size:12px; color:var(--muted); padding:12px 12px; }
.cal-table tbody td { padding:12px 12px; border-bottom:1px solid var(--line); font-size:14px; color:var(--text); vertical-align:middle; }
.cal-table tbody tr:hover { background:#0B1428; }
.cal-table tbody tr:nth-child(odd) td { background:rgba(255,255,255,0.01); }

/* Highlight rows */
.cal-table tbody tr.is-today td {
  background: #0f2a12 !important;
  box-shadow: inset 0 0 0 1px #1e3a23;
}
.cal-table tbody tr.is-tomorrow td {
  background: #2a210f !important;
  box-shadow: inset 0 0 0 1px #3a2e1e;
}

/* Inputs */
.cal-input { width:100%; padding:8px 10px; border-radius:10px; border:1px solid #243041; background:#0B1220; color:#E5E7EB; outline:none; transition:border-color .2s, box-shadow .2s; }
.cal-input:focus { border-color:#2E4B8F; box-shadow:0 0 0 3px rgba(37,99,235,0.25); }

/* Actions & inline car editor */
.cal-actions { display:flex; align-items:center; justify-content:flex-end; gap:8px; white-space:nowrap; }
.car-edit { display:flex; align-items:center; gap:8px; }
`;
