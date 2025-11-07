// src/components/Car/CarProfileModal.jsx
import { useEffect, useRef, useState } from "react";
import api from "../../lib/api";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

// --- date helpers ---
const msPerDay = 1000 * 60 * 60 * 24;
const dateOnly = (d) => { const dt = new Date(d || Date.now()); dt.setHours(0,0,0,0); return dt; };
const dmy = (d) => { if (!d) return "-"; const dt=new Date(d); if (Number.isNaN(dt)) return "-"; return `${dt.getDate()}/${dt.getMonth()+1}/${String(dt.getFullYear()).slice(-2)}`; };
const fullDT = (d) => d ? new Date(d).toLocaleString() : "-";
const daysOpen = (start) => Math.max(1, Math.floor((Date.now()-dateOnly(start))/msPerDay)+1);
const daysClosed = (start,end) => Math.max(1, Math.floor((dateOnly(end)-dateOnly(start))/msPerDay));

export default function CarProfileModal({ open, car, onClose }) {
  const [tab, setTab] = useState("info");
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(-1);
  const [localCar, setLocalCar] = useState(car || null);
  const fileRef = useRef(null);

  // --- Info state ---
  const [infoForm, setInfoForm] = useState({
    rego:"", make:"", model:"", series:"", readinessStatus:"", notes:"", checklist:""
  });
  const [editable,setEditable]=useState({
    rego:false, make:false, model:false, series:false, readinessStatus:false, notes:false, checklist:false
  });

  const carTitle = localCar ? `${localCar.rego||""} ${localCar.make||""} ${localCar.model||""}`.trim() : "";

  useEffect(()=>{ setLocalCar(car||null); setTab("info"); },[car]);
  useEffect(()=>{
    if(!localCar)return;
    setInfoForm({
      rego:localCar.rego||"", make:localCar.make||"", model:localCar.model||"", series:localCar.series||"",
      readinessStatus:localCar.readinessStatus||"", notes:localCar.notes||"",
      checklist:Array.isArray(localCar.checklist)?localCar.checklist.join(", "):(localCar.checklist||"")
    });
    setEditable({rego:false,make:false,model:false,series:false,readinessStatus:false,notes:false,checklist:false});
  },[localCar]);

  const fetchPhotos = async()=>{
    if(!localCar?._id)return;
    try{ setBusy(true);
      const res=await api.get(`/photos/${localCar._id}`);
      setPhotos(res.data?.data||[]);
    }catch(e){console.error(e);}finally{setBusy(false);}
  };
  const refreshCar = async()=>{
    if(!localCar?._id)return;
    try{
      const res=await api.get("/cars");
      const fresh=(res.data?.data||[]).find(c=>c._id===localCar._id);
      if(fresh)setLocalCar(fresh);
    }catch(e){console.error(e);}
  };
  useEffect(()=>{ if(open&&localCar?._id){ refreshCar(); fetchPhotos(); }},[open,localCar?._id]);

  // ---------- PHOTO HANDLERS ----------
  const handlePick=()=>fileRef.current?.click();
  const handleFiles=async(e)=>{
    const files=Array.from(e.target.files||[]);
    if(!files.length||!localCar?._id)return;
    const {UploadQueue}=await import("../../lib/uploadQueue");
    for(const f of files)UploadQueue.enqueue({carId:localCar._id,file:f,caption:""});
    setTimeout(fetchPhotos,2000);
    if(fileRef.current)fileRef.current.value="";
  };
  const handleDelete=async(key)=>{
    try{ await api.delete(`/photos/${localCar._id}?key=${encodeURIComponent(key)}`); setPhotos(p=>p.filter(ph=>ph.key!==key)); }
    catch(e){console.error(e);}
  };
  const handleCaption=async(key,caption)=>{
    try{ await api.patch(`/photos/${localCar._id}/caption`,{key,caption}); setPhotos(p=>p.map(ph=>ph.key===key?{...ph,caption}:ph)); }
    catch(e){console.error(e);}
  };
  const onDragEnd=async(result)=>{
    if(!result.destination)return;
    const reordered=Array.from(photos);
    const [moved]=reordered.splice(result.source.index,1);
    reordered.splice(result.destination.index,0,moved);
    setPhotos(reordered);
    try{
      await api.put(`/cars/${localCar._id}`,{
        photos:reordered.map(p=>({key:p.key,caption:p.caption||""}))
      });
    }catch(e){console.error(e);}
  };

  // ---------- INFO ----------
  const onInfoChange=e=>setInfoForm(p=>({...p,[e.target.name]:e.target.value}));
  const unlock=n=>setEditable(p=>({...p,[n]:true}));
  const lock=n=>setEditable(p=>({...p,[n]:false}));
  const resetInfo=()=>{
    if(!localCar)return;
    setInfoForm({
      rego:localCar.rego||"",make:localCar.make||"",model:localCar.model||"",series:localCar.series||"",
      readinessStatus:localCar.readinessStatus||"",notes:localCar.notes||"",
      checklist:Array.isArray(localCar.checklist)?localCar.checklist.join(", "):(localCar.checklist||"")
    });
    setEditable({rego:false,make:false,model:false,series:false,readinessStatus:false,notes:false,checklist:false});
  };
  const saveInfo=async()=>{
    if(!localCar?._id)return;
    setBusy(true);
    try{
      const checklistArr=(infoForm.checklist||"").split(",").map(s=>s.trim()).filter(Boolean);
      await api.put(`/cars/${localCar._id}`,{
        rego:infoForm.rego.trim(),make:infoForm.make.trim(),model:infoForm.model.trim(),
        series:infoForm.series.trim(),readinessStatus:infoForm.readinessStatus.trim(),
        notes:infoForm.notes.trim(),checklist:checklistArr.length?checklistArr:""
      });
      await refreshCar();
      alert("Info saved");
      setEditable({rego:false,make:false,model:false,series:false,readinessStatus:false,notes:false,checklist:false});
    }catch(e){console.error(e);}finally{setBusy(false);}
  };

  if(!open)return null;
  const history=Array.isArray(localCar?.history)?localCar.history:[];

  return(
  <div style={overlayStyle}>
    <style>{css}</style>
    <div className="modal-shell">
      <div className="header">
        <div>
          <div className="title">Car Profile</div>
          <div className="sub">{carTitle||"—"}</div>
        </div>
        <div className="actions">
          <button onClick={refreshCar} className="btn btn--muted">Refresh</button>
          <button onClick={()=>onClose(false)} className="close">×</button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab==="info"?"tab--active":""}`} onClick={()=>setTab("info")}>Info</button>
        <button className={`tab ${tab==="photos"?"tab--active":""}`} onClick={()=>setTab("photos")}>Photos</button>
        <button className={`tab ${tab==="history"?"tab--active":""}`} onClick={()=>setTab("history")}>History</button>
      </div>

      <div className="body">
        {tab==="info" && (
          <div className="info-grid">
            <InfoItem label="Created" value={fullDT(localCar?.dateCreated||localCar?.createdAt)} />
            <InfoItem label="Updated" value={fullDT(localCar?.updatedAt)} />
            <EditableField label="Rego" name="rego" value={infoForm.rego} editable={editable.rego}
              onDblClick={()=>unlock("rego")} onChange={onInfoChange} onBlur={()=>lock("rego")} />
            <EditableField label="Make" name="make" value={infoForm.make} editable={editable.make}
              onDblClick={()=>unlock("make")} onChange={onInfoChange} onBlur={()=>lock("make")} />
            <EditableField label="Model" name="model" value={infoForm.model} editable={editable.model}
              onDblClick={()=>unlock("model")} onChange={onInfoChange} onBlur={()=>lock("model")} />
            <EditableField label="Series" name="series" value={infoForm.series} editable={editable.series}
              onDblClick={()=>unlock("series")} onChange={onInfoChange} onBlur={()=>lock("series")} />
            <EditableField label="Readiness" name="readinessStatus" value={infoForm.readinessStatus} editable={editable.readinessStatus}
              onDblClick={()=>unlock("readinessStatus")} onChange={onInfoChange} onBlur={()=>lock("readinessStatus")} long/>
            <EditableField label="Checklist" name="checklist" value={infoForm.checklist} editable={editable.checklist}
              onDblClick={()=>unlock("checklist")} onChange={onInfoChange} onBlur={()=>lock("checklist")} long/>
            <EditableTextArea label="Notes" name="notes" value={infoForm.notes} editable={editable.notes}
              onDblClick={()=>unlock("notes")} onChange={onInfoChange} onBlur={()=>lock("notes")} long/>
            <div className="info-actions">
              <button className="btn btn--muted" onClick={resetInfo}>Reset</button>
              <button className="btn btn--primary" onClick={saveInfo} disabled={busy}>{busy?"Saving…":"Save"}</button>
            </div>
          </div>
        )}

        {tab==="photos" && (
          <>
            <div className="row mb8">
              <button onClick={handlePick} className="btn btn--primary">Upload Photos</button>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleFiles}/>
              {busy&&<span className="muted">Working…</span>}
            </div>
            {photos.length===0?(
              <div className="muted">{busy?"Loading…":"No photos yet"}</div>
            ):(
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="photos" direction="horizontal">
                  {(provided)=>(
                    <div className="photo-grid" ref={provided.innerRef} {...provided.droppableProps}>
                      {photos.map((p,idx)=>(
                        <Draggable key={p.key} draggableId={p.key} index={idx}>
                          {(prov)=>(
                            <div className="photo-card" ref={prov.innerRef} {...prov.draggableProps} {...prov.dragHandleProps}>
                              <img src={p.url} alt={p.caption||"photo"} className="photo-img"
                                onClick={()=>setViewerIndex(idx)}/>
                              <input type="text" defaultValue={p.caption||""} placeholder="Caption"
                                className="caption-input"
                                onBlur={(e)=>handleCaption(p.key,e.target.value)}/>
                              <button onClick={()=>handleDelete(p.key)} className="btn btn--danger w100">Delete</button>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}
            <Lightbox open={viewerIndex>=0} index={viewerIndex}
              close={()=>setViewerIndex(-1)} slides={photos.map(p=>({src:p.url,description:p.caption}))}/>
          </>
        )}

        {tab==="history" && (
          <div className="history-wrap">
            <div className="section-title">Location History</div>
            {history.length===0?(
              <div className="muted">No history recorded.</div>
            ):(
              <table className="history-table">
                <thead><tr><th>#</th><th>Location</th><th>Start</th><th>End</th><th>Days</th><th>Status</th></tr></thead>
                <tbody>
                  {history.map((h,i)=>{
                    const isOpen=!h.endDate;
                    const days=isOpen?daysOpen(h.startDate):daysClosed(h.startDate,h.endDate);
                    return(<tr key={i}>
                      <td>{i+1}</td><td>{h.location||"-"}</td>
                      <td>{dmy(h.startDate)}</td><td>{isOpen?"Still There":dmy(h.endDate)}</td>
                      <td>{days} Days</td>
                      <td><span className={`chip ${isOpen?"chip--open":"chip--closed"}`}>{isOpen?"Open":"Closed"}</span></td>
                    </tr>);
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  </div>);
}

/* ---------- Reusable Blocks ---------- */
function InfoItem({label,value,long}){return(<div className={`card ${long?"span-2":""}`}><div className="label">{label}</div><div className="value">{value}</div></div>);}
function EditableField({label,name,value,editable,onDblClick,onChange,onBlur,long,placeholder}){return(
  <div className={`card ${long?"span-2":""} ${editable?"is-editing":""}`} onDoubleClick={onDblClick}>
    <div className="label">{label}</div>
    <input type="text" name={name} value={value} onChange={editable?onChange:undefined}
      onBlur={editable?onBlur:undefined} readOnly={!editable} className="input" placeholder={placeholder||""}/>
    {!editable&&<div className="hint">Double-click to edit</div>}
  </div>
);}
function EditableTextArea({label,name,value,editable,onDblClick,onChange,onBlur,long,placeholder}){return(
  <div className={`card ${long?"span-2":""} ${editable?"is-editing":""}`} onDoubleClick={onDblClick}>
    <div className="label">{label}</div>
    <textarea name={name} value={value} onChange={editable?onChange:undefined}
      onBlur={editable?onBlur:undefined} readOnly={!editable} className="input textarea" placeholder={placeholder||""}/>
    {!editable&&<div className="hint">Double-click to edit</div>}
  </div>
);}

/* ---------- CSS ---------- */
const overlayStyle={position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000};
const css=`
.modal-shell{width:min(1100px,96vw);max-height:94vh;background:#0b1220;color:#e5e7eb;border-radius:14px;display:flex;flex-direction:column;overflow:hidden;border:1px solid #1f2937;}
.header{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:#0b1220;border-bottom:1px solid #1f2937;}
.title{font-weight:800;font-size:18px;}
.sub{font-size:13px;color:#9ca3af;}
.tabs{display:flex;gap:6px;padding:8px 12px;border-bottom:1px solid #1f2937;}
.tab{border:0;padding:8px 12px;border-radius:10px;background:#0f172a;color:#cbd5e1;font-weight:700;cursor:pointer;}
.tab--active{background:#1f2937;color:#fff;}
.body{padding:12px;overflow:auto;}
.btn{border:1px solid #243041;border-radius:10px;padding:8px 12px;font-weight:600;cursor:pointer;background:#1f2937;color:#e5e7eb;}
.btn--primary{background:#2563EB;color:#fff;border:none;}
.btn--muted{background:#1f2937;}
.btn--danger{background:#DC2626;color:#fff;border:none;}
.w100{width:100%;}
.photo-grid{display:flex;flex-wrap:wrap;gap:10px;padding:10px 0;}
.photo-card{border:1px solid #1f2937;border-radius:10px;background:#0f172a;padding:10px;display:flex;flex-direction:column;gap:8px;width:200px;}
.photo-img{width:100%;height:160px;object-fit:cover;border-radius:8px;cursor:pointer;}
.caption-input{width:100%;padding:8px 10px;border-radius:8px;border:1px solid #243041;background:#0b1220;color:#e5e7eb;outline:none;}
.muted{color:#9ca3af;}
.card{background:#0f172a;border:1px solid #1f2937;border-radius:10px;padding:12px;}
.label{font-size:12px;color:#9ca3af;font-weight:700;margin-bottom:6px;}
.input{width:100%;padding:10px 12px;border-radius:10px;border:1px solid #243041;background:#0b1220;color:#e5e7eb;}
.textarea{min-height:120px;}
.info-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;}
.info-actions{grid-column:span 2;display:flex;justify-content:flex-end;gap:8px;}
.history-table{width:100%;border-collapse:collapse;}
.history-table th,.history-table td{padding:8px;border-bottom:1px solid #1f2937;}
.chip{display:inline-block;padding:4px 8px;border-radius:999px;font-weight:700;}
.chip--open{background:#22c55e1f;color:#22c55e;}
.chip--closed{background:#6b72801a;color:#9ca3af;}
@media(max-width:720px){.photo-card{width:47%;}.info-grid{grid-template-columns:1fr;}}
`;
