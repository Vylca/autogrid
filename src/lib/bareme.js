// Barème: how the target mark is shared out, always in whole or half points.
//
// Importance works in parts. A normal item has 4 parts, each +1 adds one part
// (a quarter more), each -1 removes one. The target mark is shared between
// categories (or criteria) in proportion to their parts, rounded to the half
// point so the total stays exactly on the target. Inside a category, rows share
// its points equally, or by their own importance when that option is on.
// Colors are worth 0 to 5 fifths of a row, levels 1 to N Nths of a criterion,
// each rounded to the half point.

export const COLOR_STEPS = 5;
export const BASE_PARTS = 4;
export const MIN_IMPORTANCE = -3;
export const MAX_IMPORTANCE = 8;
// Below this, two colors of a row give the same points.
export const DISTINCT_COLORS_MIN = 2.5;

export function snapHalf(v) {
  return Math.round((Number(v) || 0) * 2) / 2;
}

export function clampImportance(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_IMPORTANCE, Math.max(MIN_IMPORTANCE, n));
}

export function importanceOf(item) {
  return clampImportance(item?.importance || 0);
}

export function partsOf(item) {
  return BASE_PARTS + importanceOf(item);
}

// Shares `total` in half points, in proportion to `parts`. The result always
// adds up to `total`. Leftover half points go to the largest remainders, then
// to the most important items, then in order.
export function splitHalf(total, parts) {
  const n = parts.length;
  if (n === 0) return [];
  const units = Math.max(0, Math.round(Number(total) * 2));
  let p = parts.map((x) => Math.max(0, Math.round(Number(x) || 0)));
  let sum = p.reduce((a, b) => a + b, 0);
  if (sum === 0) {
    p = p.map(() => 1);
    sum = n;
  }
  const q = p.map((x) => Math.floor((units * x) / sum));
  const rem = p.map((x) => (units * x) % sum);
  let left = units - q.reduce((a, b) => a + b, 0);
  const order = p.map((_, i) => i).sort((a, b) => rem[b] - rem[a] || p[b] - p[a] || a - b);
  for (const i of order) {
    if (left <= 0) break;
    q[i]++;
    left--;
  }
  return q.map((u) => u / 2);
}

// Points of a color (code 1 to 6, 6 being the best) for a row worth `max`.
export function colorPoints(max, code) {
  const steps = Number(code) - 1;
  if (!(Number.isInteger(steps) && steps >= 0 && steps <= COLOR_STEPS)) return null;
  const units = Math.round(max * 2);
  return Math.floor((2 * units * steps + COLOR_STEPS) / (2 * COLOR_STEPS)) / 2;
}

// Points of level k (1 = lowest, n = highest) for a criterion worth `max`.
export function levelPoints(max, k, n) {
  if (n <= 0) return 0;
  const units = Math.round(max * 2);
  return Math.floor((2 * units * k + n) / (2 * n)) / 2;
}

// Group work with roles: each role (a category) is a separate sheet.
export function usesRoles(grid) {
  return !!(grid.groupWork && grid.useRoles);
}

export function categoriesOf(grid) {
  return grid.type === 'paliers' ? [] : grid.categories || [];
}

export function rowsOf(grid) {
  return categoriesOf(grid).flatMap((c) => c.rows || []);
}

