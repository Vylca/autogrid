// Brings grids saved by earlier versions to the current format.
//   0.1: points and percentages.
//   0.2: integer weights, every color worth an equal step.
//   0.3: categories with their own rows, importance in parts.
// Grids of assessments that already have marks keep their exact points
// ("legacy"), so no mark changes. Templates switch to the new calculation.
import { GRID_MODEL } from './model.js';
import { BASE_PARTS, clampImportance, snapHalf } from './bareme.js';

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

const MAX_WEIGHT_V2 = 20;

// ---- 0.1 -> 0.2 ------------------------------------------------------------------

// Smallest integer weights that keep the proportions of the old points.
export function integerWeights(values) {
  const v = values.map((x) => (Number(x) > 0 ? Number(x) : 0));
  const pos = v.filter((x) => x > 0);
  if (!pos.length) return v.map(() => 1);
  const min = Math.min(...pos);
  const total = v.reduce((a, b) => a + b, 0);
  let best = null;
  let bestErr = Infinity;
  for (let m = 1; m <= 6; m++) {
    const w = v.map((x) => Math.max(1, Math.round((x / min) * m)));
    const sw = w.reduce((a, b) => a + b, 0);
    const err = w.reduce((e, wi, i) => e + Math.abs(wi / sw - v[i] / total), 0);
    if (err < bestErr - 1e-6) {
      best = w;
      bestErr = err;
    }
  }
  const g = best.reduce((a, b) => gcd(a, b), 0) || 1;
  return best.map((x) => Math.min(MAX_WEIGHT_V2, x / g));
}

function migrateV1toV2(g) {
  g.target = Number(g.maxScore) > 0 ? Number(g.maxScore) : 20;
  g.convert = false;
  g.rows = g.rows || [];
  g.levels = g.levels || [];
  g.criteria = g.criteria || [];
  g.cells = g.cells || {};
  if (g.type === 'paliers') {
    if (g.criteria.some((c) => c.weight === undefined)) {
      const w = integerWeights(g.criteria.map((c) => c.points));
      g.criteria.forEach((c, i) => (c.weight = w[i]));
    }
    // The top level follows the criterion weight from 0.2 on.
    const top = g.levels[0]?.id;
    if (top && g.cells[top]) {
      for (const cell of Object.values(g.cells[top])) {
        cell.pinned = false;
        cell.ratio = null;
      }
    }
  } else {
    const items = g.rows.flatMap((r) => r.categories || []);
    if (items.some((c) => c.weight === undefined)) {
      const w = integerWeights(items.map((c) => c.points));
      items.forEach((c, i) => (c.weight = w[i]));
    }
  }
  delete g.maxScore;
  delete g.rounding;
  delete g.scale;
  // 0.1 always converted to its maximum mark. Keep that when 0.2 weights cannot reach it.
  if (!scaleInfoV2(g).reachable) g.convert = true;
}

// ---- 0.2 calculation, kept to read the exact points of graded assessments ----

function weightV2(item) {
  const w = Math.round(Number(item?.weight));
  return w >= 1 ? Math.min(w, MAX_WEIGHT_V2) : 1;
}

function scaleInfoV2(g) {
  const items = g.type === 'paliers' ? g.criteria || [] : (g.rows || []).flatMap((r) => r.categories || []);
  const weights = items.map(weightV2);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const steps = g.type === 'paliers' ? (g.levels || []).length : 5;
  const target = Number(g.target) > 0 ? Number(g.target) : 20;
  const info = { reachable: true, internalMax: target, finalMax: target, unit: 0 };
  if (!items.length || !steps) return info;
  const gg = weights.reduce((a, b) => gcd(a, b), 0) || 1;
  const base2 = (totalWeight / gg) * steps;
  const target2 = Math.round(target * 2);
  const targetIsHalf = Math.abs(target * 2 - target2) < 1e-9;
  const reachable = targetIsHalf && target2 % base2 === 0;
  let internal2 = target2;
  if (!reachable) {
    const k = Math.max(1, Math.round((target * 2) / base2));
    internal2 = [k - 1, k, k + 1]
      .filter((x) => x >= 1)
      .map((x) => x * base2)
      .sort((a, b) => Math.abs(a - target * 2) - Math.abs(b - target * 2) || b - a)[0];
  }
  info.reachable = reachable;
  info.internalMax = internal2 / 2;
  info.finalMax = !reachable && g.convert ? target : info.internalMax;
  info.unit = info.internalMax / (totalWeight * steps);
  return info;
}

function itemMaxV2(g, item, info) {
  const steps = g.type === 'paliers' ? g.levels.length : 5;
  return snapHalf(weightV2(item) * steps * info.unit);
}

// ---- Importance from 0.2 weights ----------------------------------------------------

