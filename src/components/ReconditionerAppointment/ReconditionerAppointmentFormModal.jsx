// src/components/ReconditionerAppointment/ReconditionerAppointmentFormModal.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../../lib/api"; // ✅ env-based axios instance
import CarPickerModal from "../CarPicker/CarPickerModal";

/**
 * Create appointment modal.
 * This version creates ONE appointment PER VEHICLE (per selected car, plus optional typed vehicle).
 * Each vehicle has its own "notes" field.
 */
export default function ReconditionerAppointmentFormModal({
  show,
  onClose,
  onSaved,
  cars = [],
  categoryId,
}) {
  const [name, setName] = useState("");
  const [dateTime, setDateTime] = useState("");

  // selected cars + per-car notes
  const [carIds, setCarIds] = useState([]);            // string[] of Car._id
  const [carNotes, setCarNotes] = useState({});         // { [carId]: string }

  // optional typed vehicle (no Car ref) + its note
  const [textCar, setTextCar] = useState("");
  const [textCarNotes, setTextCarNotes] = useState("");

  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  // car picker
  const [pickerOpen, setPickerOpen] = useState(false);

  // quick lookup for labels and rego matching (future-friendly)
  const idToLabel = useMemo(() => {
    const map = new Map();
    for (const c of cars) {
      map.set(c._id, `${c.rego} • ${c.make} ${c.model}`);
    }
    return map;
  }, [cars]);

  // reset when opened
  useEffect(() => {
    if (!show) return;
    setName("");
    setDateTime("");
    setCarIds([]);
    setCarNotes({});
    setTextCar("");
    setTextCarNotes("");
    setErr("");
    setSaving(false);
    setPickerOpen(false);
  }, [show]);

  if (!show) return null;

  // helpers
  const addCarId = (id) => {
    if (!id) return;
    setCarIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setCarNotes((prev) => (prev[id] != null ? prev : { ...prev, [id]: "" }));
  };
  const removeCarId = (id) => {
    setCarIds((prev) => prev.filter((x) => x !== id));
    setCarNotes((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };
  const setNoteFor = (id, v) => setCarNotes((prev) => ({ ...prev, [id]: v }));

  const validate = () => {
    if (!categoryId) return "Missing category.";
    if (!name.trim()) return "Name is required.";
    if (carIds.length === 0 && !textCar.trim()) return "Add at least one car or enter a typed vehicle.";
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");

    const vErr = validate();
    if (vErr) { setErr(vErr); return; }

    // Build one payload PER vehicle (car or typed)
    const payloads = [
      ...carIds.map((id) => ({
        category: categoryId,
        name: name.trim(),
        dateTime: (dateTime || "").trim(),
        cars: [{ car: id, notes: (carNotes[id] || "").trim() }],
      })),
      ...(textCar.trim()
        ? [{
            category: categoryId,
            name: name.trim(),
            dateTime: (dateTime || "").trim(),
            cars: [{ carText: textCar.trim(), notes: textCarNotes.trim() }],
          }]
        : []),
    ];

    try {
      setSaving(true);
      await Promise.all(
        payloads.map((p) =>
          api.post("/reconditioner-appointments", p, {
            headers: { "Content-Type": "application/json" },
          })
        )
      );
      setSaving(false);
      onSaved && onSaved();
    } catch (e2) {
      setSaving(false);
      setErr(e2.response?.data?.message || e2.response?.data?.error || e2.message || "Failed to create appointment(s)");
    }
  };

  return (
    <div className="ra-modal-backdrop" onClick={onClose}>
      <style>{css}</style>
      <div className="ra-modal" onClick={(e) => e.stopPropagation()}>
        <header className="ra-modal-head">
          <h3>New Appointment</h3>
        </header>

        {err ? <div className="cal-alert" style={{ marginBottom: 8 }}>{err}</div> : null}

        <form onSubmit={handleSubmit} className="ra-form">
          <div className="ra-row">
            <label>Name <span className="req">*</span></label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="cal-input"
              placeholder="Required"
            />
          </div>

          <div className="ra-row">
            <label>Date / Time</label>
            <input
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
              className="cal-input"
              placeholder="e.g. 2025-09-30 10:30 (optional)"
            />
          </div>

          <div className="ra-row">
            <label>Cars</label>
            <div className="chipbox">
              {carIds.length === 0 && <div className="muted">No cars selected.</div>}

              {carIds.map((id) => (
                <div key={id} className="car-line">
                  <span className="chip">
                    {idToLabel.get(id) || "—"}
                    <button
                      type="button"
                      className="chip-x"
                      onClick={() => removeCarId(id)}
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  </span>
                  <input
                    className="cal-input car-note"
                    placeholder="Notes for this car (optional)"
                    value={carNotes[id] || ""}
                    onChange={(e) => setNoteFor(id, e.target.value)}
                  />
                </div>
              ))}

              <div className="chipbox-actions">
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPickerOpen(true)}>
                  + Add Car
                </button>
                {carIds.length > 0 && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => { setCarIds([]); setCarNotes({}); }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="ra-row">
            <label>Or Text Vehicle</label>
            <div className="typed-vehicle">
              <input
                value={textCar}
                onChange={(e) => setTextCar(e.target.value)}
                className="cal-input"
                placeholder="e.g. 'Unidentified white ute'"
              />
              <input
                value={textCarNotes}
                onChange={(e) => setTextCarNotes(e.target.value)}
                className="cal-input"
                placeholder="Notes for typed vehicle (optional)"
              />
            </div>
          </div>

          <footer className="ra-modal-actions">
            <button type="button" className="btn btn--ghost btn--sm" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary btn--sm" disabled={saving}>
              {saving ? "Saving…" : "Create"}
            </button>
          </footer>
        </form>
      </div>

      {/* Car picker */}
      <CarPickerModal
        show={pickerOpen}
        cars={cars}
        onClose={() => setPickerOpen(false)}
        onSelect={(carOrNull) => {
          setPickerOpen(false);
          if (carOrNull?._id) addCarId(carOrNull._id);
        }}
      />
    </div>
  );
}

/* Styles align with your existing look & feel */
const css = `
:root { color-scheme: dark; }
.ra-modal-backdrop {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,.45);
  display:flex; align-items:center; justify-content:center;
  padding: 16px;
}
.ra-modal {
  width: 100%;
  max-width: 720px;
  background: #0F172A; color: #E5E7EB;
  border: 1px solid #1F2937; border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0,0,0,.5);
}
.ra-modal-head { padding: 14px 16px; border-bottom: 1px solid #1F2937; }
.ra-modal-head h3 { margin: 0; font-size: 18px; }

.ra-form { padding: 14px 16px; }
.ra-row { display:grid; grid-template-columns: 180px 1fr; gap: 10px; margin-bottom: 10px; align-items:center; }
.ra-row label { color:#9CA3AF; } .req{ color:#fca5a5; }
.ra-modal-actions { display:flex; justify-content:flex-end; gap:8px; padding-top: 6px; }

.btn { border:1px solid transparent; border-radius:12px; padding:10px 14px; cursor:pointer; font-weight:600; }
.btn--primary { background:#2563EB; color:#fff; }
.btn--ghost { background:#111827; color:#E5E7EB; border-color:#243041; }
.btn--sm { padding:6px 10px; border-radius:10px; font-size:12px; }

.cal-alert { background:#3B0D0D; border:1px solid #7F1D1D; color:#FECACA; padding:10px 12px; border-radius:12px; }

.cal-input { width:100%; padding:8px 10px; border-radius:10px; border:1px solid #243041; background:#0B1220; color:#E5E7EB; outline:none; transition:border-color .2s, box-shadow .2s; }
.cal-input:focus { border-color:#2E4B8F; box-shadow:0 0 0 3px rgba(37,99,235,0.25); }

.chipbox { display:flex; flex-direction:column; gap:8px; }
.chipbox-actions { display:flex; gap:8px; }
.chip { display:inline-flex; align-items:center; gap:6px; background:#111827; border:1px solid #243041; padding:6px 8px; border-radius:12px; margin:0 8px 8px 0; }
.chip-x { background:transparent; border:none; color:#9CA3AF; cursor:pointer; font-size:14px; line-height:1; }
.muted { color: #9CA3AF; }

.car-line { display:grid; grid-template-columns: minmax(280px,1fr) 1fr; gap:8px; align-items:center; }
.car-note { min-width: 160px; }

.typed-vehicle { display:grid; grid-template-columns: 1fr 1fr; gap:8px; }

@media (max-width: 720px) {
  .ra-row { grid-template-columns: 1fr; }
  .car-line, .typed-vehicle { grid-template-columns: 1fr; }
}
`;
