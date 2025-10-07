// src/components/CustomerAppointment/CustomerAppointmentFormModal.jsx
import { useEffect, useState, useRef, useMemo } from "react";
import api from "../../lib/api"; // ✅ use configured axios instance (env-based)
import CarPickerModal from "../CarPicker/CarPickerModal";

export default function CustomerAppointmentFormModal({ show, onClose, onSave, cars = [] }) {
  const [formData, setFormData] = useState({ name: "", dayTime: "", car: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const firstFieldRef = useRef(null);

  // Reset when hidden
  useEffect(() => {
    if (!show) {
      setFormData({ name: "", dayTime: "", car: "", notes: "" });
      setSubmitting(false);
      setPickerOpen(false);
    }
  }, [show]);

  // Esc to close + focus first field
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => firstFieldRef.current?.focus(), 80);
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [show, onClose]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  };

  const carLabel = useMemo(() => {
    const c = cars.find((x) => x._id === formData.car);
    return c ? `${c.rego} • ${c.make} ${c.model}` : "";
  }, [cars, formData.car]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    // Require a car selection
    if (!formData.car) {
      alert("Please select a car.");
      setPickerOpen(true);
      return;
    }

    setSubmitting(true);
    try {
      // Back-compat: server may expect both `dateTime` and/or `dayTime`
      const payload = {
        name: (formData.name || "").trim(),
        dateTime: (formData.dayTime || "").trim(),
        dayTime: (formData.dayTime || "").trim(),
        car: formData.car, // car _id
        notes: (formData.notes || "").trim(),
      };

      await api.post("/customer-appointments", payload, {
        headers: { "Content-Type": "application/json" },
      });

      onSave?.();   // refresh parent list
      onClose?.();  // close modal
    } catch (error) {
      console.error("Error creating appointment:", error.response?.data || error.message);
      alert("Error creating appointment: " + (error.response?.data?.message || error.message));
    } finally {
      setSubmitting(false);
    }
  };

  if (!show) return null;

  return (
    <div className="cam-wrap" onClick={onClose}>
      <style>{css}</style>

      {/* Car Picker */}
      <CarPickerModal
        show={pickerOpen}
        cars={cars}
        onClose={() => setPickerOpen(false)}
        onSelect={(carOrNull) => {
          setFormData((p) => ({ ...p, car: carOrNull?._id || "" }));
          setPickerOpen(false);
        }}
      />

      <div
        className="cam-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cam-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="cam-head">
          <div>
            <h3 id="cam-title">Add New Appointment</h3>
            <p className="cam-sub">Create a booking and link it to a car.</p>
          </div>
          <button className="cam-x" onClick={onClose} aria-label="Close">×</button>
        </header>

        <form className="cam-form" onSubmit={handleSubmit}>
          {/* Name */}
          <label className="cam-label" htmlFor="cam-name">Name</label>
          <input
            ref={firstFieldRef}
            id="cam-name"
            className="cam-input"
            name="name"
            type="text"
            placeholder="Customer name"
            value={formData.name}
            onChange={handleChange}
            required
          />

          {/* Day/Time */}
          <label className="cam-label" htmlFor="cam-daytime">Day/Time</label>
          <input
            id="cam-daytime"
            className="cam-input"
            name="dayTime"
            type="text"
            placeholder="e.g. next Saturday 9am"
            value={formData.dayTime}
            onChange={handleChange}
            required
          />

          {/* Car (opens CarPicker) */}
          <div className="cam-row">
            <label className="cam-label" htmlFor="cam-car-display">Car</label>
            <span className="cam-hint">Double-click or use Pick</span>
          </div>
          <div className="cam-carpicker">
            <input
              id="cam-car-display"
              className="cam-input cam-input--readonly"
              type="text"
              readOnly
              placeholder="No car selected"
              value={carLabel}
              onDoubleClick={() => setPickerOpen(true)}
              title="Double-click to pick a car"
            />
            <div className="cam-car-actions">
              {formData.car && (
                <button
                  type="button"
                  className="cam-btn cam-btn--ghost cam-btn--sm"
                  onClick={() => setFormData((p) => ({ ...p, car: "" }))}
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                className="cam-btn cam-btn--primary cam-btn--sm"
                onClick={() => setPickerOpen(true)}
              >
                Pick
              </button>
            </div>
          </div>

          {/* Notes */}
          <label className="cam-label" htmlFor="cam-notes">Notes (optional)</label>
          <input
            id="cam-notes"
            className="cam-input"
            name="notes"
            type="text"
            placeholder="Any special requests…"
            value={formData.notes}
            onChange={handleChange}
          />

          {/* Actions */}
          <div className="cam-actions">
            <button type="button" className="cam-btn cam-btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="cam-btn cam-btn--primary" disabled={submitting}>
              {submitting ? "Saving…" : "Add Appointment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------- styles (scoped) ---------- */
const css = `
:root { color-scheme: dark; }
.cam-wrap {
  position: fixed; inset: 0; z-index: 70;
  display:flex; align-items:center; justify-content:center;
  background: rgba(0,0,0,.55);
  backdrop-filter: blur(2px);
}
.cam-modal {
  width: min(560px, calc(100vw - 32px));
  max-height: min(86vh, 900px);
  display:flex; flex-direction:column;
  background:#0F172A; color:#E5E7EB;
  border:1px solid #1F2937; border-radius:14px;
  box-shadow: 0 20px 60px rgba(0,0,0,.45);
  animation: cam-pop .12s ease-out;
}
@keyframes cam-pop { from { transform: translateY(8px); opacity:.8 } to { transform:none; opacity:1 } }

.cam-head {
  display:flex; align-items:center; justify-content:space-between; gap:10px;
  padding:14px 16px; border-bottom:1px solid #1F2937;
}
.cam-head h3 { margin:0; font-size:18px; }
.cam-sub { margin:2px 0 0; color:#9CA3AF; font-size:12px; }
.cam-x {
  border:1px solid #243041; background:#111827; color:#E5E7EB;
  width:32px; height:32px; border-radius:10px; cursor:pointer;
}

.cam-form { padding:16px; display:grid; grid-template-columns:1fr; gap:10px; }
.cam-label { font-size:12px; color:#9CA3AF; }
.cam-row { display:flex; align-items:end; justify-content:space-between; }
.cam-hint { color:#9CA3AF; font-size:11px; }

.cam-input {
  width:100%; padding:10px 12px; border-radius:10px;
  border:1px solid #243041; background:#0B1220; color:#E5E7EB;
  outline:none; transition:border-color .2s, box-shadow .2s;
}
.cam-input:focus { border-color:#2E4B8F; box-shadow:0 0 0 3px rgba(37,99,235,.25); }
.cam-input--readonly { cursor:default; user-select:none; }

.cam-carpicker { display:flex; gap:8px; align-items:center; }
.cam-car-actions { display:flex; gap:8px; }

.cam-actions { display:flex; justify-content:flex-end; gap:10px; margin-top:8px; }
.cam-btn {
  border:1px solid transparent; border-radius:12px; padding:10px 14px;
  cursor:pointer; font-weight:600;
}
.cam-btn--primary { background:#2563EB; color:#fff; }
.cam-btn--ghost { background:#111827; color:#E5E7EB; border-color:#243041; }
.cam-btn--sm { padding:6px 10px; font-size:12px; border-radius:10px; }
.cam-btn[disabled] { opacity:.7; cursor:default; }
`;