export function scaleInfo(grid) {
  const target = Number(grid.target) > 0 ? Number(grid.target) : 20;
  const info = {
    target,
    total: 0,
    legacy: !!grid.legacy,
    rowMax: {},
    catMax: {},
    critMax: {},
    warnings: [],
  };
  const merged = [];
  const zero = [];
  const empty = [];

  if (grid.type === 'paliers') {
    const crits = grid.criteria || [];
    const pts = info.legacy ? crits.map((c) => snapHalf(c.fixedPoints)) : splitHalf(target, crits.map(partsOf));
    const n = (grid.levels || []).length;
    crits.forEach((c, i) => {
      info.critMax[c.id] = pts[i];
      if (pts[i] === 0) zero.push(c.id);
      else if (n > 1 && pts[i] < n * 0.5) merged.push(c.id);
    });
    info.total = pts.reduce((a, b) => a + b, 0);
  } else {
    const cats = categoriesOf(grid);
    if (info.legacy) {
      for (const cat of cats) {
        let sum = 0;
        for (const r of cat.rows) {
          info.rowMax[r.id] = snapHalf(r.fixedPoints);
          sum += info.rowMax[r.id];
        }
        info.catMax[cat.id] = sum;
      }
    } else {
      // Categories without rows get nothing, so the rows always add up to the target.
      const filled = cats.filter((c) => c.rows.length > 0);
      // Group work: each role is a separate grid, graded on the whole target.
      const catPts = usesRoles(grid) ? filled.map(() => target) : splitHalf(target, filled.map(partsOf));
      for (const cat of cats) info.catMax[cat.id] = 0;
      filled.forEach((cat, i) => {
        info.catMax[cat.id] = catPts[i];
        const parts = cat.rows.map((r) => (grid.rowImportance ? partsOf(r) : 1));
        const rowPts = splitHalf(catPts[i], parts);
        cat.rows.forEach((r, j) => (info.rowMax[r.id] = rowPts[j]));
      });
    }
    for (const cat of cats) {
      if (grid.useCategories && cat.rows.length === 0) empty.push(cat.id);
      for (const r of cat.rows) {
        const m = info.rowMax[r.id];
        if (m === 0) zero.push(r.id);
        else if (m < DISTINCT_COLORS_MIN) merged.push(r.id);
      }
    }
    info.total = usesRoles(grid)
      ? Math.max(0, ...cats.map((c) => info.catMax[c.id] || 0))
      : Object.values(info.rowMax).reduce((a, b) => a + b, 0);
  }

  if (zero.length) info.warnings.push({ type: 'zero', ids: zero });
  if (merged.length) info.warnings.push({ type: 'merged', ids: merged });
  if (empty.length) info.warnings.push({ type: usesRoles(grid) ? 'emptyRole' : 'emptyCategory', ids: empty });
  info.flagged = new Set([...zero, ...merged]);
  return info;
}

// ---- Level grid -----------------------------------------------------------------

export function levelSteps(grid, levelId) {
  const i = grid.levels.findIndex((l) => l.id === levelId);
  return i === -1 ? 0 : grid.levels.length - i;
}

export function isTopLevel(grid, levelId) {
  return grid.levels[0]?.id === levelId;
}

export function criterionMax(grid, critId, info = scaleInfo(grid)) {
  return info.critMax[critId] || 0;
}

export function cellDefault(grid, levelId, critId, info = scaleInfo(grid)) {
  return levelPoints(criterionMax(grid, critId, info), levelSteps(grid, levelId), grid.levels.length);
}

export function isCellPinned(grid, levelId, critId) {
  if (!grid.cellOverride || isTopLevel(grid, levelId)) return false;
  const cell = grid.cells?.[levelId]?.[critId];
  return !!(cell && cell.pinned && Number.isFinite(cell.ratio));
}

export function cellPoints(grid, levelId, critId, info = scaleInfo(grid)) {
  const top = criterionMax(grid, critId, info);
  if (isTopLevel(grid, levelId)) return top;
  if (isCellPinned(grid, levelId, critId)) {
    const ratio = Math.min(1, Math.max(0, grid.cells[levelId][critId].ratio));
    return snapHalf(ratio * top);
  }
  return cellDefault(grid, levelId, critId, info);
}

export function ensureCell(grid, levelId, critId) {
  if (!grid.cells[levelId]) grid.cells[levelId] = {};
  if (!grid.cells[levelId][critId]) {
    grid.cells[levelId][critId] = { descriptor: '', ratio: null, pinned: false };
  }
  return grid.cells[levelId][critId];
}

// Manual points for a lower level, kept as a share of the top cell so they
// follow importance changes, and always read back as whole or half points.
export function setCellPoints(grid, levelId, critId, value) {
  if (isTopLevel(grid, levelId)) return;
  const top = criterionMax(grid, critId);
  if (top <= 0) return;
  const v = Math.min(top, Math.max(0, snapHalf(value)));
  const cell = ensureCell(grid, levelId, critId);
  cell.ratio = v / top;
  cell.pinned = true;
}

export function resetCellPoints(grid, levelId, critId) {
  const cell = ensureCell(grid, levelId, critId);
  cell.pinned = false;
  cell.ratio = null;
}
