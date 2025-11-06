// src/lib/uploadQueue.js
/* Upload queue with logging for debugging inconsistent uploads */
import api from "./api";

const listeners = new Map();
function on(evt, fn) {
  if (!listeners.has(evt)) listeners.set(evt, new Set());
  listeners.get(evt).add(fn);
  return () => off(evt, fn);
}
function off(evt, fn) { listeners.get(evt)?.delete(fn); }
function emit(evt, payload) { listeners.get(evt)?.forEach(fn => fn(payload)); }

const DB_NAME = "npai-upload-queue";
const STORE = "jobs";
let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}
async function idbAdd(job) { const db = await openDB(); return new Promise((res, rej) => { const tx = db.transaction(STORE, "readwrite"); const store = tx.objectStore(STORE); const j = { ...job }; if (j.id === undefined) delete j.id; const req = store.add(j); req.onsuccess = e => res(e.target.result); req.onerror = () => rej(tx.error); }); }
async function idbPut(job) { const db = await openDB(); return new Promise((res, rej) => { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).put(job); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }
async function idbGetAll() { const db = await openDB(); return new Promise((res, rej) => { const tx = db.transaction(STORE, "readonly"); const req = tx.objectStore(STORE).getAll(); req.onsuccess = () => res(req.result || []); req.onerror = () => rej(req.error); }); }
async function idbDelete(id) { const db = await openDB(); return new Promise((res, rej) => { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).delete(id); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }

const state = { jobs: [], running: false, inFlight: 0, concurrency: 2 };

function snapshot() {
  return state.jobs.map(j => {
    const c = { ...j };
    delete c.file;
    return c;
  });
}

async function runJob(job) {
  console.log("📸 [UploadQueue] Starting job:", {
    id: job.id, carId: job.carId, name: job.name, size: job.size
  });

  job.status = "presigning";
  await idbPut(job);
  emit("change", snapshot());

  if (!(job.file instanceof File)) {
    console.warn("⚠️ File missing from memory:", job.id);
    job.status = "needs-file";
    await idbPut(job);
    emit("change", snapshot());
    return;
  }

  // 1️⃣ Presign
  let key, uploadUrl;
  try {
    const pres = await api.post("/photos/presign", {
      carId: job.carId,
      filename: job.name,
      contentType: job.type || "application/octet-stream",
    });
    key = pres.data?.data?.key;
    uploadUrl = pres.data?.data?.uploadUrl;
    console.log("✅ Presign success:", { carId: job.carId, key });
  } catch (e) {
    console.error("❌ Presign failed:", e.message);
    throw e;
  }

  // 2️⃣ Upload
  job.status = "uploading";
  emit("change", snapshot());

  try {
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const timeout = setTimeout(() => {
        xhr.abort();
        reject(new Error("Upload timeout (90s)"));
      }, 90000);
      xhr.open("PUT", uploadUrl, true);
      xhr.setRequestHeader("Content-Type", job.type || "application/octet-stream");
      xhr.upload.onprogress = e => {
        if (e.lengthComputable) {
          job.progress = Math.round((e.loaded / e.total) * 100);
          emit("progress", { id: job.id, progress: job.progress });
        }
      };
      xhr.onload = () => {
        clearTimeout(timeout);
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`S3 PUT ${xhr.status}`));
      };
      xhr.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("S3 network error"));
      };
      xhr.send(job.file);
    });
    console.log("✅ Upload success:", { key, carId: job.carId });
  } catch (e) {
    console.error("❌ Upload failed:", e.message);
    throw e;
  }

  // 3️⃣ Attach
  job.status = "attaching";
  emit("change", snapshot());
  try {
    await api.post("/photos/attach", { carId: job.carId, key, caption: job.caption || "" });
    console.log("✅ Attach success:", { carId: job.carId, key });
  } catch (e) {
    console.error("❌ Attach failed:", e.message);
    throw e;
  }

  job.status = "done";
  job.progress = 100;
  await idbDelete(job.id);
  emit("done", { id: job.id });
  console.log("🏁 Job complete:", { carId: job.carId, key });
}

async function tick() {
  if (state.running) return;
  state.running = true;
  try {
    while (true) {
      const next = state.jobs.find(j => ["queued", "retry"].includes(j.status));
      if (!next || state.inFlight >= state.concurrency) break;
      state.inFlight++;
      (async () => {
        try {
          await runJob(next);
          state.jobs = state.jobs.filter(j => j.id !== next.id);
          emit("change", snapshot());
        } catch (e) {
          next.status = "retry";
          next.error = e.message;
          next.progress = 0;
          await idbPut(next);
          emit("error", { id: next.id, error: e.message });
          console.warn("🔁 Retrying later:", e.message);
        } finally {
          state.inFlight--;
          setTimeout(tick, 1500);
        }
      })();
    }
  } finally {
    state.running = false;
  }
}

export const UploadQueue = {
  on, off,
  async init() {
    const stored = await idbGetAll();
    state.jobs = (stored || []).map(j => ({
      ...j,
      file: undefined,
      status: j.status === "done" ? "done" : "retry",
      progress: j.progress || 0,
    }));
    emit("change", snapshot());
    tick();
  },
  async enqueue({ carId, file, caption = "" }) {
    const job = {
      carId,
      name: file?.name || "upload.jpg",
      size: file?.size || 0,
      type: file?.type || "application/octet-stream",
      caption,
      status: "queued",
      progress: 0,
      error: "",
      createdAt: Date.now(),
    };
    const id = await idbAdd(job);
    job.id = id;
    job.file = file;
    state.jobs.push(job);
    emit("change", snapshot());
    tick();
    console.log("🆕 Enqueued upload:", { id, carId, name: job.name, size: job.size });
    return id;
  },
  async cancel(id) {
    await idbDelete(id);
    state.jobs = state.jobs.filter(j => j.id !== id);
    emit("change", snapshot());
  },
  getSnapshot: snapshot,
};
