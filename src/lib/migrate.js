// Converts grids saved by version 0.1 (points and percentages) to weights.
import { gcd, MAX_WEIGHT, scaleInfo } from './bareme.js';

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
  return best.map((x) => Math.min(MAX_WEIGHT, x / g));
}

export function migrateGrid(g) {
  const fromV1 = g.target === undefined;
  if (fromV1) g.target = Number(g.maxScore) > 0 ? Number(g.maxScore) : 20;
  if (g.convert === undefined) g.convert = false;
  g.rows = g.rows || [];
  g.levels = g.levels || [];
  g.criteria = g.criteria || [];
  g.cells = g.cells || {};
  if (g.type === 'paliers') {
    if (g.criteria.some((c) => c.weight === undefined)) {
      const w = integerWeights(g.criteria.map((c) => c.points));
      g.criteria.forEach((c, i) => (c.weight = w[i]));
    }
    for (const c of g.criteria) {
      delete c.points;
      delete c.pinned;
    }
    // The top level now always follows the criterion weight.
    const top = g.levels[0]?.id;
    if (top && g.cells[top]) {
      for (const cell of Object.values(g.cells[top])) {
        cell.pinned = false;
        cell.ratio = null;
      }
    }
  } else {
    const cats = g.rows.flatMap((r) => r.categories || []);
    if (cats.some((c) => c.weight === undefined)) {
      const w = integerWeights(cats.map((c) => c.points));
      cats.forEach((c, i) => (c.weight = w[i]));
    }
    for (const c of cats) {
      delete c.points;
      delete c.pinned;
    }
    for (const r of g.rows) {
      r.categories = r.categories || [];
      delete r.points;
      delete r.pinned;
    }
  }
  delete g.maxScore;
  delete g.rounding;
  delete g.scale;
  if (g.categoryComments === undefined) g.categoryComments = false;
  // Old grids were always converted to their maximum mark. Keep that when the
  // new weights cannot reach it exactly, so existing marks stay on the same scale.
  if (fromV1 && !scaleInfo(g).reachable) g.convert = true;
  return g;
}
