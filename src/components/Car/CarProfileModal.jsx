// src/components/Car/CarProfileModal.jsx
import { useEffect, useRef, useState } from "react";
import api from "../../lib/api";

// --- date helpers ---
const msPerDay = 1000 * 60 * 60 * 24;
const dateOnly = (d) => { const dt = new Date(d || Date.now()); dt.setHours(0,0,0,0); return dt; };
const dmy = (d) => { if (!d) return "-"; const dt = new Date(d); if (Number.isNaN(dt.getTime())) return "-"; const dd=String(dt.getDate()); const mm=String(dt.getMonth()+1); const yy=String(dt.getFullYear()).slice(-2); return `${dd}/${mm}/${yy}`; };
const fullDT = (d) => { if (!d) return "-"; const dt=new Date(d); if (Number.isNaN(dt.getTime())) return "-"; return `${dt.toLocaleDateString()} ${dt.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}`; };
const daysOpen = (start) => { const s=dateOnly(start).getTime(); const e=dateOnly(Date.now()).getTime(); const diff=Math.max(0,e-s); return Math.max(1, Math.floor(diff/msPerDay)+1); };
const daysClosed = (start,end) => { const s=dateOnly(start).getTime(); const e=dateOnly(end).getTime(); const diff=Math.max(0,e-s); return Math.max(1, Math.floor(diff/msPerDay)); };

