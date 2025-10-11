import { useEffect, useMemo, useRef, useState } from "react";
import api from "../../lib/api";
import CarPickerModal from "../CarPicker/CarPickerModal";
import { standardizeDayTime, dayTimeHighlightClass } from "../utils/dateTime";

export default function ReconditionerAppointmentHome() {
  const [rows, setRows] = useState([]);
  const [cats, setCats] = useState([]);
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [editRow, setEditRow] = useState(null);
  const [editData, setEditData] = useState({ name: "", dateTime: "", carIds: [], notesAll: "" });
  const [pickerOpen, setPickerOpen] = useState(false);
  const savingRef = useRef(false);

  // initial load
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const [apps, catList, carList] = await Promise.all([
          api.get("/reconditioner-appointments", { headers: { "Cache-Control": "no-cache" } }),
          api.get("/reconditioner-categories", { headers: { "Cache-Control": "no-cache" } }),
          api.get("/cars", { headers: { "Cache-Control": "no-cache" } }),
        ]);
        if (!alive) return;
        setRows(Array.isArray(apps.data?.data) ? apps.data.data : []);
        setCats(Array.isArray(catList.data?.data) ? catList.data.data : []);
        setCars(Array.isArray(carList.data?.data) ? carList.data.data : []);
      } catch (e) {
        if (!alive) return;
        setErr(e.response?.data?.message || e.message || "Failed to load");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const refresh = async () => {
    const r = await api.get("/reconditioner-appointments", { headers: { "Cache-Control": "no-cache" } });
    setRows(Array.isArray(r.data?.data) ? r.data.data : []);
  };

  const isToday = (raw) => {
    const d = standardizeDayTime(raw).date;
    if (!d) return false;
    const n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  };
  const isTomorrow = (raw) => {
    const d = standardizeDayTime(raw).date;
    if (!d) return false;
    const n = new Date();
    const t = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
    return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
  };

  const filtered = useMemo(
    () => rows.filter((r) => isToday(r.dateTime) || isTomorrow(r.dateTime)),
    [rows]
  );
  const ordered = useMemo(() => {
    return filtered.slice().sort((a, b) => {
      const A = standardizeDayTime(a.dateTime).date?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const B = standardizeDayTime(b.dateTime).date?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return A - B;
    });
  }, [filtered]);

  const fmtDateShort = (d) =>
    d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";

  const formatWhen = (raw) => {
    const { date, label } = standardizeDayTime(raw);
    if (!date) return label || (raw || "—");
    const wd = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][date.getDay()];
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mi = String(date.getMinutes()).padStart(2, "0");
    const hasTime = !(date.getHours() === 0 && date.getMinutes() === 0);
    return hasTime ? `${wd} ${dd}/${mm} ${hh}:${mi}` : `${wd} ${dd}/${mm}`;
  };

  const catName = (id) => cats.find((x) => x._id === (id?._id || id))?.name || "—";

  const carsStack = (a) => {
    if (!a.cars?.length) return "—";
    return (
      <div className="stack">
        {a.cars.map((c, i) => {
          if (c.car && typeof c.car === "object") {
            const label = [c.car.rego, c.car.make, c.car.model].filter(Boolean).join(" • ");
            return <div key={(c.car?._id || c.car) + i}>{label}</div>;
          }
          if (c.carText) return <div key={"t" + i}>{c.carText}</div>;
          return <div key={"u" + i}>[Unidentified]</div>;
        })}
      </div>
    );
  };

  const notesStack = (a) =>
    !a.cars?.length ? "—" : <div className="stack">{a.cars.map((c, i) => <div key={"n"+i}>{c.notes || "—"}</div>)}</div>;

  const carLabelFromId = (id) => {
    const c = cars.find((x) => x._id === id);
    return c ? `${c.rego} • ${c.make} ${c.model}` : "";
  };

  const enterEdit = (a) => {
    let common = "";
    if (Array.isArray(a.cars) && a.cars.length) {
      const list = a.cars.map((c) => c?.notes || "").filter(Boolean);
      if (list.length) common = list.every((n) => n === list[0]) ? list[0] : list[0];
    }
    setEditRow(a._id);
    setEditData({
      name: a.name || "",
      dateTime: a.dateTime || "",
      carIds: Array.isArray(a.cars) ? a.cars.map((c) => c?.car?._id || c?.car).filter(Boolean) : [],
      notesAll: common,
    });
  };

  const onChange = (e) => setEditData((p) => ({ ...p, [e.target.name]: e.target.value }));
  const addCarId = (id) => id && setEditData((p) => (p.carIds.includes(id) ? p : { ...p, carIds: [...p.carIds, id] }));
  const removeCarId = (id) => setEditData((p) => ({ ...p, carIds: p.carIds.filter((x) => x !== id) }));
  const cancelEdit = () => { setEditRow(null); setEditData({ name: "", dateTime: "", carIds: [], notesAll: "" }); };

  const saveChanges = async () => {
    if (!editRow || savingRef.current) return;
    savingRef.current = true;
    try {
      const original = rows.find((a) => a._id === editRow) || { cars: [] };
      const preservedText = (original.cars || [])
        .filter((x) => !x.car && x.carText)
        .map((x) => ({ carText: x.carText, notes: editData.notesAll !== "" ? editData.notesAll : x.notes || "" }));
      const identified = (editData.carIds || []).map((id) => {
        const prev = (original.cars || []).find((c) => (c.car?._id || c.car) === id);
        return { car: id, notes: editData.notesAll !== "" ? editData.notesAll : (prev?.notes || "") };
      });
      const payload = {
        name: (editData.name || "").trim(),
        dateTime: (editData.dateTime || "").trim(),
        cars: [...preservedText, ...identified],
      };

      setRows((prev) =>
        prev.map((a) =>
          a._id === editRow
            ? {
                ...a,
                name: payload.name,
                dateTime: payload.dateTime,
                cars: payload.cars.map((cp) => {
                  if (cp.car) {
                    const carObj = cars.find((c) => c._id === cp.car);
                    return {
                      car: carObj ? { _id: cp.car, rego: carObj.rego, make: carObj.make, model: carObj.model } : cp.car,
                      notes: cp.notes,
                    };
                  }
                  return { carText: cp.carText, notes: cp.notes };
                }),
              }
            : a
        )
      );

      await api.put(`/reconditioner-appointments/${editRow}`, payload, {
        headers: { "Content-Type": "application/json" },
      });

      cancelEdit();
    } catch (e) {
      alert("Error updating: " + (e.response?.data?.message || e.message));
      await refresh();
    } finally {
      savingRef.current = false;
    }
  };

  useEffect(() => {
    const onDown = (e) => {
      if (!editRow || pickerOpen) return;
      const rowEl = document.querySelector(`tr[data-id="${editRow}"]`);
      if (rowEl && !rowEl.contains(e.target)) saveChanges();
    };
    if (editRow) document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [editRow, editData, pickerOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this entry?")) return;
    try {
      await api.delete(`/reconditioner-appointments/${id}`);
      await refresh();
    } catch (e) {
      alert(e.response?.data?.message || e.message || "Delete failed");
    }
  };

  return (
    <div className="ra-home">
      <style>{css}</style>
      <CarPickerModal
        show={pickerOpen}
        cars={cars}
        onClose={() => setPickerOpen(false)}
        onSelect={(carOrNull) => { setPickerOpen(false); if (carOrNull?._id) addCarId(carOrNull._id); }}
      />

      {err && <div className="cal-alert">{err}</div>}
      <div className="cal-table-clip">
        <div className="cal-table-scroll">
          <table className="cal-table">
            <colgroup>
              <col className="col-name" />
              <col className="col-daytime" />
              <col className="col-car" />
              <col className="col-notes" />
              <col className="col-datecreated" />
              <col className="col-category" />
              <col className="col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th>Name</th>
                <th>Date/Time</th>
                <th>Car(s)</th>
                <th>Notes</th>
                <th>Created</th>
                <th>Category</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan="7" className="cal-empty">Loading…</td></tr>}
              {!loading && err && <tr><td colSpan="7" className="cal-empty">{err}</td></tr>}
              {!loading && !err && ordered.length === 0 && (
                <tr><td colSpan="7" className="cal-empty">No reconditioner appointments for today or tomorrow.</td></tr>
              )}
              {!loading && !err && ordered.map((a) => {
                const isEditing = editRow === a._id;
                const rowCls = dayTimeHighlightClass(a.dateTime);
                return (
                  <tr key={a._id} data-id={a._id} className={rowCls} onDoubleClick={() => enterEdit(a)}>
                    <td>{isEditing ? <input name="name" value={editData.name} onChange={onChange} className="cal-input" autoFocus /> : (a.name || "—")}</td>
                    <td>{isEditing ? <input name="dateTime" value={editData.dateTime} onChange={onChange} className="cal-input" /> : formatWhen(a.dateTime)}</td>
                    <td>
                      {isEditing ? (
                        <div className="chipbox">
                          {editData.carIds.length === 0 && <div className="muted">No cars selected.</div>}
                          {editData.carIds.map((id) => (
                            <span key={id} className="chip">
                              {carLabelFromId(id)}
                              <button className="chip-x" onClick={() => removeCarId(id)}>×</button>
                            </span>
                          ))}
                          <div className="chipbox-actions">
                            <button className="btn btn--ghost btn--sm" onClick={() => setPickerOpen(true)}>+ Add Car</button>
                            {editData.carIds.length > 0 && (
                              <button className="btn btn--ghost btn--sm" onClick={() => setEditData((p) => ({ ...p, carIds: [] }))}>Clear</button>
                            )}
                          </div>
                        </div>
                      ) : carsStack(a)}
                    </td>
                    <td>{isEditing ? <input name="notesAll" value={editData.notesAll} onChange={onChange} className="cal-input" /> : notesStack(a)}</td>
                    <td>{fmtDateShort(a.createdAt)}</td>
                    <td>{catName(a.category)}</td>
                    <td className="cal-actions">
                      <button className="btn btn--danger btn--sm btn--icon" onClick={() => handleDelete(a._id)}><TrashIcon /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" width="16" height="16">
      <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const css = `
:root { color-scheme: dark; }
* { box-sizing:border-box; }

.ra-home { width:100%; min-width:0; }

.cal-table-clip{ width:100%; overflow:hidden; border-radius:14px; }
.cal-table-scroll{
  border:1px solid #1F2937;
  border-radius:14px;
  background:#0F172A;
  overflow-x:auto;
  overflow-y:hidden;
  -webkit-overflow-scrolling:touch;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.02), 0 10px 30px rgba(0,0,0,0.25);
}

.cal-table{
  width:100%;
  border-collapse:separate;
  border-spacing:0;
  table-layout:fixed;
  min-width:1200px;
}

.cal-table thead th{
  position:sticky; top:0; z-index:1;
  background:#0F172A;
  border-bottom:1px solid #1F2937;
  text-align:left; font-size:12px; color:#9CA3AF;
  padding:12px;
}
.cal-table tbody td{
  padding:12px; border-bottom:1px solid #1F2937;
  font-size:14px; color:#E5E7EB; vertical-align:middle;
}
.cal-table tbody tr:hover{ background:#0B1428; }
.cal-table tbody tr:nth-child(odd){ background:rgba(255,255,255,0.01); }

.stack{ display:flex; flex-direction:column; gap:4px; }
.chipbox{ display:flex; flex-direction:column; gap:8px; }
.chip{
  display:inline-flex; align-items:center; gap:6px;
  background:#111827; border:1px solid #243041;
  padding:6px 8px; border-radius:12px; margin:0 8px 8px 0;
}
.chip-x{ background:transparent; border:none; color:#9CA3AF; cursor:pointer; font-size:14px; }

.cal-input{
  width:100%; padding:8px 10px; border-radius:10px;
  border:1px solid #243041; background:#0B1220; color:#E5E7EB;
  outline:none; transition:border-color .2s, box-shadow .2s;
}
.cal-input:focus{ border-color:#2E4B8F; box-shadow:0 0 0 3px rgba(37,99,235,.25); }

.cal-actions{ display:flex; align-items:center; justify-content:flex-end; gap:8px; white-space:nowrap; }
.btn{ border:1px solid transparent; border-radius:10px; padding:6px 10px; cursor:pointer; font-weight:600; }
.btn--ghost{ background:#111827; color:#E5E7EB; border-color:#243041; }
.btn--danger{ background:#DC2626; color:#fff; }
.btn--sm{ font-size:12px; }
.btn--icon{ padding:6px; width:32px; height:28px; display:inline-flex; align-items:center; justify-content:center; }

.cal-empty{ text-align:center; color:#9CA3AF; padding:20px; }
.cal-table-scroll::-webkit-scrollbar{ height:12px; }
.cal-table-scroll::-webkit-scrollbar-thumb{ background:#59637C; border:2px solid #0B1220; border-radius:10px; }
.cal-table-scroll:hover::-webkit-scrollbar-thumb{ background:#7B88A6; }
`;
