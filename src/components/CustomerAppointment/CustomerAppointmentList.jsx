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
          api.get("/customer-appointments", {
            headers: { "Cache-Control": "no-cache" },
          }),
          api.get("/cars", { headers: { "Cache-Control": "no-cache" } }),
        ]);
        setAppointments(a.data?.data || []);
        setCars(c.data?.data || []);
      } catch (e) {
        console.error("Init fetch failed:", e.response?.data || e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const refreshAppointments = async () => {
    try {
      const res = await api.get("/customer-appointments", {
        headers: { "Cache-Control": "no-cache" },
      });
      setAppointments(res.data?.data || []);
    } catch (e) {
      console.error("Refresh failed:", e.response?.data || e.message);
    }
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
    if (savingRef.current) return;
    savingRef.current = true;

    const prev = appointments;
    setAppointments((p) => p.filter((x) => x._id !== id));

    try {
      await api.delete(`/customer-appointments/${id}`);
    } catch (e) {
      console.error("Delete failed:", e.response?.data || e.message);
      setAppointments(prev);
    } finally {
      savingRef.current = false;
    }
  };

  const saveChanges = async () => {
    if (!editRow || savingRef.current) return;
    savingRef.current = true;

    const prev = appointments;

    // 🔒 NORMALIZE ONCE + LOCK
    const rawDateTime = (editData.dateTime ?? "").trim();
    const norm = standardizeDayTime(rawDateTime);
    const finalDateTime = norm.label || rawDateTime;

    const payload = {
      name: (editData.name ?? "").trim(),
      dateTime: finalDateTime,
      notes: editData.notes ?? "",
      car: editData.car || null,
      // mirror for legacy BE expectations
      dayTime: finalDateTime,
    };

    const chosen = cars.find((c) => c._id === editData.car) || null;

    // optimistic update
    setAppointments((p) =>
      p.map((a) =>
        a._id === editRow
          ? {
              ...a,
              name: payload.name,
              dateTime: finalDateTime,
              notes: payload.notes,
              car: chosen
                ? {
                    _id: chosen._id,
                    rego: chosen.rego,
                    make: chosen.make,
                    model: chosen.model,
                  }
                : null,
              carText: chosen ? "" : a.carText,
            }
          : a
      )
    );

    try {
      const res = await api.put(`/customer-appointments/${editRow}`, payload, {
        headers: { "Content-Type": "application/json" },
      });

      if (res.data?.data) {
        setAppointments((p) =>
          p.map((a) => (a._id === editRow ? res.data.data : a))
        );
      } else {
        await refreshAppointments();
      }

      setEditData((prev2) => ({ ...prev2, dateTime: finalDateTime }));
      setEditRow(null);
    } catch (e) {
      console.error("Save failed:", e.response?.data || e.message);
      setAppointments(prev);
    } finally {
      savingRef.current = false;
    }
  };

  const moveToDelivery = async (appointment) => {
    if (savingRef.current) return;
    savingRef.current = true;

    const prev = appointments;

    const payload = {
      isDelivery: true,
      isFollowUp: false,
      originalDateTime: appointment.dateTime || "",
      dateTime: "TBC",
    };

    setAppointments((p) =>
      p.map((a) => (a._id === appointment._id ? { ...a, ...payload } : a))
    );

    try {
      const res = await api.put(
        `/customer-appointments/${appointment._id}`,
        payload,
        { headers: { "Content-Type": "application/json" } }
      );
      if (res.data?.data) {
        setAppointments((p) =>
          p.map((a) => (a._id === appointment._id ? res.data.data : a))
        );
      } else {
        await refreshAppointments();
      }
    } catch (e) {
      console.error("Move to delivery failed:", e.response?.data || e.message);
      setAppointments(prev);
    } finally {
      savingRef.current = false;
    }
  };

  const moveToFollowUp = async (appointment) => {
    if (savingRef.current) return;
    savingRef.current = true;

    const prev = appointments;

    const payload = {
      isFollowUp: true,
      isDelivery: false,
      originalDateTime: appointment.dateTime || "",
      dateTime: "TBC",
    };

    setAppointments((p) =>
      p.map((a) => (a._id === appointment._id ? { ...a, ...payload } : a))
    );

    try {
      const res = await api.put(
        `/customer-appointments/${appointment._id}`,
        payload,
        { headers: { "Content-Type": "application/json" } }
      );
      if (res.data?.data) {
        setAppointments((p) =>
          p.map((a) => (a._id === appointment._id ? res.data.data : a))
        );
      } else {
        await refreshAppointments();
      }
    } catch (e) {
      console.error("Move to follow up failed:", e.response?.data || e.message);
      setAppointments(prev);
    } finally {
      savingRef.current = false;
    }
  };

  const undoDelivery = async (appointment) => {
    if (savingRef.current) return;
    savingRef.current = true;

    const prev = appointments;
    const restoredTime = appointment.originalDateTime || "";

    const payload = {
      isDelivery: false,
      dateTime: restoredTime,
      originalDateTime: "",
    };

    setAppointments((p) =>
      p.map((a) => (a._id === appointment._id ? { ...a, ...payload } : a))
    );

    try {
      const res = await api.put(
        `/customer-appointments/${appointment._id}`,
        payload,
        { headers: { "Content-Type": "application/json" } }
      );
      if (res.data?.data) {
        setAppointments((p) =>
          p.map((a) => (a._id === appointment._id ? res.data.data : a))
        );
      } else {
        await refreshAppointments();
      }
    } catch (e) {
      console.error("Undo delivery failed:", e.response?.data || e.message);
      setAppointments(prev);
    } finally {
      savingRef.current = false;
    }
  };

  const undoFollowUp = async (appointment) => {
    if (savingRef.current) return;
    savingRef.current = true;

    const prev = appointments;
    const restoredTime = appointment.originalDateTime || "";

    const payload = {
      isFollowUp: false,
      dateTime: restoredTime,
      originalDateTime: "",
    };

    setAppointments((p) =>
      p.map((a) => (a._id === appointment._id ? { ...a, ...payload } : a))
    );

    try {
      const res = await api.put(
        `/customer-appointments/${appointment._id}`,
        payload,
        { headers: { "Content-Type": "application/json" } }
      );
      if (res.data?.data) {
        setAppointments((p) =>
          p.map((a) => (a._id === appointment._id ? res.data.data : a))
        );
      } else {
        await refreshAppointments();
      }
    } catch (e) {
      console.error("Undo follow up failed:", e.response?.data || e.message);
      setAppointments(prev);
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

  // Click-outside saves active row — but NOT while the picker is open
  useEffect(() => {
    const onDown = (e) => {
      if (!editRow || carPicker.open) return;
      const rowEl = document.querySelector(`tr[data-id="${editRow}"]`);
      if (!rowEl) return;
      if (!rowEl.contains(e.target)) saveChanges();
    };
    if (editRow) document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [editRow, editData, carPicker.open]); // eslint-disable-line react-hooks/exhaustive-deps

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
    d
      ? new Date(d).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "2-digit",
        })
      : "—";

  const renderCarCell = (a) => {
    if (a.car) return `${a.car.rego} • ${a.car.make} ${a.car.model}`;
    if (a.carText) return a.carText;
    return "—";
  };

  const carLabelFromId = (id) => {
    const c = cars.find((x) => x._id === id);
    return c ? `${c.rego} • ${c.make} ${c.model}` : "";
  };

  const apptRows = appointments.filter((a) => !a.isDelivery && !a.isFollowUp);
  const deliveryRows = appointments.filter((a) => a.isDelivery);
  const followUpRows = appointments.filter((a) => a.isFollowUp);

  const renderDayTime = (raw) => {
    const { label } = standardizeDayTime(raw);
    return label || raw || "—";
  };

  const rowClassFor = (raw) => dayTimeHighlightClass(raw);

  return (
    <div className="cal-wrap with-ham">
      <style>{css}</style>

      <HamburgerMenu />

      <header className="cal-head">
        <div className="cal-head-titles">
          <h1>Appointments, Delivery &amp; Follow Up</h1>
          <p className="cal-sub">
            Edit inline, move to Delivery/Follow Up, and keep everything up to date fast.
          </p>
        </div>
        <button className="btn btn--primary" onClick={() => setShowForm(true)}>
          + New Appointment
        </button>
      </header>

      <CustomerAppointmentFormModal
        show={showForm}
        onClose={() => setShowForm(false)}
        onSave={refreshAppointments}
        cars={cars}
      />

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
            <p className="cal-sub">
              Double-click a row to edit. Double-click the car cell to pick a car.
            </p>
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
                  <tr>
                    <td colSpan="6" className="cal-empty">
                      No appointments found.
                    </td>
                  </tr>
                ) : (
                  apptRows.map((a) => {
                    const isEditing = editRow === a._id;
                    const rowCls = rowClassFor(a.dateTime);

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
                            <input
                              name="name"
                              value={editData.name}
                              onChange={handleChange}
                              className="cal-input"
                              autoFocus
                            />
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
                              placeholder="e.g. Thu 10:00 or tomorrow 3pm"
                            />
                          ) : (
                            renderDayTime(a.dateTime)
                          )}
                        </td>

                        <td
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            openCarPicker(a);
                          }}
                          title="Double-click to pick a car"
                        >
                          {isEditing ? (
                            <div className="car-edit">
                              <input
                                className="cal-input"
                                value={carLabelFromId(editData.car)}
                                readOnly
                                placeholder="No Car"
                              />
                              <button
                                className="btn btn--ghost btn--sm"
                                type="button"
                                onClick={() => openCarPicker(a)}
                              >
                                Pick
                              </button>
                            </div>
                          ) : (
                            renderCarCell(a)
                          )}
                        </td>

                        <td>
                          {isEditing ? (
                            <input
                              name="notes"
                              value={editData.notes}
                              onChange={handleChange}
                              className="cal-input"
                            />
                          ) : (
                            a.notes || "—"
                          )}
                        </td>

                        <td>{fmtDateShort(a.dateCreated)}</td>

                        <td className="cal-actions">
                          {isEditing ? (
                            <>
                              <button
                                className="btn btn--primary btn--sm"
                                type="button"
                                onClick={saveChanges}
                              >
                                Save
                              </button>
                              <button
                                className="btn btn--ghost btn--sm"
                                type="button"
                                onClick={() => setEditRow(null)}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className="btn btn--primary btn--sm"
                                type="button"
                                onClick={() => moveToDelivery(a)}
                                title="Move to Delivery (sets time to TBC)"
                              >
                                D
                              </button>
                              <button
                                className="btn btn--ghost btn--sm"
                                type="button"
                                onClick={() => moveToFollowUp(a)}
                                title="Move to Follow Up (sets time to TBC)"
                              >
                                F
                              </button>
                              <button
                                className="btn btn--danger btn--sm btn--icon"
                                type="button"
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

        {/* RIGHT: Delivery + Follow Up */}
        <div className="cal-right-stack">
          {/* Delivery */}
          <section className="cal-panel" aria-label="Delivery">
            <div className="cal-panel-head">
              <h2>Delivery</h2>
              <p className="cal-sub">
                Double-click to edit. Double-click the car cell to pick a car. “Undo” sends it back with the original
                time.
              </p>
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
                    <tr>
                      <td colSpan="6" className="cal-empty">
                        No deliveries.
                      </td>
                    </tr>
                  ) : (
                    deliveryRows.map((a) => {
                      const isEditing = editRow === a._id;
                      const rowCls = rowClassFor(a.dateTime);

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
                              <input
                                name="name"
                                value={editData.name}
                                onChange={handleChange}
                                className="cal-input"
                                autoFocus
                              />
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
                                placeholder="TBC or set a time"
                              />
                            ) : (
                              renderDayTime(a.dateTime)
                            )}
                          </td>

                          <td
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              openCarPicker(a);
                            }}
                            title="Double-click to pick a car"
                          >
                            {isEditing ? (
                              <div className="car-edit">
                                <input
                                  className="cal-input"
                                  value={carLabelFromId(editData.car)}
                                  readOnly
                                  placeholder="No Car"
                                />
                                <button
                                  className="btn btn--ghost btn--sm"
                                  type="button"
                                  onClick={() => openCarPicker(a)}
                                >
                                  Pick
                                </button>
                              </div>
                            ) : (
                              renderCarCell(a)
                            )}
                          </td>

                          <td>
                            {isEditing ? (
                              <input
                                name="notes"
                                value={editData.notes}
                                onChange={handleChange}
                                className="cal-input"
                              />
                            ) : (
                              a.notes || "—"
                            )}
                          </td>

                          <td>{fmtDateShort(a.dateCreated)}</td>

                          <td className="cal-actions">
                            {isEditing ? (
                              <>
                                <button
                                  className="btn btn--primary btn--sm"
                                  type="button"
                                  onClick={saveChanges}
                                >
                                  Save
                                </button>
                                <button
                                  className="btn btn--ghost btn--sm"
                                  type="button"
                                  onClick={() => setEditRow(null)}
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  className="btn btn--ghost btn--sm"
                                  type="button"
                                  onClick={() => undoDelivery(a)}
                                  title="Send back to Appointments with original time"
                                >
                                  Undo
                                </button>
                                <button
                                  className="btn btn--danger btn--sm btn--icon"
                                  type="button"
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

          {/* Follow Up (below delivery, offset down, but still flows) */}
          <section className="cal-panel cal-followup-panel" aria-label="Follow Up">
            <div className="cal-panel-head">
              <h2>Follow Up</h2>
              <p className="cal-sub">Click “Undo” to send it back with the original time.</p>
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
                  {followUpRows.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="cal-empty">
                        No follow ups.
                      </td>
                    </tr>
                  ) : (
                    followUpRows.map((a) => {
                      const rowCls = rowClassFor(a.dateTime);
                      return (
                        <tr key={a._id} data-id={a._id} className={rowCls}>
                          <td>{a.name || "—"}</td>
                          <td>{renderDayTime(a.dateTime)}</td>
                          <td>{renderCarCell(a)}</td>
                          <td>{a.notes || "—"}</td>
                          <td>{fmtDateShort(a.dateCreated)}</td>
                          <td className="cal-actions">
                            <button
                              className="btn btn--ghost btn--sm"
                              type="button"
                              onClick={() => undoFollowUp(a)}
                              title="Send back to Appointments with original time"
                            >
                              Undo
                            </button>
                            <button
                              className="btn btn--danger btn--sm btn--icon"
                              type="button"
                              onClick={() => handleDelete(a._id)}
                              title="Delete"
                              aria-label="Delete follow up"
                            >
                              <TrashIconSmall />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function TrashIconSmall() {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- Styles ---------- */
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

.with-ham .cal-head { padding-left: 56px; }
@media (max-width: 480px){ .with-ham .cal-head { padding-left: 48px; } }

.cal-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; }
.cal-head h1 { margin:0 0 2px; font-size:22px; letter-spacing:0.2px; }
.cal-sub { margin:0; color:var(--muted); font-size:12px; }
.cal-head-titles { display:flex; flex-direction:column; gap:4px; }

.btn { border:1px solid transparent; border-radius:12px; padding:10px 14px; cursor:pointer; font-weight:600; transition:transform .05s, box-shadow .2s, border-color .2s, background .2s; }
.btn:active { transform: translateY(1px); }
.btn:focus-visible { outline:none; box-shadow:0 0 0 3px var(--ring); }
.btn--primary { background:var(--primary); color:#fff; }
.btn--danger { background:var(--danger); color:#fff; }
.btn--ghost { background:var(--ghost); color:var(--text); border-color:#243041; }
.btn--sm { padding:6px 10px; border-radius:10px; font-size:12px; }
.btn--icon { padding:6px; width:32px; height:28px; display:inline-flex; align-items:center; justify-content:center; }
.btn .icon { display:inline-block; }

/* ✅ 2 columns: left = appointments, right = stack */
.cal-grid{
  display:grid;
  grid-template-columns:minmax(0,1fr) minmax(0,1fr);
  gap:16px;
  align-items:start;
}
@media (max-width: 960px){
  .cal-grid{ grid-template-columns:1fr; }
}

.cal-right-stack{
  display:flex;
  flex-direction:column;
  gap:16px;
  min-width:0;
}

/* ✅ Follow Up starts lower but still flows + gets pushed down if Delivery grows */
.cal-followup-panel{
  margin-top: clamp(120px, 18vh, 240px);
}

.cal-panel { background:transparent; display:flex; flex-direction:column; gap:10px; min-width:0; }
.cal-panel-head h2 { margin:0 0 2px; font-size:18px; }
.cal-panel-head .cal-sub { margin:0; }

.cal-table-scroll { position:relative; border:1px solid var(--line); border-radius:14px; background:var(--panel); overflow:hidden; box-shadow: inset 0 1px 0 rgba(255,255,255,0.02), 0 10px 30px rgba(0,0,0,0.25); }

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

@media (max-width: 1023px){
  .cal-table-scroll { overflow-x:auto; -webkit-overflow-scrolling:touch; }
  .cal-table { table-layout:auto; min-width:720px; }
  .cal-table thead th, .cal-table tbody td { white-space:nowrap; }
}

.cal-table { border-collapse:separate; border-spacing:0; }
.cal-table thead th { position:sticky; top:0; z-index:1; background:var(--panel); border-bottom:1px solid var(--line); text-align:left; font-size:12px; color:var(--muted); padding:12px 12px; }
.cal-table tbody td { padding:12px 12px; border-bottom:1px solid var(--line); font-size:14px; color:var(--text); vertical-align:middle; }
.cal-table tbody tr:hover { background:#0B1428; }
.cal-table tbody tr:nth-child(odd) td { background:rgba(255,255,255,0.01); }

.cal-table tbody tr.is-today td { background: #0f2a12 !important; box-shadow: inset 0 0 0 1px #1e3a23; }
.cal-table tbody tr.is-tomorrow td { background: #2a210f !important; box-shadow: inset 0 0 0 1px #3a2e1e; }

.cal-input { width:100%; padding:8px 10px; border-radius:10px; border:1px solid #243041; background:#0B1220; color:#E5E7EB; outline:none; transition:border-color .2s, box-shadow .2s; }
.cal-input:focus { border-color:#2E4B8F; box-shadow:0 0 0 3px rgba(37,99,235,0.25); }

.cal-actions { display:flex; align-items:center; justify-content:flex-end; gap:8px; white-space:nowrap; }
.car-edit { display:flex; align-items:center; gap:8px; }
`;



