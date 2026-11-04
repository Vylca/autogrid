// Score computation for one student on one grid.
import { scaleInfo, criterionMax, colorPoints, cellPoints, categoriesOf, usesRoles } from './bareme.js';

// Marks are always whole or half points.
export const ROUND_STEP = 0.5;

// Every gradable item of a grid, with its maximum points.
// Skills grid: one item per row, in category order. Level grid: one item per criterion.
// Group work: pass the student's role to get only the rows of that role.
export function gridItems(grid, info = scaleInfo(grid), roleId = undefined) {
  if (grid.type === 'paliers') {
    return grid.criteria.map((c) => ({ id: c.id, max: criterionMax(grid, c.id, info), criterion: c }));
  }
  const items = [];
  for (const cat of categoriesOf(grid)) {
    if (usesRoles(grid) && roleId !== undefined && cat.id !== roleId) continue;
    for (const row of cat.rows) items.push({ id: row.id, max: info.rowMax[row.id] || 0, row, category: cat });
  }
  return items;
}

// Group work: a student who is not in a group has no sheet.
export function noRoleScore(info) {
  return { score: null, internalScore: null, max: info.target, internalMax: info.total, converted: false, earned: 0, possible: 0, graded: 0, ungraded: 0, total: 0, status: 'noRole' };
}

export function roundTo(value, step) {
  if (!Number.isFinite(value)) return value;
  const s = Number(step) > 0 ? Number(step) : 0.01;
  const r = Math.round((value + 1e-9) / s) * s;
  return Math.round(r * 1000) / 1000;
}

// Points earned for one item.
// counted=false means excluded (A, D) or not graded yet.
export function itemScore(grid, item, mark, info = scaleInfo(grid)) {
  if (mark === undefined || mark === null || mark === '') return { earned: 0, counted: false, ungraded: true };
  if (mark === 'A' || mark === 'D') return { earned: 0, counted: false, excluded: true };
  if (mark === 'R') return { earned: 0, counted: true };
  if (grid.type === 'paliers') {
    if (!grid.levels.some((l) => l.id === mark)) return { earned: 0, counted: false, ungraded: true };
    return { earned: cellPoints(grid, mark, item.id, info), counted: true };
  }
  const earned = colorPoints(item.max, mark);
  if (earned === null) return { earned: 0, counted: false, ungraded: true };
  return { earned, counted: true };
}

// status: 'empty' (nothing graded), 'partial', 'complete', 'absent', 'exempt',
// 'noRole' (group work, student not placed in a group).
export function scoreStudent(grid, result, roleId = undefined) {
  const info = scaleInfo(grid);
  if (usesRoles(grid) && !categoriesOf(grid).some((c) => c.id === roleId)) return noRoleScore(info);
  const items = gridItems(grid, info, usesRoles(grid) ? roleId : undefined);
  const marks = result?.marks || {};
  let earned = 0;
  let possible = 0;
  let graded = 0;
  let ungraded = 0;
  let absent = 0;
  let exempt = 0;
  for (const item of items) {
    const mark = marks[item.id];
    const s = itemScore(grid, item, mark, info);
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
  // Exact when nothing is excluded. Exclusions (and grids whose rows do not add up
  // to the target) are scaled to the target and rounded once, to the half point.
  const converted = Math.abs(info.total - info.target) > 1e-9;
  let score = null;
  let internalScore = null;
  if (possible > 1e-9) {
    score = roundTo((earned / possible) * info.target, ROUND_STEP);
    internalScore = roundTo((earned / possible) * info.total, ROUND_STEP);
  } else if (graded > 0 && absent + exempt < graded) {
    score = 0;
    internalScore = 0;
  }
  return {
    score,
    internalScore,
    max: info.target,
    internalMax: info.total,
    converted,
    earned,
    possible,
    graded,
    ungraded,
    total: items.length,
    status,
  };
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
