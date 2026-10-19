// Score computation for one student on one grid.
import { cellPoints, criterionMax } from './weights.js';

// Every gradable item of a grid, with its maximum points.
// Competences grid: one item per category. Paliers grid: one item per criterion.
export function gridItems(grid) {
  if (grid.type === 'paliers') {
    return grid.criteria.map((c) => ({ id: c.id, max: criterionMax(grid, c.id), criterion: c }));
  }
  const items = [];
  for (const row of grid.rows) {
    for (const cat of row.categories) items.push({ id: cat.id, max: cat.points, row, category: cat });
  }
  return items;
}

export function roundTo(value, step) {
  if (!Number.isFinite(value)) return value;
  const s = Number(step) > 0 ? Number(step) : 0.01;
  const r = Math.round((value + 1e-9) / s) * s;
  return Math.round(r * 1000) / 1000;
}

// Points earned for one item, or null when the item is not counted.
// Returns { earned, counted } where counted=false means excluded (A, D) or ungraded.
export function itemScore(grid, item, mark) {
  if (mark === undefined || mark === null || mark === '') return { earned: 0, counted: false, ungraded: true };
  if (mark === 'A' || mark === 'D') return { earned: 0, counted: false, excluded: true };
  if (mark === 'R') return { earned: 0, counted: true };
  if (grid.type === 'paliers') {
    if (!grid.levels.some((l) => l.id === mark)) return { earned: 0, counted: false, ungraded: true };
    return { earned: cellPoints(grid, mark, item.id), counted: true };
  }
  const pct = Number(grid.scale?.[mark]);
  if (!Number.isFinite(pct)) return { earned: 0, counted: false, ungraded: true };
  return { earned: (item.max * pct) / 100, counted: true };
}

// status: 'empty' (nothing graded), 'partial', 'complete', 'absent', 'exempt'
export function scoreStudent(grid, result) {
  const items = gridItems(grid);
  const marks = result?.marks || {};
  let earned = 0;
  let possible = 0;
  let graded = 0;
  let ungraded = 0;
  let absent = 0;
  let exempt = 0;
  for (const item of items) {
    const mark = marks[item.id];
    const s = itemScore(grid, item, mark);
    if (s.ungraded) {
      ungraded++;
      continue;
    }
    graded++;
    if (mark === 'A') absent++;
    if (mark === 'D') exempt++;
    if (s.counted) {
      earned += s.earned;
      possible += item.max;
    }
  }
  let status;
  if (items.length === 0 || graded === 0) status = 'empty';
  else if (ungraded > 0) status = 'partial';
  else status = 'complete';
  if (graded > 0 && ungraded === 0 && absent + exempt === items.length) {
    status = absent > 0 ? 'absent' : 'exempt';
  }
  let score = null;
  if (possible > 1e-9) {
    score = roundTo((earned / possible) * grid.maxScore, grid.rounding);
  } else if (graded > 0 && absent + exempt < graded) {
    // Only "non rendu" marks with zero-point items.
    score = 0;
  }
  return { score, earned, possible, graded, ungraded, total: items.length, status };
}

export function classAverage(grid, results, studentIds) {
  const scores = [];
  for (const id of studentIds) {
    const s = scoreStudent(grid, results[id]);
    if (s.status === 'complete' && s.score !== null) scores.push(s.score);
  }
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

export function formatNumber(value, lang, maxDecimals = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'fr-FR', {
    maximumFractionDigits: maxDecimals,
    minimumFractionDigits: 0,
  }).format(value);
}
