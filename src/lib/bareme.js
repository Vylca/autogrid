// Barème: integer weights, steps and the resulting points.
// Every point value a grid can produce is a whole or a half point.
//
// Skills grid: each category has a weight. The 6 colors are worth 0 to 5 steps.
// Level grid: each criterion has a weight. The lowest level is worth 1 step,
// the next one 2 steps, and so on up to the highest level.
// Points = weight x steps x unit, where the unit is chosen so that the total
// matches the target mark whenever that is possible in half points.

export const COLOR_STEPS = 5;
export const MAX_WEIGHT = 20;

export function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

export function snapHalf(v) {
  return Math.round((Number(v) || 0) * 2) / 2;
}

export function weightOf(item) {
  const w = Math.round(Number(item?.weight));
  return w >= 1 ? Math.min(w, MAX_WEIGHT) : 1;
}

export function clampWeight(v) {
  const w = Math.round(Number(v));
  if (!Number.isFinite(w)) return 1;
  return Math.min(MAX_WEIGHT, Math.max(1, w));
}

export function weightedItems(grid) {
  if (grid.type === 'paliers') return grid.criteria || [];
  return (grid.rows || []).flatMap((r) => r.categories || []);
}

export function stepCount(grid) {
  return grid.type === 'paliers' ? (grid.levels || []).length : COLOR_STEPS;
}

function divisors(n) {
  const out = [];
  for (let d = 1; d <= n; d++) if (n % d === 0) out.push(d);
  return out;
}

export function scaleInfo(grid) {
  const items = weightedItems(grid);
  const weights = items.map(weightOf);
  const n = items.length;
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const g = weights.reduce((a, b) => gcd(a, b), 0) || 1;
  const steps = stepCount(grid);
  const target = Number(grid.target) > 0 ? Number(grid.target) : 20;
  const target2 = Math.round(target * 2);
  const targetIsHalf = Math.abs(target * 2 - target2) < 1e-9;

  const info = {
    n,
    totalWeight,
    steps,
    target,
    reachable: true,
    convert: false,
    internalMax: target,
    finalMax: target,
    unit: 0,
    possible: [],
    sums: [],
    sumsImpossible: false,
    targetImpossible: false,
  };
  if (n === 0 || steps === 0) return info;

  // Smallest valid maximum, counted in half points. Every valid maximum is a multiple of it.
  const base2 = (totalWeight / g) * steps;
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
  info.convert = !reachable && !!grid.convert;
  info.finalMax = info.convert ? target : info.internalMax;
  info.unit = info.internalMax / (totalWeight * steps);

  // Valid maxima closest to the target, shown as proposals.
  const all = [];
  const limit = Math.max(60, target * 3);
  for (let k = 1; (k * base2) / 2 <= limit; k++) all.push((k * base2) / 2);
  info.possible = all
    .sort((a, b) => Math.abs(a - target) - Math.abs(b - target) || a - b)
    .slice(0, 6)
    .sort((a, b) => a - b);

  if (!reachable) {
    const m = target2 / steps;
    if (!targetIsHalf || !Number.isInteger(m)) {
      info.targetImpossible = true;
    } else {
      info.sums = divisors(m).filter((d) => d >= n);
      info.sumsImpossible = info.sums.length === 0;
    }
  }
  return info;
}

// ---- Skills grid -------------------------------------------------------------

export function categoryMax(grid, cat, info = scaleInfo(grid)) {
  return snapHalf(weightOf(cat) * COLOR_STEPS * info.unit);
}

export function rowMax(grid, row, info = scaleInfo(grid)) {
  return row.categories.reduce((s, c) => s + categoryMax(grid, c, info), 0);
}

export function categoryEarned(grid, cat, code, info = scaleInfo(grid)) {
  const steps = Number(code) - 1;
  if (!(steps >= 0 && steps <= COLOR_STEPS)) return null;
  return snapHalf(weightOf(cat) * steps * info.unit);
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
  const crit = grid.criteria.find((c) => c.id === critId);
  if (!crit) return 0;
  return snapHalf(weightOf(crit) * grid.levels.length * info.unit);
}

export function cellDefault(grid, levelId, critId, info = scaleInfo(grid)) {
  const crit = grid.criteria.find((c) => c.id === critId);
  if (!crit) return 0;
  return snapHalf(weightOf(crit) * levelSteps(grid, levelId) * info.unit);
}

export function isCellPinned(grid, levelId, critId) {
  if (isTopLevel(grid, levelId)) return false;
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
// follow weight changes, and always read back as whole or half points.
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