export default function CarProfileModal({ open, car, onClose }) {
  const [tab, setTab] = useState("info"); // 'info' | 'photos' | 'history'
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [localCar, setLocalCar] = useState(car || null);
  const fileRef = useRef(null);

  // single form state for Info tab
  const [infoForm, setInfoForm] = useState({
    rego: "", make: "", model: "", series: "", readinessStatus: "", notes: "", checklist: "",
  });

  // per-field edit state (locked by default; double-tap to unlock)
  const [editable, setEditable] = useState({
    rego: false, make: false, model: false, series: false, readinessStatus: false, notes: false, checklist: false,
  });

  const carTitle = localCar ? `${localCar.rego || ""} ${localCar.make || ""} ${localCar.model || ""}`.trim() : "";

  useEffect(() => { setLocalCar(car || null); setTab("info"); }, [car]);

  useEffect(() => {
    if (!localCar) return;
    setInfoForm({
      rego: localCar.rego || "",
      make: localCar.make || "",
      model: localCar.model || "",
      series: localCar.series || "",
      readinessStatus: localCar.readinessStatus || "",
      notes: localCar.notes || "",
      checklist: Array.isArray(localCar.checklist) ? localCar.checklist.join(", ") : (localCar.checklist || ""),
    });
    setEditable({ rego:false, make:false, model:false, series:false, readinessStatus:false, notes:false, checklist:false });
  }, [localCar]);

  const fetchPhotos = async () => {
    if (!localCar?._id) return;
    setBusy(true);
    try {
      const res = await api.get(`/photos/${localCar._id}`);
      setPhotos(res.data?.data || []);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || err.message || "Error fetching photos");
    } finally { setBusy(false); }
  };

  const refreshCar = async () => {
    if (!localCar?._id) return;
    try {
      const res = await api.get("/cars");
      const fresh = (res.data?.data || []).find((c) => c._id === localCar._id);
      if (fresh) setLocalCar(fresh);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (open && localCar?._id) { refreshCar(); fetchPhotos(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, localCar?._id]);

  const handlePick = () => fileRef.current?.click();

  // UPDATED: enqueue selected files into the persistent upload queue
  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !localCar?._id) return;
    try {
      const { UploadQueue } = await import("../../lib/uploadQueue");
      for (const f of files) UploadQueue.enqueue({ carId: localCar._id, file: f, caption: "" });
      // Optimistic: refresh after a short delay so attached URLs appear
      setTimeout(fetchPhotos, 1500);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async (key) => {
    if (!window.confirm("Delete this photo?")) return;
    setBusy(true);
    try {
      await api.delete(`/photos/${localCar._id}?key=${encodeURIComponent(key)}`);
      await fetchPhotos();
    } catch (err) { console.error(err); alert(err.response?.data?.message || err.message || "Delete failed"); }
    finally { setBusy(false); }
  };

  const handleCaption = async (key, caption) => {
    setBusy(true);
    try {
      await api.patch(`/photos/${localCar._id}/caption`, { key, caption });
      await fetchPhotos();
    } catch (err) { console.error(err); alert(err.response?.data?.message || err.message || "Update failed"); }
    finally { setBusy(false); }
  };

  // --- Info tab handlers ---
  const onInfoChange = (e) => {
    const { name, value } = e.target;
    setInfoForm((p) => ({ ...p, [name]: value }));
  };

  const unlockField = (name) => setEditable((p) => ({ ...p, [name]: true }));
  const lockField = (name) => setEditable((p) => ({ ...p, [name]: false }));

  const resetInfo = () => {
    if (!localCar) return;
    setInfoForm({
      rego: localCar.rego || "",
      make: localCar.make || "",
      model: localCar.model || "",
      series: localCar.series || "",
      readinessStatus: localCar.readinessStatus || "",
      notes: localCar.notes || "",
      checklist: Array.isArray(localCar.checklist) ? localCar.checklist.join(", ") : (localCar.checklist || ""),
    });
    setEditable({ rego:false, make:false, model:false, series:false, readinessStatus:false, notes:false, checklist:false });
  };

  const saveInfo = async () => {
    if (!localCar?._id) return;
    setBusy(true);
    try {
      const checklistArr = (infoForm.checklist || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      await api.put(`/cars/${localCar._id}`, {
        rego: (infoForm.rego || "").trim(),
        make: (infoForm.make || "").trim(),
        model: (infoForm.model || "").trim(),
        series: (infoForm.series || "").trim(),
        readinessStatus: (infoForm.readinessStatus || "").trim(),
        notes: (infoForm.notes || "").trim(),
        checklist: checklistArr.length ? checklistArr : "",
      });

      await refreshCar();
      alert("Info saved");
      setEditable({ rego:false, make:false, model:false, series:false, readinessStatus:false, notes:false, checklist:false });
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || err.message || "Save failed");
    } finally { setBusy(false); }
  };

  if (!open) return null;

  const history = Array.isArray(localCar?.history) ? localCar.history : [];

  return (
    <div style={overlayStyle}>
      {/* extra CSS for responsive layout */}
      <style>{responsiveCss}</style>

      <div style={modalShell}>
        {/* Sticky header */}
        <div className="cpm-header">
          <div>
            <div className="cpm-title">Car Profile</div>
            <div className="cpm-sub">{carTitle || "—"}</div>
          </div>
          <div className="cpm-actions">
            {tab === "photos" ? (
              <button onClick={fetchPhotos} className="btn btn--muted">Refresh</button>
            ) : (
              <button onClick={refreshCar} className="btn btn--muted">Refresh</button>
            )}
            <button onClick={() => onClose(false)} className="cpm-close" aria-label="Close">×</button>
          </div>
        </div>

        {/* Sticky tabs on mobile */}
        <div className="cpm-tabs">
          <button className={`tab ${tab === "info" ? "tab--active" : ""}`} onClick={() => setTab("info")}>Info</button>
          <button className={`tab ${tab === "photos" ? "tab--active" : ""}`} onClick={() => setTab("photos")}>Photos</button>
          <button className={`tab ${tab === "history" ? "tab--active" : ""}`} onClick={() => setTab("history")}>History</button>
        </div>

        {/* Scrollable content */}
        <div className="cpm-body">
          {tab === "info" && (
            <div className="info-grid">
              {/* Read-only meta */}
              <InfoItem label="Created" value={fullDT(localCar?.dateCreated || localCar?.createdAt)} />
              <InfoItem label="Updated" value={fullDT(localCar?.updatedAt)} />

              {/* Editable fields (locked by default; double-tap to edit) */}
              <EditableField
                label="Rego" name="rego" value={infoForm.rego}
                editable={editable.rego} onDblClick={() => unlockField("rego")}
                onChange={onInfoChange} onBlur={() => lockField("rego")}
              />

              <EditableField
                label="Make" name="make" value={infoForm.make}
                editable={editable.make} onDblClick={() => unlockField("make")}
                onChange={onInfoChange} onBlur={() => lockField("make")}
              />

              <EditableField
                label="Model" name="model" value={infoForm.model}
                editable={editable.model} onDblClick={() => unlockField("model")}
                onChange={onInfoChange} onBlur={() => lockField("model")}
              />

              <EditableField
                label="Series" name="series" value={infoForm.series}
                editable={editable.series} onDblClick={() => unlockField("series")}
                onChange={onInfoChange} onBlur={() => lockField("series")}
              />

              <EditableField
                label="Readiness" name="readinessStatus" value={infoForm.readinessStatus}
                editable={editable.readinessStatus} onDblClick={() => unlockField("readinessStatus")}
                onChange={onInfoChange} onBlur={() => lockField("readinessStatus")}
                long
              />

              <EditableField
                label="Checklist" name="checklist" value={infoForm.checklist}
                editable={editable.checklist} onDblClick={() => unlockField("checklist")}
                onChange={onInfoChange} onBlur={() => lockField("checklist")}
                long placeholder="Tyres, Service, Detail"
              />

              <EditableTextArea
                label="Notes" name="notes" value={infoForm.notes}
                editable={editable.notes} onDblClick={() => unlockField("notes")}
                onChange={onInfoChange} onBlur={() => lockField("notes")}
                long placeholder="Add any notes…"
              />

              <div className="info-actions">
                <button className="btn btn--muted" onClick={resetInfo} disabled={busy}>Reset</button>
                <button className="btn btn--primary" onClick={saveInfo} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
              </div>
            </div>
          )}

          {tab === "photos" && (
            <>
              <div className="row mb8">
                <button onClick={handlePick} className="btn btn--primary">Upload Photos</button>
                <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleFiles} />
                {busy && <span className="muted">Working…</span>}
              </div>

              <div className="photos-wrap">
                {photos.length === 0 ? (
                  <div className="muted">{busy ? "Loading photos…" : "No photos yet."}</div>
                ) : (
                  <div className="photo-grid">
                    {photos.map((p) => (
                      <div key={p.key} className="photo-card">
                        <a href={p.url} target="_blank" rel="noreferrer">
                          <img src={p.url} alt={p.caption || "photo"} className="photo-img" />
                        </a>
                        <input
                          type="text"
                          placeholder="Caption"
                          defaultValue={p.caption || ""}
                          onBlur={(e) => {
                            const newCap = e.target.value || "";
                            if (newCap !== (p.caption || "")) handleCaption(p.key, newCap);
                          }}
                          className="caption-input"
                        />
                        <button onClick={() => handleDelete(p.key)} className="btn btn--danger w100">
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {tab === "history" && (
            <div className="history-wrap">
              <div className="section-title">Location History</div>
              {history.length === 0 ? (
                <div className="muted">No history recorded.</div>
              ) : (
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>#</th><th>Location</th><th>Start</th><th>End</th><th>Days</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h, idx) => {
                      const isOpen = !h.endDate;
                      const days = isOpen ? daysOpen(h.startDate) : (h.days || daysClosed(h.startDate, h.endDate));
                      return (
                        <tr key={idx}>
                          <td>{idx + 1}</td>
                          <td>{h.location || "-"}</td>
                          <td>{dmy(h.startDate)}</td>
                          <td>{isOpen ? "Still There" : dmy(h.endDate)}</td>
                          <td>{days} Days</td>
                          <td><span className={`chip ${isOpen ? "chip--open" : "chip--closed"}`}>{isOpen ? "Open" : "Closed"}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Reusable blocks ---------- */
function InfoItem({ label, value, long = false }) {
  return (
    <div className={`card ${long ? "span-2" : ""}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

function EditableField({ label, name, value, editable, onDblClick, onChange, onBlur, long = false, placeholder = "" }) {
  return (
    <div className={`card ${long ? "span-2" : ""} ${editable ? "is-editing" : ""}`} onDoubleClick={onDblClick} title={editable ? "" : "Double-click to edit"}>
      <div className="label">{label}</div>
      <input
        type="text"
        name={name}
        value={value}
        onChange={editable ? onChange : undefined}
        onBlur={editable ? onBlur : undefined}
        readOnly={!editable}
        className="input"
        placeholder={placeholder}
      />
      {!editable && <div className="hint">Double-click to edit</div>}
    </div>
  );
}

function EditableTextArea({ label, name, value, editable, onDblClick, onChange, onBlur, long = false, placeholder = "" }) {
  return (
    <div className={`card ${long ? "span-2" : ""} ${editable ? "is-editing" : ""}`} onDoubleClick={onDblClick} title={editable ? "" : "Double-click to edit"}>
      <div className="label">{label}</div>
      <textarea
        name={name}
        value={value}
        onChange={editable ? onChange : undefined}
        onBlur={editable ? onBlur : undefined}
        readOnly={!editable}
        className="input textarea"
        placeholder={placeholder}
      />
      {!editable && <div className="hint">Double-click to edit</div>}
    </div>
  );
}

/* ---------- Inline styles & CSS ---------- */
const overlayStyle = {
  position:"fixed", inset:0, background:"rgba(0,0,0,0.45)",
  display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000,
};

const modalShell = {
  width:"min(1100px, 96vw)",
  maxHeight:"94vh",
  background:"#0b1220", color:"#e5e7eb",
  borderRadius:14, boxShadow:"0 20px 60px rgba(0,0,0,0.35)",
  border:"1px solid #1f2937",
  display:"flex", flexDirection:"column",
  overflow:"hidden",
};

const responsiveCss = `
  .btn{border:1px solid #243041;border-radius:10px;padding:8px 12px;font-weight:600;cursor:pointer;background:#1f2937;color:#e5e7eb;}
  .btn--muted{background:#1f2937;}
  .btn--primary{background:#2563EB;color:#fff;border-color:transparent;}
  .btn--danger{background:#DC2626;color:#fff;border-color:transparent;}
  .w100{width:100%;}
  .muted{color:#9ca3af}
  .mb8{margin-bottom:8px;}

  .cpm-header{
    position:sticky; top:0; z-index:2;
    display:flex; align-items:center; justify-content:space-between;
    padding:12px 14px; background:#0b1220; border-bottom:1px solid #1f2937;
  }
  .cpm-title{font-weight:800;font-size:18px;}
  .cpm-sub{font-size:13px;color:#9ca3af;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60vw;}
  .cpm-actions{display:flex;gap:8px;align-items:center;}
  .cpm-close{border:none;background:#1f2937;color:#e5e7eb;width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:18px;line-height:1;}

  .cpm-tabs{
    position:sticky; top:56px; z-index:1;
    display:flex; gap:6px; padding:8px 12px;
    background:#0b1220; border-bottom:1px solid #1f2937;
  }
  .tab{border:0;padding:8px 12px;border-radius:10px;background:#0f172a;color:#cbd5e1;font-weight:700;cursor:pointer;}
  .tab--active{background:#1f2937;color:#fff;}

  .cpm-body{padding:12px; overflow:auto; overscroll-behavior:contain;}

  /* Info grid */
  .info-grid{
    display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px;
  }
  .card{
    background:#0f172a;border:1px solid #1f2937;border-radius:10px;padding:12px;min-width:0;
  }
  .card.is-editing{box-shadow:inset 0 0 0 1px #334155}
  .span-2{grid-column:span 2;}
  .label{font-size:12px;color:#9ca3af;font-weight:700;margin-bottom:6px;}
  .value{font-size:14px;word-break:break-word;}
  .input{
    width:100%; box-sizing:border-box; padding:10px 12px; border-radius:10px;
    border:1px solid #243041; background:#0b1220; color:#e5e7eb; outline:none;
  }
  .textarea{min-height:120px; resize:vertical;}
  .hint{font-size:11px;color:#9ca3af;margin-top:6px;}

  .info-actions{
    grid-column:span 2; display:flex; justify-content:flex-end; gap:8px; margin-top:2px;
    position:sticky; bottom:0; background:linear-gradient(180deg, rgba(11,18,32,0) 0%, #0b1220 20%);
    padding-top:12px; padding-bottom:4px;
  }

  /* Photos */
  .photos-wrap{ max-height:calc(94vh - 190px); overflow:auto; border-top:1px solid #1f2937; padding-top:10px; }
  .photo-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:12px; }
  .photo-card{ border:1px solid #1f2937; border-radius:10px; padding:10px; background:#0f172a; display:flex; flex-direction:column; gap:8px; }
  .photo-img{ width:100%; height:160px; object-fit:cover; border-radius:8px; display:block; }
  .caption-input{ width:100%; padding:8px 10px; border-radius:8px; border:1px solid #243041; background:#0b1220; color:#e5e7eb; outline:none; box-sizing:border-box; }

  /* History */
  .history-wrap{ max-height:calc(94vh - 170px); overflow:auto; }
  .section-title{ font-weight:700; margin-bottom:8px; }
  .history-table{ width:100%; border-collapse:collapse; font-size:14px; }
  .history-table th, .history-table td{ padding:8px; border-bottom:1px solid #1f2937; text-align:left; }
  .chip{display:inline-block;padding:4px 8px;border-radius:999px;font-weight:700;}
  .chip--open{ background:#22c55e1f; color:#22c55e; }
  .chip--closed{ background:#6b72801a; color:#9ca3af; }

  /* Mobile tweaks */
  @media (max-width: 720px){
    .cpm-title{font-size:16px;}
    .cpm-tabs{ top:52px; }
    .info-grid{ grid-template-columns:1fr; }
    .span-2{ grid-column:span 1; }
    .photos-wrap, .history-wrap{ max-height:calc(94vh - 170px); }
  }
`;
