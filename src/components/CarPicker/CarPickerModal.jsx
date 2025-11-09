import { useEffect, useMemo, useRef, useState } from "react";
import api from "../../lib/api";

export default function CarPickerModal({ show, cars = [], onClose, onSelect }) {
  const [q, setQ] = useState("");
  const [photoCache, setPhotoCache] = useState({});
  const inputRef = useRef(null);

  // focus + escape
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [show, onClose]);

  // search filter
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return cars;
    return cars.filter((c) =>
      [c.rego ?? "", c.make ?? "", c.model ?? "", (c.year ?? "").toString()]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [q, cars]);

  // signed URL loader
  const fetchPhoto = async (car) => {
    if (photoCache[car._id]) return photoCache[car._id];
    try {
      const res = await api.get(`/cars/${car._id}/photo-preview`);
      const url = res?.data?.data || "";
      if (url) {
        setPhotoCache((p) => ({ ...p, [car._id]: url }));
        console.log(`✅ Signed photo loaded for ${car.rego}`);
        return url;
      } else {
        console.log(`🚫 No photo for ${car.rego}`);
      }
    } catch (err) {
      console.warn(`❌ Error loading photo for ${car.rego}`, err);
    }
    return "";
  };

  if (!show) return null;

  return (
    <div className="cpk-wrap" role="dialog" aria-modal="true" onClick={onClose}>
      <style>{css}</style>
      <div className="cpk-modal" role="document" onClick={(e) => e.stopPropagation()}>
        <header className="cpk-head">
          <h3>Select a Car</h3>
          <button className="cpk-x" onClick={onClose} aria-label="Close">
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
    if (!cachedUrl && car?.photos?.length) {
      fetchPhoto(car).then((url) => url && setPhotoUrl(url));
    }
  }, [car, cachedUrl, fetchPhoto]);

  return (
    <tr onDoubleClick={() => onSelect?.(car)}>
      <td className="car-photo-cell">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={`${car.make || ""} ${car.model || ""}`}
            onError={(e) => (e.target.style.display = "none")}
          />
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
.cpk-wrap {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
.cpk-modal {
  background: #1a1a1a;
  color: #fff;
  width: 90%;
  max-width: 960px;
  border-radius: 10px;
  box-shadow: 0 0 20px rgba(0,0,0,0.5);
  overflow: hidden;
}
.cpk-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #222;
  padding: 10px 16px;
  border-bottom: 1px solid #333;
}
.cpk-head h3 {
  margin: 0;
  font-size: 18px;
}
.cpk-x {
  background: none;
  color: #ccc;
  border: none;
  font-size: 20px;
  cursor: pointer;
}
.cpk-tools {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  border-bottom: 1px solid #333;
}
.cpk-input {
  flex: 1;
  background: #111;
  border: 1px solid #333;
  color: #fff;
  border-radius: 4px;
  padding: 6px 10px;
}
.cpk-btn {
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  padding: 6px 12px;
}
.cpk-btn--primary {
  background: #0078ff;
  color: #fff;
}
.cpk-btn--ghost {
  background: transparent;
  color: #aaa;
  border: 1px solid #444;
}
.cpk-btn--sm {
  font-size: 12px;
  padding: 4px 8px;
}
.cpk-table-wrap {
  max-height: 65vh;
  overflow-y: auto;
}
.cpk-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.cpk-table th,
.cpk-table td {
  padding: 6px 8px;
  border-bottom: 1px solid #222;
}
.cpk-table th {
  background: #191919;
  text-align: left;
  font-weight: 600;
}
.cpk-empty {
  text-align: center;
  padding: 20px;
  color: #888;
}

/* ✅ fixed photo cell */
.car-photo-cell {
  width: 64px;
  min-width: 64px;
  height: 48px;
  overflow: hidden;
}
.car-photo-cell img {
  width: 64px;
  height: 48px;
  object-fit: cover;
  border-radius: 4px;
  display: block;
}
.cpk-thumb--empty {
  width: 64px;
  height: 48px;
  background: #222;
  border-radius: 4px;
}
.cpk-actions {
  text-align: right;
}
`;
