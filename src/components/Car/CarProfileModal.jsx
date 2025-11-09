import { useEffect, useRef, useState } from "react";
import api from "../../lib/api";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

/* ---------- Utility helpers ---------- */
const msPerDay = 1000 * 60 * 60 * 24;
const dateOnly = (d) => {
  const dt = new Date(d || Date.now());
  dt.setHours(0, 0, 0, 0);
  return dt;
};
const dmy = (d) =>
  !d
    ? "-"
    : (() => {
        const dt = new Date(d);
        return `${dt.getDate()}/${dt.getMonth() + 1}/${String(
          dt.getFullYear()
        ).slice(-2)}`;
      })();
const fullDT = (d) => (d ? new Date(d).toLocaleString() : "-");
const daysClosed = (s, e) =>
  Math.max(1, Math.floor((dateOnly(e) - dateOnly(s)) / msPerDay));

/* ---------- Small reusable fields ---------- */
function EditableField({
  label,
  name,
  value,
  editable,
  long,
  onDblClick,
  onChange,
  onBlur,
}) {
  return (
    <div className={`field ${long ? "field--long" : ""}`}>
      <label>{label}</label>
      {editable ? (
        <input
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          autoFocus
          className="input"
        />
      ) : (
        <div
          className="static"
          onDoubleClick={onDblClick}
          title="Double-click to edit"
        >
          {value || "—"}
        </div>
      )}
    </div>
  );
}

