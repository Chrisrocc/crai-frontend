import { useEffect, useState } from "react";
import api from "../../lib/api";
import CarPickerModal from "../CarPicker/CarPickerModal";

export default function TaskFormModal({ show, onClose, onSave, cars = [] }) {
  const [form, setForm] = useState({ task: "", car: "" });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // reset when hidden
  useEffect(() => {
    if (!show) {
      setForm({ task: "", car: "" });
      setPickerOpen(false);
      setSaving(false);
    }
  }, [show]);

  // close on overlay click / Esc
  useEffect(() => {
    if (!show) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [show, onClose]);

  if (!show) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;

    const payload = {
      task: (form.task || "").trim(),
      ...(form.car ? { car: form.car } : {}),
    };

    if (!payload.task) return;

    try {
      setSaving(true);
      await api.post("/tasks", payload, { headers: { "Content-Type": "application/json" } });
      onSave?.();   // refresh parent list
      onClose?.();  // close modal
    } catch (err) {
      alert("Error creating task: " + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  const carLabel = (id) => {
    const c = cars.find((x) => x._id === id);
    return c ? `${c.rego} • ${c.make} ${c.model}` : "";
  };

  return (
    <div className="cal-modal-overlay" onClick={onClose}>
      <style>{css}</style>
      <div className="cal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cal-modal-head">
          <h3>Add New Task</h3>
          <button className="btn btn--ghost btn--sm" onClick={onClose} aria-label="Close">Close</button>
        </div>

        <form onSubmit={submit} className="cal-form">
          <label className="cal-label">
            <span>Task</span>
            <input
              className="cal-input"
              value={form.task}
              onChange={(e) => setForm((p) => ({ ...p, task: e.target.value }))}
              placeholder="Describe the task…"
              required
              autoFocus
            />
          </label>

          <label className="cal-label">
            <span>Car (optional)</span>
            {form.car ? (
              <div className="car-edit">
                <input className="cal-input" value={carLabel(form.car)} readOnly />
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPickerOpen(true)}>
                  Pick
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setForm((p) => ({ ...p, car: "" }))}
                >
                  Clear
                </button>
              </div>
            ) : (
              <div className="car-edit">
                <input className="cal-input" value="" placeholder="No car selected" readOnly />
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPickerOpen(true)}>
                  Pick
                </button>
              </div>
            )}
          </label>

          <div className="cal-actions">
            <button className="btn btn--primary" disabled={saving}>
              {saving ? "Adding…" : "+ Add Task"}
            </button>
          </div>
        </form>
      </div>

      {/* Car picker */}
      <CarPickerModal
        show={pickerOpen}
        cars={cars}
        onClose={() => setPickerOpen(false)}
        onSelect={(carOrNull) => {
          setPickerOpen(false);
          setForm((p) => ({ ...p, car: carOrNull?._id || "" }));
        }}
      />
    </div>
  );
}

const css = `
:root { color-scheme: dark; }
.cal-modal-overlay{ position:fixed; inset:0; background:rgba(0,0,0,.5); display:flex; align-items:center; justify-content:center; z-index:1000; }
.cal-modal{
  width:min(560px, 94vw);
  background:#0F172A; color:#E5E7EB; border:1px solid #1F2937; border-radius:14px;
  box-shadow:0 20px 60px rgba(0,0,0,.5); padding:14px;
}
.cal-modal-head{ display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px; }
.cal-form{ display:flex; flex-direction:column; gap:12px; }
.cal-label{ display:flex; flex-direction:column; gap:6px; }
.cal-input{ width:100%; padding:10px; border-radius:10px; border:1px solid #243041; background:#0B1220; color:#E5E7EB; }
.cal-input:focus{ outline:none; border-color:#2E4B8F; box-shadow:0 0 0 3px rgba(37,99,235,.25); }
.car-edit{ display:flex; align-items:center; gap:8px; }
.cal-actions{ display:flex; justify-content:flex-end; }
.btn{ border:1px solid transparent; border-radius:12px; padding:10px 14px; cursor:pointer; font-weight:600; }
.btn--primary{ background:#2563EB; color:#fff; }
.btn--ghost{ background:#111827; color:#E5E7EB; border-color:#243041; }
.btn--sm{ padding:6px 10px; border-radius:10px; font-size:12px; }
`;
