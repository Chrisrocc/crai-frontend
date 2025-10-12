// src/lib/uploadQueue.js
/* Persistent upload queue using IndexedDB + in-memory worker.
   - Adds jobs { carId, file, caption? }
   - Emits events: "change", "progress", "done", "error"
   - Resumes unfinished uploads on next app load
   - Uses your existing API: /photos/presign -> S3 PUT -> /photos/attach
*/
import api from "./api";

// ----- Tiny event emitter -----
const listeners = new Map();
/** @returns {() => void} unsubscribe */
function on(evt, fn) {
  if (!listeners.has(evt)) listeners.set(evt, new Set());
  listeners.get(evt).add(fn);
  return () => off(evt, fn);
}
function off(evt, fn) { listeners.get(evt)?.delete(fn); }
function emit(evt, payload) { listeners.get(evt)?.forEach(fn => fn(payload)); }

// ----- IndexedDB helpers (no deps) -----
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
        const store = db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}
async function idbAdd(job) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add(job).onsuccess = (e) => resolve(e.target.result);
    tx.onerror = () => reject(tx.error);
  });
}
async function idbPut(job) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(job).onsuccess = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbGetAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
async function idbDelete(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id).onsuccess = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ----- Queue state -----
const state = {
  jobs: [],        // [{id, carId, name, size, type, caption, status, progress, error, createdAt, file?}]
  running: false,
  concurrency: 3,
  inFlight: 0,
};

// NOTE: Avoid destructuring `{ file }` so ESLint doesn't complain about unused var.
function snapshot() {
  return state.jobs.map((j) => {
    const rest = { ...j };
    delete rest.file; // strip File blob from UI-facing snapshot
    return rest;
  });
}

function markNeedsFile(job) {
  job.status = "needs-file"; // Indicates tab was killed mid-upload; file is gone from memory
  job.progress = 0;
}

// Try uploading a single job
async function runJob(job) {
  job.status = "presigning";
  job.progress = 0;
  await idbPut(job);
  emit("change", snapshot());

  // Ensure we still have the File (only kept in memory)
  if (!(job.file instanceof File)) {
    markNeedsFile(job);
    await idbPut(job);
    emit("change", snapshot());
    return;
  }

  // 1) Get presigned URL
  const pres = await api.post("/photos/presign", {
    carId: job.carId,
    filename: job.name,
    contentType: job.type || "application/octet-stream",
  });
  const { key, uploadUrl } = pres.data?.data || {};
  if (!key || !uploadUrl) throw new Error("Presign failed");

  // 2) PUT to S3 with progress (use XHR to get progress in browsers)
  job.status = "uploading";
  emit("change", snapshot());
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader("Content-Type", job.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        job.progress = Math.round((e.loaded / e.total) * 100);
        emit("progress", { id: job.id, progress: job.progress });
      }
    };
    xhr.onload = () =>
      (xhr.status >= 200 && xhr.status < 300)
        ? resolve()
        : reject(new Error(`S3 PUT ${xhr.status}`));
    xhr.onerror = () => reject(new Error("S3 PUT network error"));
    xhr.send(job.file);
  });

  // 3) Attach to car
  job.status = "attaching";
  emit("change", snapshot());
  await api.post("/photos/attach", { carId: job.carId, key, caption: job.caption || "" });

  // Done
  job.status = "done";
  job.progress = 100;
  job.error = "";
  await idbDelete(job.id);
  emit("done", { id: job.id });
}

// Worker loop
async function tick() {
  if (state.running) return;
  state.running = true;

  try {
    while (true) {
      const canStart = state.inFlight < state.concurrency;
      const next = state.jobs.find(j => j.status === "queued" || j.status === "retry");
      if (!canStart || !next) break;

      state.inFlight++;
      (async () => {
        try {
          await idbPut(next);            // persist status
          await runJob(next);
          // Remove from memory
          state.jobs = state.jobs.filter(j => j.id !== next.id);
          emit("change", snapshot());
        } catch (e) {
          next.status = "retry";
          next.error = String(e?.message || e);
          await idbPut(next);
          emit("error", { id: next.id, error: next.error });
        } finally {
          state.inFlight--;
          tick(); // continue
        }
      })();
    }
  } finally {
    state.running = false;
  }
}

// Public API
export const UploadQueue = {
  on, off,
  async init() {
    const stored = await idbGetAll();
    // Restore stored jobs as retry (without File blobs). Worker will mark them needs-file after first run.
    state.jobs = (stored || [])
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
      .map(j => ({ ...j, file: undefined, status: j.status === "done" ? "done" : "retry", progress: j.progress || 0 }));
    emit("change", snapshot());
    tick();
  },
  async enqueue({ carId, file, caption = "" }) {
    const job = {
      id: undefined,
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
    // keep the actual File only in memory
    job.file = file;
    state.jobs.push(job);
    emit("change", snapshot());
    tick();
    return id;
  },
  getSnapshot: snapshot,
  async cancel(id) {
    await idbDelete(id);
    state.jobs = state.jobs.filter(j => j.id !== id);
    emit("change", snapshot());
  },
  setConcurrency(n) {
    state.concurrency = Math.max(1, Math.min(5, Number(n) || 3));
  },
};