function EditableTextArea({
  label,
  name,
  value,
  editable,
  long,
  onDblClick,
  onChange,
  onBlur,
}) {
  return (
    <div className={`field ${long ? "field--long" : ""}`}>
      <label>{label}</label>
      {editable ? (
        <textarea
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          rows={3}
          autoFocus
          className="textarea"
        />
      ) : (
        <div
          className="static static--multi"
          onDoubleClick={onDblClick}
          title="Double-click to edit"
        >
          {value || "—"}
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="static">{value}</div>
    </div>
  );
}

/* ---------- Main ---------- */
export default function CarProfileModal({ open, car, onClose }) {
  const [tab, setTab] = useState("info");
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(-1);
  const [localCar, setLocalCar] = useState(car || null);
  const fileRef = useRef(null);

  const [infoForm, setInfoForm] = useState({
    rego: "",
    make: "",
    model: "",
    series: "",
    readinessStatus: "",
    notes: "",
    checklist: "",
  });
  const [editable, setEditable] = useState({
    rego: false,
    make: false,
    model: false,
    series: false,
    readinessStatus: false,
    notes: false,
    checklist: false,
  });

  const carTitle = localCar
    ? `${localCar.rego || ""} ${localCar.make || ""} ${localCar.model || ""}`.trim()
    : "";

  /* ---------- Effects ---------- */
  useEffect(() => {
    setLocalCar(car || null);
    setTab("info");
  }, [car]);

  useEffect(() => {
    if (!localCar) return;
    setInfoForm({
      rego: localCar.rego || "",
      make: localCar.make || "",
      model: localCar.model || "",
      series: localCar.series || "",
      readinessStatus: localCar.readinessStatus || "",
      notes: localCar.notes || "",
      checklist: Array.isArray(localCar.checklist)
        ? localCar.checklist.join(", ")
        : localCar.checklist || "",
    });
    setEditable({
      rego: false,
      make: false,
      model: false,
      series: false,
      readinessStatus: false,
      notes: false,
      checklist: false,
    });
  }, [localCar]);

  /* ---------- API helpers ---------- */
  const fetchPhotos = async () => {
    if (!localCar?._id) return;
    try {
      const res = await api.get(`/photos/${localCar._id}`);
      setPhotos(res.data?.data || []);
    } catch (e) {
      console.error("fetchPhotos error", e);
    }
  };

  const refreshCar = async () => {
    if (!localCar?._id) return;
    try {
      const res = await api.get("/cars");
      const fresh = (res.data?.data || []).find((c) => c._id === localCar._id);
      if (fresh) setLocalCar(fresh);
    } catch (e) {
      console.error("refreshCar error", e);
    }
  };

  useEffect(() => {
    if (open && localCar?._id) {
      refreshCar();
      fetchPhotos();
    }
  }, [open, localCar?._id]);

  /* ---------- Photo handlers ---------- */
  const handlePick = () => fileRef.current?.click();
  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !localCar?._id) return;
    const { UploadQueue } = await import("../../lib/uploadQueue");
    for (const f of files)
      UploadQueue.enqueue({ carId: localCar._id, file: f, caption: "" });
    setTimeout(fetchPhotos, 2000);
    fileRef.current.value = "";
  };

  const handleDelete = async (key) => {
    try {
      await api.delete(`/photos/${localCar._id}?key=${encodeURIComponent(key)}`);
      setPhotos((p) => p.filter((ph) => ph.key !== key));
    } catch (e) {
      console.error("handleDelete", e);
    }
  };

  const handleCaption = async (key, caption) => {
    try {
      await api.patch(`/photos/${localCar._id}/caption`, { key, caption });
      setPhotos((p) =>
        p.map((ph) => (ph.key === key ? { ...ph, caption } : ph))
      );
    } catch (e) {
      console.error("handleCaption", e);
    }
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const reordered = Array.from(photos);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setPhotos(reordered);
  };

  const savePhotoOrder = async () => {
    if (!localCar?._id) return;
    try {
      const body = { photos: photos.map((p) => ({ key: p.key, caption: p.caption || "" })) };
      console.log("🔼 savePhotoOrder body", body);
      await api.put(`/photos/reorder/${localCar._id}`, body);
      alert("✅ Photo order saved!");
    } catch (e) {
      console.error("💥 savePhotoOrder", e);
      alert("❌ Failed to save photo order");
    }
  };

  const handleClose = () => onClose(false);

  /* ---------- Info handlers ---------- */
  const onInfoChange = (e) => setInfoForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  const unlock = (n) => setEditable((p) => ({ ...p, [n]: true }));
  const lock = (n) => setEditable((p) => ({ ...p, [n]: false }));

  const saveInfo = async () => {
    if (!localCar?._id) return;
    setBusy(true);
    try {
      const checklistArr = (infoForm.checklist || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      await api.put(`/cars/${localCar._id}`, {
        rego: infoForm.rego.trim(),
        make: infoForm.make.trim(),
        model: infoForm.model.trim(),
        series: infoForm.series.trim(),
        readinessStatus: infoForm.readinessStatus.trim(),
        notes: infoForm.notes.trim(),
        checklist: checklistArr.length ? checklistArr : "",
      });
      await refreshCar();
      alert("Info saved successfully");
      setEditable({
        rego: false,
        make: false,
        model: false,
        series: false,
        readinessStatus: false,
        notes: false,
        checklist: false,
      });
    } catch (e) {
      console.error("saveInfo", e);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;
  const history = Array.isArray(localCar?.history) ? localCar.history : [];

  /* ---------- Render ---------- */
  return (
    <div className="overlay">
      <style>{css}</style>
      <div className="modal">
        <div className="header">
          <div>
            <div className="title">Car Profile</div>
            <div className="sub">{carTitle || "—"}</div>
          </div>
          <div className="actions">
            <button className="btn btn--muted" onClick={refreshCar}>
              Refresh
            </button>
            <button className="close" onClick={handleClose}>×</button>
          </div>
        </div>

        <div className="tabs">
          <button className={`tab ${tab === "info" ? "tab--active" : ""}`} onClick={() => setTab("info")}>Info</button>
          <button className={`tab ${tab === "photos" ? "tab--active" : ""}`} onClick={() => setTab("photos")}>Photos</button>
          <button className={`tab ${tab === "history" ? "tab--active" : ""}`} onClick={() => setTab("history")}>History</button>
        </div>

        <div className="body">
          {tab === "info" && (
            <div className="info-grid">
              <InfoItem label="Created" value={fullDT(localCar?.createdAt)} />
              <InfoItem label="Updated" value={fullDT(localCar?.updatedAt)} />
              <EditableField label="Rego" name="rego" value={infoForm.rego} editable={editable.rego} onDblClick={() => unlock("rego")} onChange={onInfoChange} onBlur={() => lock("rego")} />
              <EditableField label="Make" name="make" value={infoForm.make} editable={editable.make} onDblClick={() => unlock("make")} onChange={onInfoChange} onBlur={() => lock("make")} />
              <EditableField label="Model" name="model" value={infoForm.model} editable={editable.model} onDblClick={() => unlock("model")} onChange={onInfoChange} onBlur={() => lock("model")} />
              <EditableField label="Series" name="series" value={infoForm.series} editable={editable.series} onDblClick={() => unlock("series")} onChange={onInfoChange} onBlur={() => lock("series")} />
              <EditableField label="Readiness" name="readinessStatus" value={infoForm.readinessStatus} editable={editable.readinessStatus} onDblClick={() => unlock("readinessStatus")} onChange={onInfoChange} onBlur={() => lock("readinessStatus")} long />
              <EditableField label="Checklist" name="checklist" value={infoForm.checklist} editable={editable.checklist} onDblClick={() => unlock("checklist")} onChange={onInfoChange} onBlur={() => lock("checklist")} long />
              <EditableTextArea label="Notes" name="notes" value={infoForm.notes} editable={editable.notes} onDblClick={() => unlock("notes")} onChange={onInfoChange} onBlur={() => lock("notes")} long />
              <div className="info-actions">
                <button className="btn btn--muted" onClick={refreshCar}>Reset</button>
                <button className="btn btn--primary" onClick={saveInfo} disabled={busy}>{busy ? "Saving..." : "Save"}</button>
              </div>
            </div>
          )}

          {tab === "photos" && (
            <div className="photo-tab">
              <input ref={fileRef} type="file" multiple hidden onChange={handleFiles} />
              <div className="photo-toolbar">
                <button className="btn btn--primary" onClick={handlePick}>Upload Photos</button>
                <button className="btn btn--muted" onClick={fetchPhotos}>Refresh</button>
                <button className="btn btn--primary" onClick={savePhotoOrder}>Save Order</button>
              </div>
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="photos">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="photo-grid">
                      {photos.map((ph, i) => (
                        <Draggable key={ph.key} draggableId={ph.key} index={i}>
                          {(prov) => (
                            <div ref={prov.innerRef} {...prov.draggableProps} {...prov.dragHandleProps} className="photo-item">
                              <img src={ph.url} alt="" onClick={() => setViewerIndex(i)} />
                              <input className="caption" placeholder="Add caption" value={ph.caption || ""} onChange={(e) => handleCaption(ph.key, e.target.value)} />
                              <button className="del" onClick={() => handleDelete(ph.key)}>×</button>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
              <Lightbox open={viewerIndex >= 0} index={viewerIndex} close={() => setViewerIndex(-1)} slides={photos.map((p) => ({ src: p.url }))} />
            </div>
          )}

          {tab === "history" && (
            <table className="history-table">
              <thead><tr><th>Location</th><th>Start</th><th>End</th><th>Days</th></tr></thead>
              <tbody>
                {(!history.length) ? (
                  <tr><td colSpan={4} className="empty">No history</td></tr>
                ) : (
                  history.map((h, i) => (
                    <tr key={i}>
                      <td>{h.location || "—"}</td>
                      <td>{dmy(h.startDate)}</td>
                      <td>{h.endDate ? dmy(h.endDate) : "—"}</td>
                      <td>{h.endDate ? daysClosed(h.startDate, h.endDate) : "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- CSS ---------- */
const css = `
:root { color-scheme: dark; }
.overlay {
  position: fixed; inset: 0;
  z-index: 80;
  display:flex; align-items:center; justify-content:center;
  background: rgba(0,0,0,.55);
  backdrop-filter: blur(3px);
}
.modal {
  width: min(960px, calc(100vw - 32px));
  max-height: 90vh;
  background:#0F172A; color:#E5E7EB;
  border:1px solid #1F2937; border-radius:14px;
  box-shadow:0 20px 60px rgba(0,0,0,.45);
  display:flex; flex-direction:column;
  overflow:hidden;
  animation: fadeUp .12s ease-out;
}
@keyframes fadeUp { from{transform:translateY(8px);opacity:.8} to{transform:none;opacity:1} }

.header {
  display:flex; align-items:center; justify-content:space-between;
  padding:14px 18px; border-bottom:1px solid #1F2937;
  background:#111827;
}
.title { font-size:18px; font-weight:600; }
.sub { font-size:12px; color:#9CA3AF; }
.close {
  background:#111827; color:#E5E7EB;
  border:1px solid #243041;
  width:32px; height:32px;
  border-radius:10px; cursor:pointer;
}
.actions { display:flex; align-items:center; gap:8px; }

.tabs {
  display:flex;
  background:#0B1220;
  border-bottom:1px solid #1F2937;
}
.tab {
  flex:1; padding:10px 12px;
  background:transparent; border:none;
  color:#9CA3AF; cursor:pointer;
  font-weight:500; transition:all .2s;
}
.tab:hover { color:#fff; background:#1E293B; }
.tab--active {
  background:#1E3A8A; color:#fff; font-weight:600;
}

.body {
  padding:16px;
  overflow-y:auto;
}

.info-grid {
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(260px,1fr));
  gap:14px;
}
.field label {
  font-size:12px;
  color:#9CA3AF;
  margin-bottom:4px;
  display:block;
}
.static, .input, .textarea {
  width:100%;
  padding:10px 12px;
  border-radius:10px;
  background:#0B1220;
  border:1px solid #243041;
  color:#E5E7EB;
  font-size:13px;
  transition:border-color .2s, box-shadow .2s;
}
.input:focus, .textarea:focus {
  border-color:#2563EB;
  box-shadow:0 0 0 3px rgba(37,99,235,.25);
}
.static { cursor:default; user-select:none; min-height:34px; }
.textarea { resize:vertical; min-height:70px; }

.info-actions {
  grid-column:1/-1;
  text-align:right;
  margin-top:12px;
  display:flex; justify-content:flex-end; gap:10px;
}
.btn {
  border:1px solid transparent;
  border-radius:12px;
  padding:10px 14px;
  font-weight:600;
  cursor:pointer;
  transition:background .2s, opacity .2s;
}
.btn--primary { background:#2563EB; color:#fff; }
.btn--muted { background:#111827; color:#E5E7EB; border:1px solid #243041; }
.btn:disabled { opacity:.6; cursor:default; }

.photo-toolbar {
  display:flex; justify-content:flex-end; gap:10px; margin-bottom:10px;
}
.photo-grid {
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(150px,1fr));
  gap:10px;
}
.photo-item {
  position:relative;
  background:#111827;
  border:1px solid #243041;
  border-radius:10px;
  overflow:hidden;
}
.photo-item img {
  width:100%; height:120px; object-fit:cover; cursor:pointer;
}
.caption {
  width:100%;
  border:none;
  background:#0B1220;
  color:#E5E7EB;
  font-size:12px;
  padding:6px 8px;
  border-top:1px solid #1F2937;
}
.del {
  position:absolute;
  top:6px; right:6px;
  width:24px; height:24px;
  border:none;
  border-radius:50%;
  background:rgba(0,0,0,0.5);
  color:#fff; cursor:pointer;
  font-size:16px; line-height:1;
}
.history-table {
  width:100%; border-collapse:collapse; font-size:13px;
}
.history-table th, .history-table td {
  padding:8px 10px; border-bottom:1px solid #1F2937;
}
.history-table th {
  background:#111827; color:#E5E7EB; text-align:left;
}
.history-table tr:hover td { background:#0B1220; }
.history-table .empty { text-align:center; color:#6B7280; padding:16px; }
`;
