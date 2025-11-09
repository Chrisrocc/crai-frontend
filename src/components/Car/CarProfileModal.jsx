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
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
.modal {
  background: #1a1a1a;
  color: #fff;
  width: 95%;
  max-width: 1024px;
  border-radius: 10px;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.6);
  overflow: hidden;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #222;
  border-bottom: 1px solid #333;
}
.title {
  font-size: 18px;
  font-weight: 600;
}
.sub {
  font-size: 13px;
  color: #aaa;
}
.close {
  background: none;
  border: none;
  color: #aaa;
  font-size: 22px;
  cursor: pointer;
}
.tabs {
  display: flex;
  border-bottom: 1px solid #333;
}
.tab {
  flex: 1;
  text-align: center;
  padding: 8px;
  background: #191919;
  color: #ccc;
  cursor: pointer;
  border: none;
}
.tab--active {
  background: #333;
  color: #fff;
  font-weight: 600;
}
.body {
  padding: 12px;
  max-height: 75vh;
  overflow-y: auto;
}
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
}
.field label {
  font-size: 12px;
  color: #aaa;
  margin-bottom: 4px;
}
.static {
  padding: 6px 8px;
  background: #111;
  border: 1px solid #333;
  border-radius: 4px;
  min-height: 28px;
}
.input,
.textarea {
  background: #111;
  border: 1px solid #0078ff;
  color: #fff;
  border-radius: 4px;
  padding: 6px 8px;
}
.info-actions {
  grid-column: 1 / -1;
  text-align: right;
  margin-top: 12px;
}
.btn {
  border: none;
  border-radius: 4px;
  cursor: pointer;
  padding: 6px 12px;
  font-size: 13px;
}
.btn--muted {
  background: #333;
  color: #ccc;
}
.btn--primary {
  background: #0078ff;
  color: #fff;
}
.photo-toolbar {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
  margin-bottom: 8px;
}
.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
}
.photo-item {
  position: relative;
}
.photo-item img {
  width: 100%;
  height: 100px;
  object-fit: cover;
  border-radius: 6px;
  cursor: pointer;
}
.caption {
  width: 100%;
  background: #111;
  border: none;
  color: #fff;
  font-size: 12px;
  padding: 4px 6px;
  margin-top: 4px;
  border-radius: 4px;
}
.del {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.5);
  border: none;
  color: #fff;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  cursor: pointer;
}
.history-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.history-table th,
.history-table td {
  border: 1px solid #333;
  padding: 6px 8px;
  text-align: left;
}
.history-table th {
  background: #222;
}
.history-table .empty {
  text-align: center;
  color: #777;
}
`;
