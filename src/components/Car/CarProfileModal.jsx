// src/components/Car/CarProfileModal.jsx
import { useEffect, useRef, useState } from "react";
import api from "../../lib/api"; // ✅ use configured axios instance

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
  const [localCar, setLocalCar] = useState(car || null); // fresh copy for info/history
  const fileRef = useRef(null);

  // single form state for Info tab
  const [infoForm, setInfoForm] = useState({
    rego: "", make: "", model: "", series: "", readinessStatus: "", notes: "", checklist: "",
  });

  // per-field edit state: locked by default; double-click to unlock
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
    // lock all fields on load
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
      // list => find (compatible with your backend)
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

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !localCar?._id) return;
    setBusy(true);
    try {
      for (const f of files) {
        const pres = await api.post("/photos/presign", {
          carId: localCar._id, filename: f.name, contentType: f.type || "application/octet-stream",
        });
        const { key, uploadUrl } = pres.data?.data || {};
        if (!key || !uploadUrl) throw new Error("Invalid presign response");
        await fetch(uploadUrl, { method: "PUT", body: f, headers: { "Content-Type": f.type || "application/octet-stream" } });
        await api.post("/photos/attach", { carId: localCar._id, key, caption: "" });
      }
      await fetchPhotos();
      alert("Uploaded!");
    } catch (err) {
      console.error(err); alert(err.response?.data?.message || err.message || "Upload failed");
    } finally {
      setBusy(false);
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

      // Use PUT as in your working list editor route
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
      // relock fields after save
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
      <div style={modalStyle}>
        {/* Header */}
        <div style={headerRow}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Car Profile</div>
            <div style={{ fontSize: 13, color: "#9ca3af" }}>{carTitle || "—"}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {tab === "photos" ? (
              <button onClick={fetchPhotos} className="btn btn--muted">Refresh</button>
            ) : (
              <button onClick={refreshCar} className="btn btn--muted">Refresh</button>
            )}
            <button onClick={() => onClose(false)} style={closeBtnStyle} aria-label="Close">×</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={tabsWrap}>
          <button className={`tab ${tab === "info" ? "tab--active" : ""}`} onClick={() => setTab("info")}>Info</button>
          <button className={`tab ${tab === "photos" ? "tab--active" : ""}`} onClick={() => setTab("photos")}>Photos</button>
          <button className={`tab ${tab === "history" ? "tab--active" : ""}`} onClick={() => setTab("history")}>History</button>
        </div>

        {/* Content */}
        <div style={{ paddingTop: 8 }}>
          {tab === "info" && (
            <div style={infoGrid}>
              {/* Read-only meta */}
              <InfoItem label="Created" value={fullDT(localCar?.dateCreated || localCar?.createdAt)} />
              <InfoItem label="Updated" value={fullDT(localCar?.updatedAt)} />

              {/* Editable fields (locked by default; double-click to edit) */}
              <EditableField
                label="Rego"
                name="rego"
                value={infoForm.rego}
                editable={editable.rego}
                onDblClick={() => unlockField("rego")}
                onChange={onInfoChange}
                onBlur={() => lockField("rego")}
              />

              <EditableField
                label="Make"
                name="make"
                value={infoForm.make}
                editable={editable.make}
                onDblClick={() => unlockField("make")}
                onChange={onInfoChange}
                onBlur={() => lockField("make")}
              />

              <EditableField
                label="Model"
                name="model"
                value={infoForm.model}
                editable={editable.model}
                onDblClick={() => unlockField("model")}
                onChange={onInfoChange}
                onBlur={() => lockField("model")}
              />

              <EditableField
                label="Series"
                name="series"
                value={infoForm.series}
                editable={editable.series}
                onDblClick={() => unlockField("series")}
                onChange={onInfoChange}
                onBlur={() => lockField("series")}
              />

              <EditableField
                label="Readiness"
                name="readinessStatus"
                value={infoForm.readinessStatus}
                editable={editable.readinessStatus}
                onDblClick={() => unlockField("readinessStatus")}
                onChange={onInfoChange}
                onBlur={() => lockField("readinessStatus")}
              />

              <EditableField
                label="Checklist"
                name="checklist"
                value={infoForm.checklist}
                editable={editable.checklist}
                onDblClick={() => unlockField("checklist")}
                onChange={onInfoChange}
                onBlur={() => lockField("checklist")}
                long
                placeholder="Tyres, Service, Detail"
              />

              <EditableTextArea
                label="Notes"
                name="notes"
                value={infoForm.notes}
                editable={editable.notes}
                onDblClick={() => unlockField("notes")}
                onChange={onInfoChange}
                onBlur={() => lockField("notes")}
                long
                placeholder="Add any notes…"
              />

              <div style={{ gridColumn: "span 2", display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn--muted" onClick={resetInfo} disabled={busy}>Reset</button>
                <button className="btn btn--primary" onClick={saveInfo} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
              </div>
            </div>
          )}

          {tab === "photos" && (
            <>
              <div style={{ marginBottom: 10, display: "flex", gap: 8, alignItems: "center" }}>
                <button onClick={handlePick} className="btn btn--primary">Upload Photos</button>
                <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleFiles} />
                {busy && <span style={{ color: "#9ca3af" }}>Working…</span>}
              </div>

              <div style={{ maxHeight: 460, overflow: "auto", borderTop: "1px solid #1f2937", paddingTop: 10 }}>
                {photos.length === 0 ? (
                  <div style={{ color: "#9ca3af" }}>{busy ? "Loading photos…" : "No photos yet."}</div>
                ) : (
                  <div style={grid}>
                    {photos.map((p) => (
                      <div key={p.key} style={card}>
                        <a href={p.url} target="_blank" rel="noreferrer">
                          <img src={p.url} alt={p.caption || "photo"} style={img} />
                        </a>
                        <input
                          type="text"
                          placeholder="Caption"
                          defaultValue={p.caption || ""}
                          onBlur={(e) => {
                            const newCap = e.target.value || "";
                            if (newCap !== (p.caption || "")) handleCaption(p.key, newCap);
                          }}
                          style={captionInput}
                        />
                        <button onClick={() => handleDelete(p.key)} className="btn btn--danger" style={{ width: "100%" }}>
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
            <div style={{ maxHeight: 500, overflow: "auto" }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Location History</div>
              {history.length === 0 ? (
                <div style={{ color: "#9ca3af" }}>No history recorded.</div>
              ) : (
                <table style={historyTable}>
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

// --- reusable UI blocks ---
function InfoItem({ label, value, long = false }) {
  return (
    <div style={{ ...infoItem, gridColumn: long ? "span 2" : "span 1" }}>
      <div style={infoLabel}>{label}</div>
      <div style={infoValue}>{value}</div>
    </div>
  );
}

function EditableField({ label, name, value, editable, onDblClick, onChange, onBlur, long = false, placeholder = "" }) {
  return (
    <div
      style={{ ...fieldWrap, gridColumn: long ? "span 2" : "span 1", cursor: editable ? "text" : "pointer" }}
      onDoubleClick={onDblClick}
      title={editable ? "" : "Double-click to edit"}
    >
      <div style={fieldLabel}>{label}</div>
      <input
        type="text"
        name={name}
        value={value}
        onChange={editable ? onChange : undefined}
        onBlur={editable ? onBlur : undefined}
        readOnly={!editable}
        style={{ ...input, opacity: editable ? 1 : 0.7 }}
        placeholder={placeholder}
      />
      {!editable && <div style={hint}>Double-click to edit</div>}
    </div>
  );
}

function EditableTextArea({ label, name, value, editable, onDblClick, onChange, onBlur, long = false, placeholder = "" }) {
  return (
    <div
      style={{ ...fieldWrap, gridColumn: long ? "span 2" : "span 1", cursor: editable ? "text" : "pointer" }}
      onDoubleClick={onDblClick}
      title={editable ? "" : "Double-click to edit"}
    >
      <div style={fieldLabel}>{label}</div>
      <textarea
        name={name}
        value={value}
        onChange={editable ? onChange : undefined}
        onBlur={editable ? onBlur : undefined}
        readOnly={!editable}
        style={{ ...input, minHeight: 100, resize: "vertical", opacity: editable ? 1 : 0.7 }}
        placeholder={placeholder}
      />
      {!editable && <div style={hint}>Double-click to edit</div>}
    </div>
  );
}

/* inline styles */
const overlayStyle = { position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 };
const modalStyle = { width:"min(1100px,94vw)", background:"#0b1220", color:"#e5e7eb", borderRadius:14, boxShadow:"0 20px 60px rgba(0,0,0,0.35)", padding:16, border:"1px solid #1f2937" };
const headerRow = { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 };
const closeBtnStyle = { border:"none", background:"#1f2937", color:"#e5e7eb", width:32, height:32, borderRadius:8, cursor:"pointer", lineHeight:1, fontSize:18 };
const tabsWrap = { display:"flex", gap:6, borderBottom:"1px solid #1f2937", marginTop:8, paddingBottom:6 };

// Info grid styles
const infoGrid = { display:"grid", gridTemplateColumns:"repeat(2, minmax(0,1fr))", gap:12 };
const infoItem = { background:"#0f172a", border:"1px solid #1f2937", borderRadius:10, padding:12 };
const infoLabel = { fontSize:12, color:"#9ca3af", marginBottom:4, fontWeight:700 };
const infoValue = { fontSize:14, wordBreak:"break-word" };

// Photos styles
const grid = { display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px,1fr))", gap:12 };
const card = { border:"1px solid #1f2937", borderRadius:10, padding:10, display:"flex", flexDirection:"column", gap:8, background:"#0f172a" };
const img = { width:"100%", height:160, objectFit:"cover", borderRadius:8 };
const captionInput = { width:"100%", padding:8, borderRadius:8, border:"1px solid #243041", background:"#0b1220", color:"#e5e7eb", outline:"none" };

// History styles
const historyTable = { width:"100%", borderCollapse:"collapse", fontSize:14 };

// form styles
const fieldWrap = { display:"flex", flexDirection:"column", gap:6, background:"#0f172a", border:"1px solid #1f2937", borderRadius:10, padding:12 };
const fieldLabel = { fontSize:12, color:"#9ca3af", fontWeight:700 };
const input = { width:"100%", padding:8, borderRadius:8, border:"1px solid #243041", background:"#0b1220", color:"#e5e7eb", outline:"none" };
const hint = { fontSize:11, color:"#9ca3af", marginTop:4 };
