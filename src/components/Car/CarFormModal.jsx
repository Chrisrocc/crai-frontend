import { useState, useEffect, useRef } from "react";
import api from "../../lib/api";

export default function CarFormModal({ show, onClose, onSave }) {
  const [formData, setFormData] = useState({
    rego: "",
    make: "",
    model: "",
    location: "",
    stage: "In Works",
    year: "",
    description: "",
    notes: "",
    checklist: [],
  });
  const [newItem, setNewItem] = useState("");
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!show) {
      setFormData({
        rego: "",
        make: "",
        model: "",
        location: "",
        stage: "In Works",
        year: "",
        description: "",
        notes: "",
        checklist: [],
      });
      setNewItem("");
      setPhotos([]);
    }
  }, [show]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "rego") {
      const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
      setFormData((p) => ({ ...p, rego: clean }));
      return;
    }
    if (name === "year") {
      const clean = value.replace(/[^\d]/g, "");
      setFormData((p) => ({ ...p, year: clean }));
      return;
    }
    setFormData((p) => ({ ...p, [name]: value }));
  };

  // -------- Checklist helpers --------
  const addChecklistItem = () => {
    const item = newItem.trim();
    if (item && !formData.checklist.includes(item)) {
      setFormData((p) => ({ ...p, checklist: [...p.checklist, item] }));
    }
    setNewItem("");
  };

  const removeChecklistItem = (item) =>
    setFormData((p) => ({ ...p, checklist: p.checklist.filter((i) => i !== item) }));

  // -------- Photos helpers --------
  const handlePick = () => fileRef.current?.click();
  const handleFiles = (e) => setPhotos(Array.from(e.target.files || []));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);

    try {
      const payload = {
        ...formData,
        rego: (formData.rego || "").trim(),
        make: (formData.make || "").trim(),
        model: (formData.model || "").trim(),
        location: (formData.location || "").trim(),
        stage: (formData.stage || "In Works").trim(),
        year: formData.year === "" ? undefined : Number(formData.year),
        description: (formData.description || "").trim(),
        notes: (formData.notes || "").trim(),
        checklist: (formData.checklist || []).map((s) => s.trim()).filter(Boolean),
      };

      // 1) create the car (JSON)
      const { data } = await api.post("/cars", payload);
      const createdCar = data?.data;
      const carId = createdCar?._id || createdCar?.id;

      if (!carId) throw new Error("Car created but no id returned");

      // 2) enqueue photos for background upload (non-blocking)
      if (photos?.length) {
        const { UploadQueue } = await import("../../lib/uploadQueue");
        for (const f of photos) {
          UploadQueue.enqueue({ carId, file: f, caption: "" });
        }
      }

      // ✅ return the created car to caller (CarPickerModal uses this)
      onSave?.(createdCar);

      onClose?.();
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Network or server error while creating car";
      console.error("Error creating car:", err);
      alert("Error creating car: " + msg);
    } finally {
      setBusy(false);
    }
  };

  if (!show) return null;

  return (
    <div
      style={overlay}
      // ✅ stop bubbling to any parent modal overlay
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-car-title"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={header}>
          <h2 id="add-car-title" style={{ margin: 0, fontSize: 18 }}>
            Add New Car
          </h2>
          <button onClick={onClose} style={closeBtn} aria-label="Close">
            ×
          </button>
        </div>

        {/* Scrollable content */}
        <form onSubmit={handleSubmit} style={content}>
          {/* Fields */}
          {[
            { key: "rego", label: "Rego", placeholder: "ABC123", required: true },
            { key: "make", label: "Make" },
            { key: "model", label: "Model" },
            { key: "location", label: "Location" },
            { key: "year", label: "Year" },
            { key: "description", label: "Description" },
            { key: "notes", label: "Notes" },
          ].map((f) => (
            <div style={mb} key={f.key}>
              <label style={lbl}>{f.label}</label>
              <input
                type="text"
                name={f.key}
                value={formData[f.key]}
                onChange={handleChange}
                required={!!f.required}
                style={inp}
                placeholder={f.placeholder || ""}
                inputMode={f.key === "year" ? "numeric" : undefined}
              />
            </div>
          ))}

          <div style={mb}>
            <label style={lbl}>Stage</label>
            <select name="stage" value={formData.stage} onChange={handleChange} style={inpSelect}>
              <option>In Works</option>
              <option>In Works/Online</option>
              <option>Online</option>
              <option>Sold</option>
            </select>
          </div>

          {/* Checklist */}
          <div style={{ ...mb, borderTop: "1px solid #2a3446", paddingTop: 10 }}>
            <label style={lbl}>Checklist Items</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                style={{ ...inp, flex: 1 }}
                placeholder="e.g. Spare key"
              />
              <button type="button" onClick={addChecklistItem} className="btn btn--primary" style={btnPrimary}>
                Add
              </button>
            </div>

            {formData.checklist.length > 0 && (
              <ul style={{ marginTop: 8, fontSize: 13, paddingLeft: 16 }}>
                {formData.checklist.map((item, i) => (
                  <li
                    key={i}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
                  >
                    <span style={{ overflowWrap: "anywhere" }}>{item}</span>
                    <button
                      type="button"
                      onClick={() => removeChecklistItem(item)}
                      style={linkDanger}
                      aria-label={`Remove ${item}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Photos */}
          <div style={{ ...mb, borderTop: "1px solid #2a3446", paddingTop: 10 }}>
            <label style={lbl}>Photos (auto-analysis for damage & features)</label>
            <button type="button" onClick={handlePick} style={btnPrimary}>
              Select Photos
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={handleFiles}
            />
            {photos.length > 0 && (
              <ul style={{ marginTop: 8, fontSize: 13, paddingLeft: 16 }}>
                {photos.map((p, i) => (
                  <li key={i}>{p.name}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Sticky footer actions */}
          <div style={footer}>
            <button type="button" onClick={onClose} style={btnMuted}>
              Cancel
            </button>
            <button type="submit" disabled={busy} style={btnPrimary}>
              {busy ? "Saving…" : "Add Car"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* --- styling (mobile-first) --- */
const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: 10,
  zIndex: 1000,
};

const modal = {
  width: "min(560px, 96vw)",
  maxHeight: "92vh",
  background: "#0b1220",
  color: "#e5e7eb",
  borderRadius: 14,
  boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
  border: "1px solid #1f2937",
  display: "flex",
  flexDirection: "column",
};

const header = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 16px",
  borderBottom: "1px solid #1f2937",
};

const closeBtn = {
  border: "none",
  background: "#1f2937",
  color: "#e5e7eb",
  width: 32,
  height: 32,
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 18,
  lineHeight: 1,
};

const content = {
  padding: 16,
  paddingTop: 12,
  overflow: "auto",
  WebkitOverflowScrolling: "touch",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const lbl = { fontSize: 12, color: "#9ca3af", display: "block", marginBottom: 4, fontWeight: 700 };

const baseInput = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid #243041",
  background: "#0b1220",
  color: "#e5e7eb",
  outline: "none",
  fontSize: 16,
  minHeight: 44,
  boxSizing: "border-box",
};

const inp = baseInput;
const inpSelect = { ...baseInput, appearance: "none" };
const mb = { marginBottom: 2 };

const footer = {
  position: "sticky",
  bottom: 0,
  display: "flex",
  gap: 8,
  justifyContent: "flex-end",
  paddingTop: 8,
  marginTop: 4,
  background: "linear-gradient(to top, #0b1220, rgba(11,18,32,0.85) 60%, transparent)",
  borderTop: "1px solid #1f2937",
  paddingBottom: 4,
};

const btnBase = {
  border: "none",
  borderRadius: 10,
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 16,
};

const btnPrimary = { ...btnBase, background: "#2563EB", color: "#fff" };
const btnMuted = { ...btnBase, background: "#1f2937", color: "#e5e7eb" };
const linkDanger = { background: "none", border: "none", color: "#f87171", cursor: "pointer" };
