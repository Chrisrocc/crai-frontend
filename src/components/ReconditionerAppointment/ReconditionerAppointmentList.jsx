// src/components/ReconditionerAppointment/ReconditionerAppointmentList.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import api from "../../lib/api";
import ReconditionerAppointmentFormModal from "./ReconditionerAppointmentFormModal";
import ReconditionerCategoryManager from "./ReconditionerCategoryManager";
import CarPickerModal from "../CarPicker/CarPickerModal";
import HamburgerMenu from "../utils/HamburgerMenu";
import { standardizeDayTime, dayTimeHighlightClass } from "../utils/dateTime";

export default function ReconditionerAppointmentList() {
  const [categories, setCategories] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [catTab, setCatTab] = useState("all");

  const [showForm, setShowForm] = useState(false);
  const [formCategoryId, setFormCategoryId] = useState(null);

  const [editRow, setEditRow] = useState(null);
  const [editData, setEditData] = useState({
    name: "",
    dateTime: "",
    carIds: [],
    notesAll: "",
    clearedCars: false,
  });
  const savingRef = useRef(false);

  const [pickerOpen, setPickerOpen] = useState(false);

  const [actionedMap, setActionedMap] = useState({});

  const [photoCache, setPhotoCache] = useState({});

  const headers = useMemo(() => ({ "Cache-Control": "no-cache" }), []);

  useEffect(() => {
    const fetchAll = async () => {
      setErr("");
      setLoading(true);
      try {
        const [cat, apps, carList] = await Promise.all([
          api.get("/reconditioner-categories", { headers }),
          api.get("/reconditioner-appointments", { headers }),
          api.get("/cars", { headers }),
        ]);
        const appData = apps.data?.data || [];
        setCategories(cat.data?.data || []);
        setAppointments(appData);
        setCars(carList.data?.data || []);

        setActionedMap((prev) => {
          const next = { ...prev };
          appData.forEach((a) => {
            if (typeof a.actioned === "boolean" && !(a._id in next)) {
              next[a._id] = a.actioned;
            }
          });
          return next;
        });
      } catch (e) {
        setErr(e.response?.data?.message || e.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [headers]);

  const refreshAppointments = async () => {
    try {
      const res = await api.get("/reconditioner-appointments", { headers });
      const appData = res.data?.data || [];
      setAppointments(appData);
      setActionedMap((prev) => {
        const next = { ...prev };
        appData.forEach((a) => {
          if (typeof a.actioned === "boolean" && !(a._id in next)) {
            next[a._id] = a.actioned;
          }
        });
        return next;
      });
    } catch (e) {
      setErr(e.response?.data?.message || e.message);
    }
  };

  const enterEdit = (a) => {
    let notesDefault = "";
    if (Array.isArray(a.cars) && a.cars.length) {
      const notesList = a.cars
        .map((c) => c?.notes || "")
        .filter((n) => n !== "");
      if (notesList.length) {
        const allSame = notesList.every((n) => n === notesList[0]);
        notesDefault = allSame ? notesList[0] : notesList[0];
      }
    }

    const existingIds = Array.isArray(a.cars)
      ? a.cars
          .map((c) => c?.car?._id || c?.car || null)
          .filter(Boolean)
      : [];
    const firstId = existingIds[0] ? [existingIds[0]] : [];

    setEditRow(a._id);
    setEditData({
      name: a.name || "",
      dateTime: a.dateTime || "",
      carIds: firstId,
      notesAll: notesDefault,
      clearedCars: false,
    });
  };

  const handleChange = (e) =>
    setEditData((p) => ({ ...p, [e.target.name]: e.target.value }));

  const cancelEdit = () => {
    setEditRow(null);
    setEditData({
      name: "",
      dateTime: "",
      carIds: [],
      notesAll: "",
      clearedCars: false,
    });
  };

  const saveChanges = async () => {
    if (!editRow || savingRef.current) return;
    savingRef.current = true;
    setErr("");

    try {
      const original =
        appointments.find((a) => a._id === editRow) || { cars: [] };

      const normalized = standardizeDayTime(editData.dateTime || "");
      const finalDateTime =
        normalized && normalized.label && normalized.shouldReplaceRaw
          ? normalized.label
          : (editData.dateTime || "").trim();

      const originalCars = original.cars || [];
      const hasSelectedCar =
        Array.isArray(editData.carIds) && editData.carIds.length > 0;
      const chosenId = hasSelectedCar ? editData.carIds[0] : null;

      const payload = {
        name: (editData.name || "").trim(),
        dateTime: finalDateTime,
        cars: [],
      };

      if (hasSelectedCar) {
        const prev = originalCars.find(
          (c) => (c.car?._id || c.car) === chosenId
        );
        payload.cars = [
          {
            car: chosenId,
            carText: "",
            notes:
              editData.notesAll !== "" ? editData.notesAll : prev?.notes || "",
          },
        ];
      } else if (editData.clearedCars) {
        payload.cars = [];
      } else {
        payload.cars = originalCars.map((c) => ({
          car: c.car || null,
          carText: c.carText || "",
          notes: editData.notesAll !== "" ? editData.notesAll : c.notes || "",
        }));
      }

      setAppointments((prev) =>
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
                      car: carObj
                        ? {
                            _id: cp.car,
                            rego: carObj.rego,
                            make: carObj.make,
                            model: carObj.model,
                            location: carObj.location,
                            photos: carObj.photos,
                          }
                        : cp.car,
                      notes: cp.notes,
                    };
                  }
                  return { carText: cp.carText, notes: cp.notes };
                }),
              }
            : a
        )
      );

      const res = await api.put(
        `/reconditioner-appointments/${editRow}`,
        payload,
        {
          headers: { "Content-Type": "application/json" },
        }
      );

      if (res.data?.data) {
        setAppointments((prev) =>
          prev.map((a) => (a._id === editRow ? res.data.data : a))
        );
      } else {
        await refreshAppointments();
      }

      cancelEdit();
    } catch (e) {
      setErr(e.response?.data?.message || e.message || "Update failed");
      await refreshAppointments();
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

  const deleteAppointment = async (id) => {
    setErr("");
    const before = appointments;
    setAppointments((prev) => prev.filter((a) => a._id !== id));
    try {
      await api.delete(`/reconditioner-appointments/${id}`);
    } catch (e) {
      setErr(e.response?.data?.message || e.message || "Delete failed");
      setAppointments(before);
    }
  };

  const openCreateForCategory = (categoryId) => {
    setFormCategoryId(categoryId);
    setShowForm(true);
  };

  const carLabelFromId = (id) => {
    const c = cars.find((x) => x._id === id);
    return c ? `${c.rego} • ${c.make} ${c.model}` : "";
  };

  const addCarId = (id) =>
    id &&
    setEditData((p) => ({
      ...p,
      carIds: [id],
      clearedCars: false,
    }));

  const removeCarId = (id) =>
    setEditData((p) => ({
      ...p,
      carIds: p.carIds.filter((x) => x !== id),
    }));

  const toggleActioned = (id) => {
    setActionedMap((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const fetchPhotoForCar = async (car) => {
    if (!car?._id) return "";
    const id = car._id;
    if (photoCache[id]) return photoCache[id];

    try {
      const res = await api.get(`/cars/${id}/photo-preview`);
      const url = res?.data?.data || "";
      if (url) {
        setPhotoCache((p) => ({ ...p, [id]: url }));
        return url;
      }
    } catch (e) {
      console.warn(`❌ Error loading photo for ${car.rego}`, e);
    }
    return "";
  };

  const renderDayTime = (raw) => {
    if (!raw || !String(raw).trim()) return "—";
    const { label } = standardizeDayTime(raw);
    return label ?? String(raw).trim();
  };

  if (loading) {
    return (
      <div className="ra-wrap with-ham">
        <style>{css}</style>
        <HamburgerMenu />
        <div className="cal-loading">Loading…</div>
      </div>
    );
  }

  const onCount = categories.filter((c) => !!c.onPremises).length;
  const offCount = categories.filter((c) => !c.onPremises).length;
  const filteredCategories =
    catTab === "on"
      ? categories.filter((c) => !!c.onPremises)
      : catTab === "off"
      ? categories.filter((c) => !c.onPremises)
      : categories;

  const fmtDateShort = (d) =>
    d
      ? new Date(d).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "2-digit",
        })
      : "—";

  return (
    <div className="ra-wrap with-ham">
      <style>{css}</style>
      <HamburgerMenu />

      <header className="cal-head">
        <div className="cal-head-titles">
          <h1>Reconditioner Appointments</h1>
          <p className="cal-sub">
            Double-click a row to edit. Add cars with the picker.
          </p>
        </div>
      </header>

      {err ? <div className="cal-alert">{err}</div> : null}

      <ReconditionerCategoryManager
        categories={categories}
        setCategories={setCategories}
      />

      <div className="ra-tabs" role="tablist" aria-label="Category filter">
        <button
          role="tab"
          aria-selected={catTab === "all"}
          className={`ra-tab ${catTab === "all" ? "is-active" : ""}`}
          onClick={() => setCatTab("all")}
        >
          All <span className="tab-count">{categories.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={catTab === "on"}
          className={`ra-tab ${catTab === "on" ? "is-active" : ""}`}
          onClick={() => setCatTab("on")}
        >
          On premises <span className="tab-count">{onCount}</span>
        </button>
        <button
          role="tab"
          aria-selected={catTab === "off"}
          className={`ra-tab ${catTab === "off" ? "is-active" : ""}`}
          onClick={() => setCatTab("off")}
        >
          Off premises <span className="tab-count">{offCount}</span>
        </button>
      </div>

      {filteredCategories.map((cat) => {
        const catApps = appointments.filter(
          (a) => (a.category?._id || a.category) === cat._id
        );
        return (
          <section key={cat._id} className="cal-panel">
            <div className="cal-panel-head">
              <h2 className="cal-title" title={cat.name}>
                {cat.name}
              </h2>
              <button
                className="btn btn--primary btn--sm"
                onClick={() => openCreateForCategory(cat._id)}
              >
                + Add Appointment
              </button>
            </div>

            <div className="table-clip">
              <div
                className="table-scroll"
                role="region"
                aria-label={`${cat.name} appointments`}
              >
                <table className="cal-table" role="grid">
                  <colgroup>
                    <col style={{ width: "18%" }} />
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "28%" }} />
                    <col style={{ width: "24%" }} />
                    <col style={{ width: "4%" }} />
                    <col style={{ width: "6%" }} />
                    <col style={{ width: "4%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Date/Time</th>
                      <th>Car(s)</th>
                      <th>Notes</th>
                      <th>Actioned</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catApps.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="cal-empty">
                          No appointments.
                        </td>
                      </tr>
                    ) : (
                      catApps.map((a) => {
                        const isEditing = editRow === a._id;

                        let rowCls = "";
                        if (a.dateTime && String(a.dateTime).trim()) {
                          rowCls = dayTimeHighlightClass(a.dateTime);
                        }
                        if (actionedMap[a._id]) {
                          rowCls = rowCls
                            ? `${rowCls} is-actioned`
                            : "is-actioned";
                        }

                        return (
                          <tr
                            key={a._id}
                            data-id={a._id}
                            className={rowCls}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              enterEdit(a);
                            }}
                          >
                            <td>
                              {isEditing ? (
                                <input
                                  name="name"
                                  value={editData.name}
                                  onChange={handleChange}
                                  className="cal-input"
                                  autoFocus
                                />
                              ) : (
                                <div className="one-line">
                                  {a.name || "—"}
                                </div>
                              )}
                            </td>

                            <td>
                              {isEditing ? (
                                <input
                                  name="dateTime"
                                  value={editData.dateTime}
                                  onChange={handleChange}
                                  className="cal-input"
                                  placeholder="e.g. Sat 10:30, tomorrow 2pm, 27/9 09:00"
                                />
                              ) : (
                                <div className="one-line">
                                  {renderDayTime(a.dateTime)}
                                </div>
                              )}
                            </td>

                            <td>
                              {isEditing ? (
                                <div className="chipbox">
                                  {editData.carIds.length === 0 && (
                                    <div className="muted">
                                      No cars selected.
                                    </div>
                                  )}
                                  {editData.carIds.map((id) => (
                                    <span key={id} className="chip">
                                      {carLabelFromId(id)}
                                      <button
                                        className="chip-x"
                                        onClick={() => removeCarId(id)}
                                        aria-label="Remove"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ))}
                                  <div className="chipbox-actions">
                                    <button
                                      type="button"
                                      className="btn btn--ghost btn--sm"
                                      onClick={() => setPickerOpen(true)}
                                    >
                                      + Add Car
                                    </button>
                                    {editData.carIds.length > 0 && (
                                      <button
                                        type="button"
                                        className="btn btn--ghost btn--sm"
                                        onClick={() =>
                                          setEditData((p) => ({
                                            ...p,
                                            carIds: [],
                                            clearedCars: true,
                                          }))
                                        }
                                      >
                                        Clear
                                      </button>
                                    )}
                                  </div>
                                  {Array.isArray(a.cars) &&
                                    a.cars.some(
                                      (x) => !x.car && x.carText
                                    ) && (
                                      <div className="hint">
                                        Existing text-only vehicles will be
                                        kept unless you choose a car or clear.
                                      </div>
                                    )}
                                </div>
                              ) : a.cars && a.cars.length ? (
                                <div className="stack">
                                  {a.cars.map((c, i) => (
                                    <CarPreview
                                      key={
                                        (c.car?._id ||
                                          c.car ||
                                          c.carText ||
                                          "u") + i
                                      }
                                      entry={c}
                                      cars={cars}
                                      photoCache={photoCache}
                                      fetchPhotoForCar={fetchPhotoForCar}
                                    />
                                  ))}
                                </div>
                              ) : (
                                "—"
                              )}
                            </td>

                            <td>
                              {isEditing ? (
                                <input
                                  name="notesAll"
                                  value={editData.notesAll}
                                  onChange={handleChange}
                                  className="cal-input"
                                  placeholder="Optional notes for all cars"
                                />
                              ) : a.cars && a.cars.length ? (
                                <div className="stack">
                                  {a.cars.map((c, i) => (
                                    <div key={"n" + i} className="two-line">
                                      {c.notes || "—"}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                "—"
                              )}
                            </td>

                            <td className="cal-actioned">
                              <label className="actioned-toggle">
                                <input
                                  type="checkbox"
                                  checked={!!actionedMap[a._id]}
                                  onChange={() => toggleActioned(a._id)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </label>
                            </td>

                            <td>
                              <div className="one-line">
                                {fmtDateShort(a.createdAt)}
                              </div>
                            </td>

                            <td className="cal-actions">
                              {isEditing ? (
                                <>
                                  <button
                                    className="btn btn--primary btn--sm"
                                    onClick={saveChanges}
                                  >
                                    Save
                                  </button>
                                  <button
                                    className="btn btn--ghost btn--sm"
                                    onClick={cancelEdit}
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  className="btn btn--danger btn--sm btn--icon"
                                  onClick={() => deleteAppointment(a._id)}
                                  title="Delete"
                                  aria-label="Delete appointment"
                                >
                                  <TrashIcon />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        );
      })}

      <ReconditionerAppointmentFormModal
        show={showForm}
        onClose={() => {
          setShowForm(false);
          setFormCategoryId(null);
        }}
        onSaved={async () => {
          setShowForm(false);
          setFormCategoryId(null);
          await refreshAppointments();
        }}
        cars={cars}
        categoryId={formCategoryId}
      />

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

function CarPreview({ entry, cars, photoCache, fetchPhotoForCar }) {
  const [photoUrl, setPhotoUrl] = useState("");

  const carId = entry?.car?._id || entry?.car || null;
  let carDoc = null;
  if (carId) {
    carDoc = cars.find((c) => c._id === carId) || null;
  }

  const label = carDoc
    ? [carDoc.rego, carDoc.make, carDoc.model].filter(Boolean).join(" • ")
    : entry.carText
    ? entry.carText
    : "[Unidentified]";

  const location = carDoc?.location || "";

  useEffect(() => {
    let active = true;
    if (!carDoc || !carDoc.photos || !carDoc.photos.length || !carId) return;

    const cached = photoCache[carId];
    if (cached) {
      setPhotoUrl(cached);
      return;
    }

    fetchPhotoForCar(carDoc).then((url) => {
      if (active && url) setPhotoUrl(url);
    });

    return () => {
      active = false;
    };
  }, [carDoc, carId, photoCache, fetchPhotoForCar]);

  return (
    <div className="car-preview-row">
      <div className="car-preview-thumb">
        {photoUrl ? (
          <img src={photoUrl} alt={label} />
        ) : (
          <div className="car-thumb-empty" />
        )}
      </div>
      <div className="car-preview-text">
        <div className="two-line">{label}</div>
        {location ? <div className="car-location">{location}</div> : null}
      </div>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3 6h18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M10 11v6M14 11v6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ---------- Styles (regular table, fixed borders) ---------- */
const css = `
:root { color-scheme: dark; }
html, body, #root { background:#0B1220; overflow-x:hidden; }
* { box-sizing:border-box; }

.ra-wrap {
  --bg:#0B1220; --panel:#0F172A; --muted:#9CA3AF; --text:#E5E7EB; --line:#1F2937;
  --primary:#2563EB; --danger:#DC2626; --ghost:#111827; --ring:#2E4B8F;
  color:var(--text); background:var(--bg);
  min-height:100vh; padding:20px; font-family:Inter, system-ui, -apple-system, Segoe UI, Arial;
  overflow-x:hidden;
}

.with-ham .cal-head{ padding-left:56px; }
@media (max-width:480px){ .with-ham .cal-head{ padding-left:48px; } }

.cal-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; }
.cal-head h1 { margin:0 0 2px; font-size:22px; letter-spacing:.2px; }
.cal-sub { margin:0; color:var(--muted); font-size:12px; }
.cal-head-titles { display:flex; flex-direction:column; gap:4px; }
.cal-alert { background:#3B0D0D; border:1px solid #7F1D1D; color:#FECACA; padding:10px 12px; border-radius:12px; margin-bottom:12px; }

.ra-tabs { display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap; }
.ra-tab {
  background:#0F172A; border:1px solid #243041; color:#E5E7EB;
  padding:8px 12px; border-radius:999px; cursor:pointer; font-weight:600; font-size:13px;
}
.ra-tab.is-active { border-color:#2E4B8F; box-shadow:0 0 0 3px rgba(37,99,235,0.18) inset; }
.tab-count { margin-left:8px; color:#9CA3AF; font-weight:600; }

.btn{ border:1px solid transparent; border-radius:12px; padding:10px 14px; cursor:pointer; font-weight:600; }
.btn:focus-visible{ outline:none; box-shadow:0 0 0 3px var(--ring); }
.btn--primary{ background:var(--primary); color:#fff; }
.btn--danger{ background:var(--danger); color:#fff; }
.btn--ghost{ background:var(--ghost); color:#E5E7EB; border-color:#243041; }
.btn--sm{ padding:6px 10px; border-radius:10px; font-size:12px; }
.btn--icon{ padding:6px; width:32px; height:28px; display:inline-flex; align-items:center; justify-content:center; }

.cal-panel{ display:flex; flex-direction:column; gap:10px; min-width:0; }
.cal-panel-head{ display:grid; grid-template-columns:1fr auto; align-items:center; gap:10px; min-width:0; }
.cal-title{ margin:0; font-size:18px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }

/* clip + per-table scroller */
.table-clip{ width:100%; overflow:hidden; border-radius:14px; }
.table-scroll{
  border:1px solid var(--line);
  border-radius:14px;
  background:var(--panel);
  overflow-x:auto;
  overflow-y:hidden;
  -webkit-overflow-scrolling:touch;
  padding-bottom:10px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.02), 0 10px 30px rgba(0,0,0,0.25);
}

.table-scroll::-webkit-scrollbar{ height:12px; }
.table-scroll::-webkit-scrollbar-track{ background:#0B1220; border-radius:10px; }
.table-scroll::-webkit-scrollbar-thumb{ background:#59637C; border:2px solid #0B1220; border-radius:10px; }
.table-scroll:hover::-webkit-scrollbar-thumb{ background:#7B88A6; }
.table-scroll{ scrollbar-color:#59637C #0B1220; scrollbar-width:thin; }

/* REGULAR TABLE – strict grid */
.cal-table{
  width:100%;
  border-collapse:collapse;
  table-layout:fixed;
  min-width:980px;
}

.cal-table thead th{
  position:sticky;
  top:0;
  z-index:2;
  background:var(--panel);
  text-align:left;
  font-size:12px;
  color:#9CA3AF;
  padding:12px 12px;
  border-bottom:1px solid var(--line);
  border-right:1px solid var(--line);
}
.cal-table thead th:first-child{
  border-left:1px solid var(--line);
}

.cal-table tbody td{
  padding:12px 12px;
  font-size:14px;
  color:#E5E7EB;
  vertical-align:middle;
  border-bottom:1px solid var(--line);
  border-right:1px solid var(--line);
  background:var(--panel);
}
.cal-table tbody td:first-child{
  border-left:1px solid var(--line);
}

.cal-table tbody tr:hover td{ background:#0B1428; }
.cal-empty{ text-align:center; padding:20px; color:#9CA3AF; }

/* text helpers */
.one-line{
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.two-line{
  display:-webkit-box;
  -webkit-line-clamp:2;
  -webkit-box-orient:vertical;
  overflow:hidden;
  white-space:normal;
}
.stack{ display:flex; flex-direction:column; gap:4px; }

/* car preview */
.car-preview-row{
  display:flex;
  align-items:center;
  gap:8px;
}
.car-preview-thumb{
  flex:0 0 52px;
  height:40px;
  border-radius:6px;
  overflow:hidden;
  background:#111827;
}
.car-preview-thumb img{
  width:52px;
  height:40px;
  object-fit:cover;
  display:block;
}
.car-thumb-empty{
  width:52px;
  height:40px;
  border-radius:6px;
  background:#111827;
}
.car-preview-text{ min-width:0; }
.car-location{ font-size:12px; color:#9CA3AF; }

/* inputs in edit mode */
.cal-input{
  width:100%;
  padding:8px 10px;
  border-radius:10px;
  border:1px solid #243041;
  background:#0B1220;
  color:#E5E7EB;
  outline:none;
  transition:border-color .2s, box-shadow .2s;
}
.cal-input:focus{ border-color:#2E4B8F; box-shadow:0 0 0 3px rgba(37,99,235,.25); }

.cal-actions{
  display:flex;
  align-items:center;
  justify-content:flex-end;
  gap:8px;
  white-space:nowrap;
}

/* actioned column */
.cal-actioned{ text-align:center; }
.actioned-toggle input{
  width:14px;
  height:14px;
  cursor:pointer;
}

/* chips in edit mode */
.chipbox{ display:flex; flex-direction:column; gap:8px; }
.chipbox-actions{ display:flex; gap:8px; }
.chip{
  display:inline-flex;
  align-items:center;
  gap:6px;
  background:#111827;
  border:1px solid #243041;
  padding:6px 8px;
  border-radius:12px;
  margin:0 8px 8px 0;
}
.chip-x{
  background:transparent;
  border:none;
  color:#9CA3AF;
  cursor:pointer;
  font-size:14px;
  line-height:1;
}
.muted{ color:#9CA3AF; }
.hint{ color:#9CA3AF; font-size:12px; }

/* row highlights – use border colour so grid stays straight */
.cal-table tbody tr.is-today td{
  background:#0f2a12 !important;
  border-color:#1e3a23;
}
.cal-table tbody tr.is-tomorrow td{
  background:#2a210f !important;
  border-color:#3a2e1e;
}
.cal-table tbody tr.is-actioned td{
  background:#0B2340 !important;
  border-color:#1D4ED8;
}
`;
