// src/components/Cars/CarFormModal.jsx
import { useState, useEffect, useRef } from "react";
import api from "../../lib/api";
 // uses VITE_API_URL base + withCredentials

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
      const carId = data?.data?._id || data?.data?.id;
      if (!carId) throw new Error("Car created but no id returned");

      // 2) upload photos via presigned URLs, then attach to car
      for (const f of photos) {
        const pres = await api.post("/photos/presign", {
          carId,
          filename: f.name,
          contentType: f.type || "application/octet-stream",
        });
        const { key, uploadUrl } = pres.data?.data || {};
        if (!uploadUrl || !key) throw new Error("Failed to get upload URL");

        await fetch(uploadUrl, {
          method: "PUT",
          body: f,
          headers: { "Content-Type": f.type || "application/octet-stream" },
        });

        await api.post("/photos/attach", { carId, key, caption: "" });
      }

      onSave?.();
      onClose?.();
    } catch (err) {
      // Normalize the error message a bit
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
    <div style={overlay}>
      <div style={modal}>
        <button onClick={onClose} style={closeBtn} aria-label="Close">
          ×
        </button>
        <h2>Add New Car</h2>

        <form onSubmit={handleSubmit}>
          {/* Standard fields */}
          {["rego", "make", "model", "location", "year", "description", "notes"].map((field) => (
            <div style={mb} key={field}>
              <label style={lbl}>{field[0].toUpperCase() + field.slice(1)}</label>
              <input
                type="text"
                name={field}
                value={formData[field]}
                onChange={handleChange}
                required={field === "rego"}
                style={inp}
                placeholder={field === "rego" ? "ABC123" : ""}
              />
            </div>
          ))}

          <div style={mb}>
            <label style={lbl}>Stage</label>
            <select name="stage" value={formData.stage} onChange={handleChange} style={inp}>
              <option>In Works</option>
              <option>In Works/Online</option>
              <option>Online</option>
              <option>Sold</option>
            </select>
          </div>

          {/* --- Checklist section --- */}
          <div style={{ ...mb, borderTop: "1px solid #444", paddingTop: 10 }}>
            <label style={lbl}>Checklist Items</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                style={{ ...inp, flex: 1 }}
                placeholder="e.g. Spare key"
              />
              <button type="button" onClick={addChecklistItem} className="btn btn--primary">
                Add
              </button>
            </div>
            {formData.checklist.length > 0 && (
              <ul style={{ marginTop: 8, fontSize: 12 }}>
                {formData.checklist.map((item, i) => (
                  <li
                    key={i}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  >
                    <span>{item}</span>
                    <button
                      type="button"
                      onClick={() => removeChecklistItem(item)}
                      style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer" }}
                      aria-label={`Remove ${item}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Photo uploader */}
          <div style={{ ...mb, borderTop: "1px solid #444", paddingTop: 10 }}>
            <label style={lbl}>Photos (auto-analysis for damage & features)</label>
            <button type="button" className="btn btn--primary" onClick={handlePick}>
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
              <ul style={{ marginTop: 8, fontSize: 12 }}>
                {photos.map((p, i) => (
                  <li key={i}>{p.name}</li>
                ))}
              </ul>
            )}
          </div>

          <button type="submit" disabled={busy} className="btn btn--primary">
            {busy ? "Saving…" : "Add Car"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* --- styling --- */
const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
};
const modal = {
  width: "min(500px,94vw)",
  background: "#0b1220",
  color: "#e5e7eb",
  borderRadius: 14,
  boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
  padding: 20,
  position: "relative",
};
const closeBtn = {
  position: "absolute",
  right: 20,
  top: 20,
  border: "none",
  background: "#1f2937",
  color: "#e5e7eb",
  width: 32,
  height: 32,
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 18,
};
const lbl = { fontSize: 12, color: "#9ca3af", display: "block", marginBottom: 4, fontWeight: 700 };
const inp = {
  width: "100%",
  padding: 8,
  borderRadius: 8,
  border: "1px solid #243041",
  background: "#0b1220",
  color: "#e5e7eb",
  outline: "none",
};
const mb = { marginBottom: 12 };
