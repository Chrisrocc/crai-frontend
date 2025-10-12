// src/components/Uploads/UploadTray.jsx
import { useEffect, useState } from "react";
import { UploadQueue } from "../../lib/uploadQueue";

export default function UploadTray() {
  const [jobs, setJobs] = useState(UploadQueue.getSnapshot());

  useEffect(() => {
    const offChange = UploadQueue.on("change", setJobs);
    const offProgress = UploadQueue.on("progress", () => setJobs(UploadQueue.getSnapshot()));
    const offDone = UploadQueue.on("done", () => setJobs(UploadQueue.getSnapshot()));
    const offError = UploadQueue.on("error", () => setJobs(UploadQueue.getSnapshot()));
    return () => { offChange(); offProgress(); offDone(); offError(); };
  }, []);

  const visible = jobs.filter(j => j.status !== "done");
  if (!visible.length) return null;

  return (
    <div style={tray}>
      <div style={title}>Uploads</div>
      <div style={{ maxHeight: 240, overflow: "auto" }}>
        {jobs.map(j => (
          <div key={j.id} style={row}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={name}>
                {j.name}
                <span style={muted}> {Math.round((j.size || 0) / 1024)} KB</span>
              </div>
              <div style={muted}>Car: {j.carId?.slice?.(0, 8) || "-"}</div>
              <div style={barWrap}><div style={{ ...bar, width: `${j.progress || 0}%` }} /></div>
              <div style={muted}>
                {j.status}{j.error ? ` — ${j.error}` : ""}
              </div>
            </div>
            {j.status !== "done" && (
              <button onClick={() => UploadQueue.cancel(j.id)} style={btn} title="Cancel">✕</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const tray = {
  position: "fixed", right: 12, bottom: 12, zIndex: 1200,
  width: 320, background: "#0f172a", color: "#e5e7eb",
  border: "1px solid #1f2937", borderRadius: 12, padding: 10,
  boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
};
const title = { fontWeight: 800, marginBottom: 6, fontSize: 14 };
const row = { display: "flex", gap: 8, alignItems: "center", padding: "6px 0", borderTop: "1px solid #1f2937" };
const name = { fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const muted = { color: "#9ca3af", fontSize: 12 };
const barWrap = { height: 6, background: "#1f2937", borderRadius: 6, marginTop: 4, marginBottom: 4, overflow: "hidden" };
const bar = { height: "100%", background: "#2563EB" };
const btn = { border: "none", background: "#1f2937", color: "#e5e7eb", width: 28, height: 28, borderRadius: 8, cursor: "pointer" };
