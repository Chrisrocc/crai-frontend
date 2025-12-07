import { useEffect, useRef, useState } from "react";
import api from "../../lib/api";
import TaskFormModal from "./TaskFormModal";
import CarPickerModal from "../CarPicker/CarPickerModal";
import HamburgerMenu from "../utils/HamburgerMenu";

export default function TaskList() {
  const [tasks, setTasks] = useState([]);
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [showForm, setShowForm] = useState(false);

  // inline edit
  const [editRow, setEditRow] = useState(null);
  const [editData, setEditData] = useState({ task: "", car: "" });
  const savingRef = useRef(false);

  // car picker for inline edit
  const [pickerOpen, setPickerOpen] = useState(false);

  const nocache = { headers: { "Cache-Control": "no-cache" } };

  useEffect(() => {
    (async () => {
      try {
        const [t, c] = await Promise.all([
          api.get("/tasks", nocache),
          api.get("/cars", nocache),
        ]);
        setTasks(t.data?.data || []);
        setCars(c.data?.data || []);
        setErr("");
      } catch (e) {
        setErr(e.response?.data?.message || e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshTasks = async () => {
    const res = await api.get("/tasks", nocache);
    setTasks(res.data?.data || []);
    setErr("");
  };

  const enterEdit = (t) => {
    setEditRow(t._id);
    setEditData({
      task: t.task || "",
      car: t.car?._id || "",
    });
  };

  const handleChange = (e) =>
    setEditData((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleDelete = async (id) => {
    try {
      await api.delete(`/tasks/${id}`);
      await refreshTasks();
    } catch (e) {
      setErr(e.response?.data?.message || e.message);
    }
  };

  const saveChanges = async () => {
    if (!editRow || savingRef.current) return;
    savingRef.current = true;
    try {
      const payload = { task: (editData.task || "").trim() };
      if (editData.car) payload.car = editData.car;

      // optimistic
      setTasks((prev) =>
        prev.map((t) =>
          t._id === editRow ? { ...t, task: payload.task, car: t.car } : t
        )
      );

      const res = await api.put(`/tasks/${editRow}`, payload, {
        headers: { "Content-Type": "application/json" },
      });

      if (res.data?.data) {
        setTasks((prev) =>
          prev.map((t) => (t._id === editRow ? res.data.data : t))
        );
      } else {
        await refreshTasks();
      }
      setEditRow(null);
      setErr("");
    } catch (e) {
      setErr(e.response?.data?.message || e.message);
      await refreshTasks();
    } finally {
      savingRef.current = false;
    }
  };

  // click-outside save (disabled while picker open)
  useEffect(() => {
    const onDown = (e) => {
      if (!editRow || pickerOpen) return;
      const rowEl = document.querySelector(`tr[data-id="${editRow}"]`);
      if (rowEl && !rowEl.contains(e.target)) saveChanges();
    };
    if (editRow) document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [editRow, editData, pickerOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const carLabel = (objOrId) => {
    if (!objOrId) return "";
    if (typeof objOrId === "object") {
      return [objOrId.rego, objOrId.make, objOrId.model]
        .filter(Boolean)
        .join(" • ");
    }
    const c = cars.find((x) => x._id === objOrId);
    return c ? `${c.rego} • ${c.make} ${c.model}` : "";
  };

  const fmtDate = (d) =>
    d
      ? new Date(d).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "2-digit",
        })
      : "—";

  if (loading) {
    return (
      <div className="cal-wrap with-ham">
        <style>{css}</style>
        <HamburgerMenu />
        <div className="cal-loading">Loading…</div>
      </div>
    );
  }

  return (
    <div className="cal-wrap with-ham">
      <style>{css}</style>

      <HamburgerMenu />

      <header className="cal-head">
        <div className="cal-head-titles">
          <h1>Tasks</h1>
          <p className="cal-sub">
            Double-click a row to edit. Double-click the car cell to pick a car.
          </p>
        </div>

        <div className="cal-head-actions">
          <button
            className="btn btn--primary"
            onClick={() => setShowForm(true)}
          >
            + New Task
          </button>
        </div>
      </header>

      {err ? <div className="cal-alert">{err}</div> : null}

      {/* Create modal */}
      <TaskFormModal
        show={showForm}
        onClose={() => setShowForm(false)}
        onSave={refreshTasks}
        cars={cars}
      />

      <section className="cal-panel">
        <div className="cal-table-clip">
          <div className="cal-table-scroll" role="region" aria-label="Tasks">
            <table className="cal-table" role="grid">
              <colgroup>
                <col className="col-task" />
                <col className="col-car" />
                <col className="col-created" />
                <col className="col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Car</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="cal-empty">
                      No tasks.
                    </td>
                  </tr>
                ) : (
                  tasks.map((t) => {
                    const isEditing = editRow === t._id;
                    return (
                      <tr
                        key={t._id}
                        data-id={t._id}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          enterEdit(t);
                        }}
                      >
                        {/* Task */}
                        <td>
                          {isEditing ? (
                            <input
                              className="cal-input"
                              name="task"
                              value={editData.task}
                              onChange={handleChange}
                              autoFocus
                            />
                          ) : (
                            t.task || "—"
                          )}
                        </td>

                        {/* Car (double-click to open picker) */}
                        <td
                          onDoubleClick={() => {
                            if (!isEditing) enterEdit(t);
                            setPickerOpen(true);
                          }}
                          title="Double-click to pick a car"
                        >
                          {isEditing ? (
                            <div className="car-edit">
                              <input
                                className="cal-input"
                                readOnly
                                value={carLabel(editData.car)}
                                placeholder="No car"
                              />
                              <button
                                type="button"
                                className="btn btn--ghost btn--sm"
                                onClick={() => setPickerOpen(true)}
                              >
                                Pick
                              </button>
                              {editData.car && (
                                <button
                                  type="button"
                                  className="btn btn--ghost btn--sm"
                                  onClick={() =>
                                    setEditData((p) => ({ ...p, car: "" }))
                                  }
                                >
                                  Clear
                                </button>
                              )}
                            </div>
                          ) : t.car ? (
                            carLabel(t.car)
                          ) : (
                            "—"
                          )}
                        </td>

                        {/* Created */}
                        <td>{fmtDate(t.createdAt || t.dateCreated)}</td>

                        {/* Actions */}
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
                                onClick={() => setEditRow(null)}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              className="btn btn--danger btn--sm btn--icon"
                              onClick={() => handleDelete(t._id)}
                              title="Delete task"
                              aria-label="Delete task"
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

      {/* Car picker for inline edit */}
      <CarPickerModal
        show={pickerOpen}
        cars={cars}
        onClose={() => setPickerOpen(false)}
        onSelect={(carOrNull) => {
          setPickerOpen(false);
          if (carOrNull?._id)
            setEditData((p) => ({ ...p, car: carOrNull._id }));
        }}
      />
    </div>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
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

/* Styles identical to your table system (only wrapper scrolls horizontally) */
const css = `
:root { color-scheme: dark; }
html, body, #root { background:#0B1220; overflow-x:hidden; }
* { box-sizing:border-box; }

.cal-wrap{
  --bg:#0B1220; --panel:#0F172A; --muted:#9CA3AF; --text:#E5E7EB; --line:#1F2937;
  --primary:#2563EB; --danger:#DC2626; --ghost:#111827; --ring:#2E4B8F;
  color:var(--text); background:var(--bg);
  min-height:100vh; padding:20px; font-family: Inter, system-ui, -apple-system, Segoe UI, Arial;
  overflow-x:hidden;
}

.with-ham .cal-head { padding-left: 56px; }
@media (max-width: 480px){ .with-ham .cal-head { padding-left: 48px; } }

.cal-head{
  display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px;
  flex-wrap:wrap;
}
.cal-head-titles h1{ margin:0 0 2px; font-size:22px; }
.cal-sub{ margin:0; color:var(--muted); font-size:12px; }
.cal-head-actions{ display:flex; gap:8px; flex-wrap:wrap; }
.cal-alert{ background:#3B0D0D; border:1px solid #7F1D1D; color:#FECACA; padding:10px 12px; border-radius:12px; margin-bottom:12px; }

.btn{ border:1px solid transparent; border-radius:12px; padding:10px 14px; cursor:pointer; font-weight:600; }
.btn--primary{ background:var(--primary); color:#fff; }
.btn--danger{ background:var(--danger); color:#fff; }
.btn--ghost{ background:var(--ghost); color:#E5E7EB; border-color:#243041; }
.btn--sm{ padding:6px 10px; border-radius:10px; font-size:12px; }
.btn--icon{ padding:6px; width:32px; height:28px; display:inline-flex; align-items:center; justify-content:center; }

.cal-panel{ display:flex; flex-direction:column; gap:10px; min-width:0; }
.cal-table-clip{ width:100%; overflow:hidden; border-radius:14px; }
.cal-table-scroll{
  border:1px solid var(--line);
  border-radius:14px;
  background:var(--panel);
  overflow-x:auto;
  overflow-y:hidden;
  -webkit-overflow-scrolling:touch;
  padding-bottom:14px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.02), 0 10px 30px rgba(0,0,0,0.25);
}

/* visible scrollbar */
.cal-table-scroll::-webkit-scrollbar{ height:12px; }
.cal-table-scroll::-webkit-scrollbar-track{ background:#0B1220; border-radius:10px; }
.cal-table-scroll::-webkit-scrollbar-thumb{ background:#59637C; border:2px solid #0B1220; border-radius:10px; }
.cal-table-scroll:hover::-webkit-scrollbar-thumb{ background:#7B88A6; }
.cal-table-scroll{ scrollbar-color:#59637C #0B1220; scrollbar-width:thin; }

/* table */
.cal-table{ width:100%; border-collapse:separate; border-spacing:0; table-layout:fixed; min-width:720px; }
.cal-table thead th{
  position:sticky; top:0; z-index:1; background:var(--panel);
  border-bottom:1px solid var(--line);
  text-align:left; font-size:12px; color:var(--muted);
  padding:12px;
}
.cal-table tbody td{ padding:12px; border-bottom:1px solid var(--line); font-size:14px; color:#E5E7EB; vertical-align:middle; }
.cal-table tbody tr:hover{ background:#0B1428; }
.cal-empty{ text-align:center; padding:20px; color:var(--muted); }

.cal-table col.col-task{ width:44%; }
.cal-table col.col-car{ width:28%; }
.cal-table col.col-created{ width:16%; }
.cal-table col.col-actions{ width:120px; }

.cal-input{ width:100%; padding:8px 10px; border-radius:10px; border:1px solid #243041; background:#0B1220; color:#E5E7EB; outline:none; transition:border-color .2s, box-shadow .2s; }
.cal-input:focus{ border-color:#2E4B8F; box-shadow:0 0 0 3px rgba(37,99,235,.25); }

.car-edit{ display:flex; align-items:center; gap:8px; }
.cal-actions{ display:flex; align-items:center; justify-content:flex-end; gap:8px; white-space:nowrap; }

.cal-loading{ color:#E5E7EB; }

@media (max-width: 768px){
  .cal-table{ min-width:680px; }
}
`;
