import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Car Picker Modal with photo logging
 */
export default function CarPickerModal({ show, cars = [], onClose, onSelect }) {
  const [q, setQ] = useState("");
  const inputRef = useRef(null);

  // Focus & ESC
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

  // Filter cars
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

  // 🔍 Debug-enabled photo resolver
  const resolvePhotoUrl = (car) => {
    if (!car?.photos?.length) {
      console.log(`🚫 No photos for ${car.rego}`);
      return "";
    }

    const first = car.photos[0];
    console.log("🖼️ car.photos[0] for", car.rego, "=", first);

    const key =
      typeof first === "string"
        ? first
        : typeof first?.key === "string"
        ? first.key
        : "";

    if (!key) {
      console.log(`⚠️ No valid key for ${car.rego}`, first);
      return "";
    }

    const cleanKey = key.replace(/^npai-car-photos[\\/]/, "");
    const fullUrl = `https://npai-car-photos.s3.ap-southeast-2.amazonaws.com/${cleanKey}`;
    console.log(`✅ Resolved photo for ${car.rego}:`, fullUrl);
    return fullUrl;
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
                filtered.map((c) => {
                  const photoUrl = resolvePhotoUrl(c);
                  return (
                    <tr key={c._id} onDoubleClick={() => onSelect?.(c)}>
                      <td>
                        {photoUrl ? (
                          <img
                            src={photoUrl}
                            alt={`${c.make || ""} ${c.model || ""}`}
                            className="cpk-thumb"
                            onError={(e) => {
                              console.warn("🧩 Image failed to load for", c.rego, photoUrl);
                              e.target.style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="cpk-thumb cpk-thumb--empty" />
                        )}
                      </td>
                      <td>{c.rego || "—"}</td>
                      <td>{c.make || "—"}</td>
                      <td>{c.model || "—"}</td>
                      <td>{c.year || "—"}</td>
                      <td className="cpk-actions">
                        <button
                          className="cpk-btn cpk-btn--primary cpk-btn--sm"
                          onClick={() => onSelect?.(c)}
                        >
                          Select
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const css = `
:root { color-scheme: dark; }
.cpk-wrap {
  position: fixed; inset: 0; z-index: 60;
  background: rgba(0,0,0,.55); backdrop-filter: blur(2px);
  display:flex; align-items:center; justify-content:center;
}
.cpk-modal {
  width: min(900px, calc(100vw - 32px));
  max-height: min(80vh, 900px);
  display:flex; flex-direction:column;
  background:#0F172A; color:#E5E7EB;
  border:1px solid #1F2937; border-radius:14px;
  box-shadow: 0 20px 60px rgba(0,0,0,.4);
}
.cpk-head { display:flex; align-items:center; justify-content:space-between; padding:12px 14px; border-bottom:1px solid #1F2937; }
.cpk-head h3 { margin:0; font-size:16px; }
.cpk-x { border:none; background:#111827; color:#E5E7EB; border:1px solid #243041; width:28px; height:28px; border-radius:8px; cursor:pointer; }

.cpk-tools { display:flex; align-items:center; gap:8px; padding:10px 14px; border-bottom:1px solid #1F2937; }
.cpk-input {
  flex:0 1 420px; max-width:520px; padding:8px 10px; border-radius:10px;
  border:1px solid #243041; background:#0B1220; color:#E5E7EB; outline:none;
}
.cpk-input:focus { border-color:#2E4B8F; box-shadow:0 0 0 3px rgba(37,99,235,0.25); }
.cpk-spacer { flex:1; }

.cpk-btn { border:1px solid transparent; border-radius:10px; padding:8px 12px; cursor:pointer; font-weight:600; }
.cpk-btn--primary { background:#2563EB; color:#fff; }
.cpk-btn--ghost { background:#111827; color:#E5E7EB; border-color:#243041; }
.cpk-btn--sm { padding:6px 10px; font-size:12px; border-radius:8px; }

.cpk-table-wrap { overflow:auto; padding:10px 12px 14px; }
.cpk-table { width:100%; border-collapse:collapse; table-layout:fixed; }
.cpk-table thead th {
  position:sticky; top:0; z-index:1; background:#0F172A;
  border-bottom:1px solid #1F2937; color:#9CA3AF;
  font-size:12px; text-align:left; padding:10px;
}
.cpk-table tbody td {
  padding:10px; border-bottom:1px solid #1F2937;
  font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  vertical-align:middle;
}
.cpk-table tbody tr:hover { background:#0B1428; }
.cpk-actions { text-align:right; vertical-align:middle; }
.cpk-empty { text-align:center; color:#9CA3AF; padding:18px; }

/* Thumbnails */
.cpk-thumb {
  width:60px; height:60px; object-fit:cover; border-radius:8px;
  background:#1F2937; border:1px solid #243041;
}
.cpk-thumb--empty {
  display:inline-block; width:60px; height:60px; border-radius:8px;
  background:#111827; border:1px solid #243041;
}
`;