// Importance whose parts (4 + importance) best match the given proportions.
function importances(values) {
  const min = Math.min(...values.filter((v) => v > 0));
  if (!Number.isFinite(min)) return values.map(() => 0);
  return values.map((v) => clampImportance(Math.round((BASE_PARTS * v) / min) - BASE_PARTS));
}

function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// ---- 0.2 -> 0.3 ------------------------------------------------------------------------

function migrateV2toV3(g, legacy) {
  const info = scaleInfoV2(g);
  if (g.type === 'paliers') {
    const crits = g.criteria || [];
    const imp = importances(crits.map(weightV2));
    crits.forEach((c, i) => {
      c.importance = imp[i];
      if (legacy) c.fixedPoints = itemMaxV2(g, c, info);
      delete c.weight;
      delete c.points;
      delete c.pinned;
    });
    const top = g.levels[0]?.id;
    g.cellOverride = Object.entries(g.cells || {}).some(
      ([lid, row]) => lid !== top && Object.values(row).some((cell) => cell && cell.pinned),
    );
    g.categories = [];
  } else {
    // Old items that share a name become one category. Each item becomes a row.
    const groups = [];
    const byName = new Map();
    for (const oldRow of g.rows || []) {
      for (const item of oldRow.categories || []) {
        const key = norm(item.name);
        let group = byName.get(key);
        if (!group) {
          group = { name: String(item.name || '').trim(), items: [] };
          byName.set(key, group);
          groups.push(group);
        }
        group.items.push({ item, level: oldRow.level });
      }
    }
    const named = groups.some((gr) => gr.name);
    let cats;
    if (!named) {
      cats = [{ name: '', items: groups.flatMap((gr) => gr.items) }];
    } else {
      cats = groups;
    }
    const catImp = importances(cats.map((c) => c.items.reduce((s, x) => s + weightV2(x.item), 0)));
    let rowImportance = false;
    g.categories = cats.map((c, ci) => {
      const rowImp = importances(c.items.map((x) => weightV2(x.item)));
      if (rowImp.some((v) => v !== 0)) rowImportance = true;
      return {
        id: c.items[0]?.item.id ? `c${c.items[0].item.id}` : `c${ci}`,
        name: c.name,
        importance: named ? catImp[ci] : 0,
        rows: c.items.map((x, ri) => {
          const row = { id: x.item.id, level: x.level, descriptor: x.item.descriptor || '', importance: rowImp[ri] };
          if (legacy) row.fixedPoints = itemMaxV2(g, x.item, info);
          return row;
        }),
      };
    });
    g.useCategories = named;
    g.rowImportance = rowImportance;
    g.cellOverride = false;
    g.levels = g.levels || [];
    g.criteria = g.criteria || [];
    g.cells = g.cells || {};
  }
  if (legacy) {
    g.legacy = true;
    g.target = info.finalMax;
  }
  delete g.rows;
  delete g.convert;
  g.presetId = g.presetId || 'empty';
  if (g.categoryComments === undefined) g.categoryComments = false;
  g.model = GRID_MODEL;
}

// legacy: keep the exact points of the old calculation (graded assessments).
export function migrateGrid(g, { legacy = false } = {}) {
  if (g.model !== GRID_MODEL) {
    if (g.target === undefined) migrateV1toV2(g);
    migrateV2toV3(g, legacy);
  }
  // 0.4 only had group work with roles.
  if (g.groupWork && g.useRoles === undefined) g.useRoles = true;
  if (g.groupSize === undefined) g.groupSize = 2;
  // Before 0.8, every role had its own sheet.
  if (g.roleGrids === undefined) g.roleGrids = !!(g.groupWork && g.useRoles);
  if (!Array.isArray(g.roles)) g.roles = [];
  return g;
}

export function migrateExam(e) {
  e.results = e.results || {};
  e.groups = Array.isArray(e.groups) ? e.groups : [];
  if (!e.grid) return e;
  const wasOld = e.grid.model !== GRID_MODEL;
  const graded = Object.values(e.results).some((r) => r && r.marks && Object.keys(r.marks).length > 0);
  migrateGrid(e.grid, { legacy: graded });
  // Comments per item become comments per category when the grid has categories.
  if (wasOld && e.grid.type !== 'paliers' && e.grid.useCategories) {
    const catOf = {};
    for (const c of e.grid.categories) for (const r of c.rows) catOf[r.id] = c.id;
    for (const r of Object.values(e.results)) {
      if (!r || !r.comments) continue;
      const out = {};
      for (const [id, text] of Object.entries(r.comments)) {
        if (!text) continue;
        const key = catOf[id] || id;
        out[key] = out[key] ? `${out[key]}\n${text}` : text;
      }
      r.comments = out;
    }
  }
  return e;
}
