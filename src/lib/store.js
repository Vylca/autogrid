import { reactive, watch } from 'vue';
import { emptyData, DATA_VERSION } from './model.js';
import { migrateGrid } from './migrate.js';

export const store = reactive({
  ready: false,
  loadError: false,
  data: emptyData(),
  route: { name: 'exams', id: null, tab: null },
  toasts: [],
});

function migrate(d) {
  const base = emptyData();
  const data = { ...base, ...d };
  data.settings = { ...base.settings, ...(d.settings || {}) };
  data.grids = Array.isArray(d.grids) ? d.grids : [];
  data.classes = Array.isArray(d.classes) ? d.classes : [];
  data.exams = Array.isArray(d.exams) ? d.exams : [];
  const fixGrid = migrateGrid;
  data.grids.forEach(fixGrid);
  for (const e of data.exams) {
    if (e.grid) fixGrid(e.grid);
    e.results = e.results || {};
  }
  data.version = DATA_VERSION;
  return data;
}

let timer = null;
let dirty = false;

function serialize() {
  return JSON.stringify(store.data, null, 1);
}

async function saveNow() {
  if (!dirty) return;
  dirty = false;
  try {
    await window.api.saveData(serialize());
  } catch (err) {
    console.error('save failed', err);
    dirty = true;
  }
}

function scheduleSave() {
  dirty = true;
  clearTimeout(timer);
  timer = setTimeout(saveNow, 350);
}

export function flushSave() {
  if (!dirty) return;
  dirty = false;
  clearTimeout(timer);
  window.api.saveDataSync(serialize());
}

export async function initStore() {
  let raw = null;
  try {
    raw = await window.api.loadData();
  } catch (err) {
    console.error(err);
  }
  if (raw) {
    try {
      store.data = migrate(JSON.parse(raw));
    } catch (err) {
      console.error('could not read data file', err);
      store.loadError = true;
    }
  }
  store.ready = true;
  // A file that could not be read is never overwritten automatically.
  if (!store.loadError) {
    watch(() => store.data, scheduleSave, { deep: true });
    window.addEventListener('beforeunload', flushSave);
  }
}

export function navigate(name, id = null, extra = {}) {
  store.route = { name, id, ...extra };
}

let toastSeq = 0;
export function toast(message, opts = {}) {
  const id = ++toastSeq;
  store.toasts.push({ id, message, kind: opts.kind || 'info', action: opts.action || null });
  setTimeout(() => dismissToast(id), opts.duration || 6000);
  return id;
}

export function dismissToast(id) {
  const i = store.toasts.findIndex((t) => t.id === id);
  if (i !== -1) store.toasts.splice(i, 1);
}

export function findGrid(id) {
  return store.data.grids.find((g) => g.id === id) || null;
}

export function findClass(id) {
  return store.data.classes.find((c) => c.id === id) || null;
}

export function findExam(id) {
  return store.data.exams.find((e) => e.id === id) || null;
}
