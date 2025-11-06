// src/lib/uploadQueue.js
/* Persistent upload queue using IndexedDB + in-memory worker.
   - Adds jobs { carId, file, caption? }
   - Emits events: "change", "progress", "done", "error"
   - Resumes unfinished uploads on next app load
   - Uses your API: /photos/presign -> S3 PUT -> /photos/attach
   - Now includes retry + timeout protection for mobile uploads
*/
import api from "./api";

// ---------- tiny event emitter ----------
const listeners = new Map();
export function on(evt, fn) {
  if (!listeners.has(evt)) listeners.set(evt, new Set());
  listeners.get(evt).add(fn);
  return () => off(evt, fn);
}
export function off(evt, fn) {
  listeners.get(evt)?.delete(fn);
}
function emit(evt, payload) {
  listeners.get(evt)?.forEach(fn => fn(payload));
}

// ---------- IndexedDB helpers ----------
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
    const store = tx.objectStore(STORE);
    const clean = { ...job };
    if (clean.id === undefined) delete clean.id;
    const req = store.add(clean);
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = () => reject(tx.error);
  });
}
async function idbPut(job) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(job);
    tx.oncomplete = () => resolve();
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
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------- queue state ----------
const state = {
  jobs: [],
  running: false,
  inFlight: 0,
  concurrency: 2,
  _init: false,
};

// ---------- helpers ----------
function snapshot() {
  return state.jobs.map(j => {
    const clone = { ...j };
    delete clone.file;
    return clone;
  });
}
function markNeedsFile(job) {
  job.status = "needs-file";
  job.progress = 0;
}

// ---------- upload worker ----------
async function runJob(job) {
  job.status = "presigning";
  job.progress = 0;
  await idbPut(job);
  emit("change", snapshot());

  if (!(job.file instanceof File)) {
    markNeedsFile(job);
    await idbPut(job);
    emit("change", snapshot());
    return;
  }

  // 1️⃣ get presigned URL
  const pres = await api.post("/photos/presign", {
    carId: job.carId,
    filename: job.name,
    contentType: job.type || "application/octet-stream",
  });
  const { key, uploadUrl } = pres.data?.data || {};
  if (!key || !uploadUrl) throw new Error("Presign failed");

  // 2️⃣ upload to S3 with timeout + progress
  job.status = "uploading";
  emit("change", snapshot());

  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let timeoutId = setTimeout(() => {
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
      clearTimeout(timeoutId);
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`S3 PUT ${xhr.status}`));
    };
    xhr.onerror = () => {
      clearTimeout(timeoutId);
      reject(new Error("S3 network error"));
    };
    xhr.send(job.file);
  });

  // 3️⃣ attach to car
  job.status = "attaching";
  emit("change", snapshot());
  await api.post("/photos/attach", { carId: job.carId, key, caption: job.caption || "" });

  // ✅ done
  job.status = "done";
  job.progress = 100;
  job.error = "";
  await idbDelete(job.id);
  emit("done", { id: job.id });
}

// ---------- worker loop ----------
async function tick() {
  if (state.running) return;
  state.running = true;
  try {
    while (true) {
      const canStart = state.inFlight < state.concurrency;
      const next = state.jobs.find(j => ["queued", "retry"].includes(j.status));
      if (!canStart || !next) break;

      state.inFlight++;
      (async () => {
        try {
          await idbPut(next);
          await runJob(next);
          state.jobs = state.jobs.filter(j => j.id !== next.id);
          emit("change", snapshot());
        } catch (err) {
          console.warn("Upload error:", err.message);
          next.status = "retry";
          next.error = err.message;
          next.progress = 0;
          await idbPut(next);
          emit("error", { id: next.id, error: err.message });
        } finally {
          state.inFlight--;
          setTimeout(tick, 1000); // retry queue every second
        }
      })();
    }
  } finally {
    state.running = false;
  }
}

// ---------- public API ----------
export const UploadQueue = {
  on,
  off,
  async init() {
    if (state._init) return;
    state._init = true;
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
    return id;
  },

  async cancel(id) {
    await idbDelete(id);
    state.jobs = state.jobs.filter(j => j.id !== id);
    emit("change", snapshot());
  },

  getSnapshot: snapshot,
  setConcurrency(n) {
    state.concurrency = Math.max(1, Math.min(5, Number(n) || 2));
  },
};
