import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import api from "../../lib/api";
import CarFormModal from "../Car/CarFormModal";

export default function CarPickerModal({ show, cars = [], onClose, onSelect }) {
  const [q, setQ] = useState("");
  const [photoCache, setPhotoCache] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [localCars, setLocalCars] = useState(cars);
  const inputRef = useRef(null);

  // keep local list in sync with prop (but allow us to insert new car without parent refresh)
  useEffect(() => {
    setLocalCars(cars || []);
  }, [cars]);

  // Focus + ESC
  useEffect(() => {
    if (!show) return;

    const t = setTimeout(() => inputRef.current?.focus(), 60);

    const onKey = (e) => {
      if (e.key === "Escape") {
        if (showAdd) setShowAdd(false);
        else onClose?.();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [show, showAdd, onClose]);

  // Search filter
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return localCars;
    return localCars.filter((c) =>
      [c.rego ?? "", c.make ?? "", c.model ?? "", (c.year ?? "").toString()]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [q, localCars]);

  // Lazy signed photo preview
  const fetchPhoto = useCallback(
    async (car) => {
      if (!car?._id) return "";
      if (photoCache[car._id]) return photoCache[car._id];

      try {
        const res = await api.get(`/cars/${car._id}/photo-preview`);
        const url = res?.data?.data || "";
        if (url) {
          setPhotoCache((p) => ({ ...p, [car._id]: url }));
          return url;
        }
      } catch (e) {
        console.warn(`❌ Error loading photo for ${car?.rego}`, e);
      }
      return "";
    },
    [photoCache]
  );

  const handleCarCreated = (createdCar) => {
    setShowAdd(false);
    if (!createdCar) return;

    setLocalCars((prev) => {
      const next = [createdCar, ...(prev || [])];
      const seen = new Set();
      return next.filter((c) => {
        const id = c?._id || c?.id;
        if (!id) return true;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
    });

    const rego = (createdCar.rego || "").trim();
    if (rego) setQ(rego);

    onSelect?.(createdCar);
  };

  if (!show) return null;

  return (
    <div
      className="cpk-wrap"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        // ✅ don’t let the picker close while nested Add Car modal is open
        if (showAdd) return;
        if (e.target.classList.contains("cpk-wrap")) onClose?.();
      }}
    >
      <style>{css}</style>

      {/* Nested Add Car modal */}
      <CarFormModal
        show={showAdd}
        onClose={() => setShowAdd(false)}
        onSave={handleCarCreated}
      />

      <div
        className="cpk-modal"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="cpk-head">
          <h3>Select a Car</h3>
          <button className="cpk-x" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="cpk-tools">
          <input
            ref={inputRef}
            className="cpk-input"
            placeholder="Search by rego, make, model, year…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="cpk-spacer" />

          <button className="cpk-btn cpk-btn--ghost" onClick={() => setShowAdd(true)}>
            + Add Car
          </button>

          <button className="cpk-btn cpk-btn--ghost" onClick={() => onSelect?.(null)}>
            Clear
          </button>

          <button className="cpk-btn cpk-btn--primary" onClick={onClose}>
            Done
          </button>
        </div>

        <div className="cpk-table-wrap">
          <table className="cpk-table">
            <colgroup>
              <col style={{ width: "70px" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "24%" }} />
              <col style={{ width: "24%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "14%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Photo</th>
                <th>Rego</th>
                <th>Make</th>
                <th>Model</th>
                <th>Year</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td className="cpk-empty" colSpan={6}>
                    No cars match your search.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <CarRow
                    key={c._id}
                    car={c}
                    fetchPhoto={fetchPhoto}
                    cachedUrl={photoCache[c._id]}
                    onSelect={onSelect}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CarRow({ car, fetchPhoto, cachedUrl, onSelect }) {
  const [photoUrl, setPhotoUrl] = useState(cachedUrl || "");

  useEffect(() => {
    let alive = true;
    if (!cachedUrl && car?.photos?.length) {
      fetchPhoto(car).then((url) => {
        if (!alive) return;
        if (url) setPhotoUrl(url);
      });
    }
    return () => {
      alive = false;
    };
  }, [car, cachedUrl, fetchPhoto]);

  return (
    <tr onDoubleClick={() => onSelect?.(car)}>
      <td className="car-photo-cell">
        {photoUrl ? (
          <img src={photoUrl} alt={`${car.make} ${car.model}`} />
        ) : (
          <div className="cpk-thumb--empty" />
        )}
      </td>
      <td>{car.rego || "—"}</td>
      <td>{car.make || "—"}</td>
      <td>{car.model || "—"}</td>
      <td>{car.year || "—"}</td>
      <td className="cpk-actions">
        <button className="cpk-btn cpk-btn--primary cpk-btn--sm" onClick={() => onSelect?.(car)}>
          Select
        </button>
      </td>
    </tr>
  );
}

const css = `
:root { color-scheme: dark; }
.cpk-wrap {
  position:fixed; inset:0; z-index:90;
  display:flex; align-items:center; justify-content:center;
  background:rgba(0,0,0,.55);
  backdrop-filter: blur(3px);
}
.cpk-modal {
  width:min(920px,calc(100vw - 32px));
  max-height:90vh;
  background:#0F172A; color:#E5E7EB;
  border:1px solid #1F2937;
  border-radius:14px;
  box-shadow:0 20px 60px rgba(0,0,0,.45);
  display:flex; flex-direction:column;
  overflow:hidden;
  animation: fadeUp .12s ease-out;
}
@keyframes fadeUp { from{transform:translateY(8px);opacity:.8} to{transform:none;opacity:1} }

.cpk-head {
  display:flex; align-items:center; justify-content:space-between;
  padding:14px 18px; border-bottom:1px solid #1F2937;
  background:#111827;
}
.cpk-x {
  border:1px solid #243041; background:#111827; color:#E5E7EB;
  width:32px; height:32px; border-radius:10px; cursor:pointer;
}
.cpk-head h3 { margin:0; font-size:18px; }

.cpk-tools {
  display:flex; align-items:center; gap:10px;
  padding:12px 16px; border-bottom:1px solid #1F2937;
}
.cpk-input {
  flex:1;
  padding:10px 12px;
  background:#0B1220;
  border:1px solid #243041;
  color:#E5E7EB;
  border-radius:10px;
}
.cpk-btn {
  border:1px solid transparent; border-radius:10px;
  padding:8px 14px; font-weight:600; cursor:pointer;
}
.cpk-btn--primary { background:#2563EB; color:#fff; }
.cpk-btn--ghost { background:#111827; color:#E5E7EB; border:1px solid #243041; }
.cpk-btn--sm { padding:6px 10px; font-size:12px; }
.cpk-table-wrap { flex:1; overflow-y:auto; }
.cpk-table {
  width:100%; border-collapse:collapse; font-size:13px;
}
.cpk-table th, .cpk-table td {
  padding:8px 10px; border-bottom:1px solid #1F2937;
}
.cpk-table th {
  background:#111827; color:#E5E7EB; text-align:left;
}
.cpk-empty { text-align:center; color:#9CA3AF; padding:20px; }
.car-photo-cell { width:68px; height:52px; }
.car-photo-cell img {
  width:68px; height:52px;
  object-fit:cover;
  border-radius:6px;
  display:block;
}
.cpk-thumb--empty {
  width:68px; height:52px; background:#1E293B; border-radius:6px;
}
.cpk-actions { text-align:right; }
`;
