// Core constants and factories for grids, classes and exams.

export const CECRL_LEVELS = ['A1', 'A1+', 'A2', 'A2+', 'B1', 'B1+', 'B2', 'B2+', 'C1', 'C2'];

export const PLACEMENT_PRESETS = [
  { id: '5e', levels: ['A1', 'A1+', 'A2', 'A2+'] },
  { id: '3e', levels: ['A1+', 'A2', 'A2+', 'B1'] },
  { id: 'all', levels: CECRL_LEVELS },
  { id: 'empty', levels: [] },
];

// Acquisition levels, LSU / Pronote style. Codes 1 to 6, 6 being the best.
export const ACQ_LEVELS = [
  { code: '6', key: 'tbm', color: '#0E7A3A', text: '#FFFFFF' },
  { code: '5', key: 'ms', color: '#3DA84A', text: '#FFFFFF' },
  { code: '4', key: 'pm', color: '#A4CF3A', text: '#1C2333' },
  { code: '3', key: 'mf', color: '#F5D020', text: '#1C2333' },
  { code: '2', key: 'dm', color: '#F2901E', text: '#1C2333' },
  { code: '1', key: 'mi', color: '#E2231A', text: '#FFFFFF' },
];

// Special marks. A and D remove the item from the total, R counts as 0.
export const SPECIAL_MARKS = [
  { code: 'A', key: 'absent' },
  { code: 'D', key: 'exempt' },
  { code: 'R', key: 'notHandedIn' },
];

export const DATA_VERSION = 2;

export function uid() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

export function emptyData() {
  return {
    version: DATA_VERSION,
    settings: { lang: 'fr' },
    grids: [],
    classes: [],
    exams: [],
  };
}

export function acqLevel(code) {
  return ACQ_LEVELS.find((l) => l.code === code) || null;
}

export function isSpecial(code) {
  return code === 'A' || code === 'D' || code === 'R';
}

export function newCategory(name = '', weight = 1) {
  return { id: uid(), name, descriptor: '', weight };
}

export function newRow(level) {
  return { id: uid(), level, categories: [] };
}

export function newCriterion(name = '', weight = 1) {
  return { id: uid(), name, group: '', weight };
}

export function newLevel(level) {
  return { id: uid(), level };
}

export function newGrid({ name, type, presetId }) {
  const preset = PLACEMENT_PRESETS.find((p) => p.id === presetId) || PLACEMENT_PRESETS[3];
  const now = new Date().toISOString();
  const grid = {
    id: uid(),
    name: name || '',
    type: type === 'paliers' ? 'paliers' : 'competences',
    target: 20,
    convert: false,
    categoryComments: false,
    rows: [],
    levels: [],
    criteria: [],
    cells: {},
    createdAt: now,
    updatedAt: now,
  };
  if (grid.type === 'competences') {
    grid.rows = preset.levels.map((lvl) => {
      const row = newRow(lvl);
      row.categories = [newCategory('')];
      return row;
    });
  } else {
    // Level grids read from the highest level down, like printed CECRL grids.
    grid.levels = [...preset.levels].reverse().map((lvl) => newLevel(lvl));
    grid.criteria = [newCriterion('')];
  }
  return grid;
}

export function cloneDeep(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// Copy a grid with fresh ids, used for "duplicate".
export function duplicateGrid(grid, suffix) {
  const g = cloneDeep(grid);
  g.id = uid();
  g.name = `${grid.name}${suffix}`;
  const now = new Date().toISOString();
  g.createdAt = now;
  g.updatedAt = now;
  if (g.type === 'competences') {
    for (const row of g.rows) {
      row.id = uid();
      for (const c of row.categories) c.id = uid();
    }
  } else {
    const levelMap = {};
    const critMap = {};
    for (const l of g.levels) {
      const id = uid();
      levelMap[l.id] = id;
      l.id = id;
    }
    for (const c of g.criteria) {
      const id = uid();
      critMap[c.id] = id;
      c.id = id;
    }
    const cells = {};
    for (const [lid, row] of Object.entries(g.cells || {})) {
      if (!levelMap[lid]) continue;
      cells[levelMap[lid]] = {};
      for (const [cid, cell] of Object.entries(row)) {
        if (critMap[cid]) cells[levelMap[lid]][critMap[cid]] = cell;
      }
    }
    g.cells = cells;
  }
  return g;
}

export function newClass(name, students = []) {
  return { id: uid(), name, students };
}

export function newStudent(lastName, firstName) {
  return { id: uid(), lastName: lastName || '', firstName: firstName || '' };
}

export function sortStudents(students) {
  return [...students].sort(
    (a, b) =>
      a.lastName.localeCompare(b.lastName, 'fr', { sensitivity: 'base' }) ||
      a.firstName.localeCompare(b.firstName, 'fr', { sensitivity: 'base' }),
  );
}

export function newExam({ name, date, classId, grid }) {
  const copy = cloneDeep(grid);
  return {
    id: uid(),
    name: name || '',
    date: date || new Date().toISOString().slice(0, 10),
    classId,
    sourceGridId: grid.id,
    grid: copy,
    results: {},
    createdAt: new Date().toISOString(),
  };
}

export function emptyResult() {
  return { marks: {}, comments: {}, comment: '' };
}
