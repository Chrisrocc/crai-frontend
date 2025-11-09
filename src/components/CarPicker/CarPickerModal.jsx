// src/components/CarPicker/CarPickerModal.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import api from "../../lib/api";

export default function CarPickerModal({ show, cars = [], onClose, onSelect }) {
  const [q, setQ] = useState("");
  const [photoCache, setPhotoCache] = useState({});
  const inputRef = useRef(null);

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

  // 🔗 Load signed URLs only when needed
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
      <td>
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={`${car.make || ""} ${car.model || ""}`}
            className="cpk-thumb"
            onError={(e) => (e.target.style.display = "none")}
          />
        ) : (
          <div className="cpk-thumb cpk-thumb--empty" />
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

const css = `/* identical to your previous styling */`;
