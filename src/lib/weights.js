// Weight distribution between sibling items (rows, categories, criteria).
// Every item has { points, pinned }. The sum of points always equals `total`.
// Editing one item pins it, and the remaining points are shared evenly
// between the items that are not pinned.

const EPS = 1e-9;

function sum(items) {
  return items.reduce((s, it) => s + (Number(it.points) || 0), 0);
}

export function clampNumber(v, min, max) {
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}

// Set item `index` to `value` and redistribute the rest.
export function setWeight(items, index, value, total) {
  const n = items.length;
  if (n === 0) return;
  if (n === 1) {
    items[0].points = total;
    items[0].pinned = false;
    return;
  }
  const others = [];
  for (let i = 0; i < n; i++) if (i !== index) others.push(i);
  let free = others.filter((i) => !items[i].pinned);
  if (free.length === 0) {
    // Everything else is pinned: release them so the total can still balance.
    for (const i of others) items[i].pinned = false;
    free = others;
  }
  const pinnedSum = others.filter((i) => items[i].pinned).reduce((s, i) => s + items[i].points, 0);
  const v = clampNumber(Number(value), 0, Math.max(0, total - pinnedSum));
  items[index].points = v;
  items[index].pinned = true;
  const rest = Math.max(0, total - pinnedSum - v);
  for (const i of free) items[i].points = rest / free.length;
}

// Recompute free items after an add, a removal or an unpin.
export function rebalance(items, total) {
  const n = items.length;
  if (n === 0) return;
  if (n === 1) {
    items[0].points = total;
    items[0].pinned = false;
    return;
  }
  const pinned = items.filter((it) => it.pinned);
  const free = items.filter((it) => !it.pinned);
  const pinnedSum = sum(pinned);
  if (free.length === 0) {
    scaleTo(items, total);
    return;
  }
  if (pinnedSum > total + EPS) {
    scaleTo(pinned, total);
    for (const it of free) it.points = 0;
    return;
  }
  const each = (total - pinnedSum) / free.length;
  for (const it of free) it.points = each;
}

// Scale all items so they add up to `total`, keeping their proportions.
export function scaleTo(items, total) {
  const s = sum(items);
  if (items.length === 0) return;
  if (s <= EPS) {
    for (const it of items) it.points = total / items.length;
    return;
  }
  const f = total / s;
  for (const it of items) it.points = it.points * f;
}

export function resetEven(items, total) {
  for (const it of items) {
    it.pinned = false;
    it.points = items.length ? total / items.length : 0;
  }
}

export function unpin(items, index, total) {
  if (!items[index]) return;
  items[index].pinned = false;
  rebalance(items, total);
}

// ---- Grid level helpers -------------------------------------------------

// Competences grid: rows share maxScore, categories share their row's points.
export function syncCategories(row) {
  if (row.categories.length === 0) return;
  const s = sum(row.categories);
  if (s <= EPS) {
    rebalance(row.categories, row.points);
  } else if (Math.abs(s - row.points) > EPS) {
    scaleTo(row.categories, row.points);
  }
}

export function setRowPoints(grid, index, value) {
  setWeight(grid.rows, index, value, grid.maxScore);
  grid.rows.forEach(syncCategories);
}

export function rebalanceRows(grid) {
  rebalance(grid.rows, grid.maxScore);
  grid.rows.forEach(syncCategories);
}

export function setCategoryPoints(row, index, value) {
  setWeight(row.categories, index, value, row.points);
}

export function setMaxScore(grid, value) {
  const v = clampNumber(Number(value), 1, 1000);
  if (grid.type === 'competences') {
    scaleTo(grid.rows, v);
    grid.maxScore = v;
    grid.rows.forEach(syncCategories);
  } else {
    scaleTo(grid.criteria, v);
    grid.maxScore = v;
  }
}

// Paliers grid: criteria share maxScore. Each cell is worth a share of its
// criterion's points. By default the top level is worth 100%, and each level
// below loses an equal step (4 levels: 100, 75, 50, 25%).
export function defaultRatio(levelIndex, levelCount) {
  if (levelCount <= 0) return 0;
  return (levelCount - levelIndex) / levelCount;
}

export function cellRatio(grid, levelId, criterionId) {
  const cell = grid.cells?.[levelId]?.[criterionId];
  if (cell && cell.pinned && Number.isFinite(cell.ratio)) return cell.ratio;
  const idx = grid.levels.findIndex((l) => l.id === levelId);
  return defaultRatio(idx, grid.levels.length);
}

export function cellPoints(grid, levelId, criterionId) {
  const crit = grid.criteria.find((c) => c.id === criterionId);
  if (!crit) return 0;
  return crit.points * cellRatio(grid, levelId, criterionId);
}

export function criterionMax(grid, criterionId) {
  let max = 0;
  for (const l of grid.levels) max = Math.max(max, cellPoints(grid, l.id, criterionId));
  return max;
}

export function ensureCell(grid, levelId, criterionId) {
  if (!grid.cells[levelId]) grid.cells[levelId] = {};
  if (!grid.cells[levelId][criterionId]) {
    grid.cells[levelId][criterionId] = { descriptor: '', ratio: null, pinned: false };
  }
  return grid.cells[levelId][criterionId];
}

export function setCellPoints(grid, levelId, criterionId, value) {
  const crit = grid.criteria.find((c) => c.id === criterionId);
  if (!crit) return;
  const cell = ensureCell(grid, levelId, criterionId);
  const v = clampNumber(Number(value), 0, crit.points);
  cell.ratio = crit.points > EPS ? v / crit.points : 0;
  cell.pinned = true;
}

export function resetCellPoints(grid, levelId, criterionId) {
  const cell = ensureCell(grid, levelId, criterionId);
  cell.pinned = false;
  cell.ratio = null;
}

export function setCriterionPoints(grid, index, value) {
  setWeight(grid.criteria, index, value, grid.maxScore);
}

export function rebalanceCriteria(grid) {
  rebalance(grid.criteria, grid.maxScore);
}
