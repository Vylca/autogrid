import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newGrid, newCategory, newCriterion } from '../src/lib/model.js';
import { scaleInfo, categoryMax, rowMax, cellPoints, criterionMax, setCellPoints, resetCellPoints, snapHalf } from '../src/lib/bareme.js';
import { scoreStudent, roundTo, gridItems } from '../src/lib/scoring.js';
import { integerWeights, migrateGrid } from '../src/lib/migrate.js';
import { decodeBytes, extractStudents, splitFullName } from '../src/lib/csv.js';

const isHalf = (v) => Math.abs(v * 2 - Math.round(v * 2)) < 1e-9;

function skillsGrid(weights, target = 20) {
  const g = newGrid({ name: 't', type: 'competences', presetId: 'empty' });
  g.target = target;
  g.rows = [{ id: 'r1', level: 'A2', categories: weights.map((w, i) => ({ ...newCategory(`c${i}`, w), id: `c${i}` })) }];
  return g;
}

test('4 categories of weight 1 on 20: one step is one point', () => {
  const g = newGrid({ name: 't', type: 'competences', presetId: '3e' });
  const info = scaleInfo(g);
  assert.equal(info.reachable, true);
  assert.equal(info.finalMax, 20);
  assert.equal(info.unit, 1);
  g.rows.forEach((r) => assert.equal(rowMax(g, r, info), 5));
  const ids = gridItems(g).map((it) => it.id);
  // 6 -> 5 steps, 5 -> 4, 3 -> 2, 1 -> 0
  const r = scoreStudent(g, { marks: { [ids[0]]: '6', [ids[1]]: '5', [ids[2]]: '3', [ids[3]]: '1' } });
  assert.equal(r.score, 11);
  assert.equal(r.status, 'complete');
});

test('same grid on 10 and 40 gives half and double steps', () => {
  for (const [target, unit] of [[10, 0.5], [40, 2]]) {
    const g = skillsGrid([1, 1, 1, 1], target);
    const info = scaleInfo(g);
    assert.equal(info.reachable, true);
    assert.equal(info.unit, unit);
  }
});

test('3 categories cannot be on 20: nearest valid max and weight sums', () => {
  const g = skillsGrid([1, 1, 1]);
  const info = scaleInfo(g);
  assert.equal(info.reachable, false);
  assert.equal(info.internalMax, 22.5);
  assert.equal(info.finalMax, 22.5);
  assert.deepEqual(info.sums, [4, 8]);
  assert.ok(info.possible.includes(15) && info.possible.includes(22.5));
  // Weights 2, 1, 1 make 20 reachable.
  g.rows[0].categories[0].weight = 2;
  const ok = scaleInfo(g);
  assert.equal(ok.reachable, true);
  assert.deepEqual(g.rows[0].categories.map((c) => categoryMax(g, c, ok)), [10, 5, 5]);
});

test('9 categories can never be on 20', () => {
  const info = scaleInfo(skillsGrid(Array(9).fill(1)));
  assert.equal(info.reachable, false);
  assert.equal(info.sumsImpossible, true);
  assert.equal(info.internalMax, 22.5);
});

test('common factor in weights is ignored', () => {
  const a = scaleInfo(skillsGrid([2, 2, 2]));
  assert.equal(a.reachable, false);
  assert.equal(a.internalMax, 22.5);
  const b = scaleInfo(skillsGrid([2, 2, 2, 2]));
  assert.equal(b.reachable, true);
});

test('a target that is not a multiple of the steps is impossible', () => {
  const info = scaleInfo(skillsGrid([1, 1], 17));
  assert.equal(info.reachable, false);
  assert.equal(info.targetImpossible, true);
});

test('every reachable possible value is a whole or half point', () => {
  for (const weights of [[1], [2, 1, 1], [3, 1], [1, 1, 1, 1, 1, 1, 2], [5, 2, 1]]) {
    for (const target of [10, 15, 20, 25, 30, 40]) {
      const g = skillsGrid(weights, target);
      const info = scaleInfo(g);
      for (const cat of g.rows[0].categories) {
        for (let code = 1; code <= 6; code++) {
          const r = scoreStudent(g, { marks: { [cat.id]: String(code) } });
          assert.ok(r.status === 'partial' || r.status === 'complete');
          assert.ok(isHalf(categoryMax(g, cat, info) * (code - 1) / 5), `${weights} /${target}`);
        }
      }
      if (info.reachable) {
        const all = Object.fromEntries(g.rows[0].categories.map((c) => [c.id, '6']));
        assert.equal(scoreStudent(g, { marks: all }).score, target);
      }
    }
  }
});

test('convert to the target rounds the final mark to the half point', () => {
  const g = skillsGrid([1, 1, 1]);
  g.convert = true;
  const info = scaleInfo(g);
  assert.equal(info.internalMax, 22.5);
  assert.equal(info.finalMax, 20);
  // 5 + 4 steps + 0 steps, each step 1.5 pts: 13.5 / 22.5 -> 12 / 20
  const r = scoreStudent(g, { marks: { c0: '6', c1: '5', c2: '1' } });
  assert.equal(r.internalScore, 13.5);
  assert.equal(r.score, 12);
  // 7.5 + 6 + 3 = 16.5 / 22.5 -> 14.67 -> 14.5
  assert.equal(scoreStudent(g, { marks: { c0: '6', c1: '5', c2: '3' } }).score, 14.5);
});

test('special marks', () => {
  const g = skillsGrid([1, 1, 1, 1]);
  const ids = ['c0', 'c1', 'c2', 'c3'];
  // Dispensé: 5 + 4 + 2 out of 15 -> 14.67 -> 14.5
  let r = scoreStudent(g, { marks: { c0: '6', c1: '5', c2: '3', c3: 'D' } });
  assert.equal(r.score, 14.5);
  r = scoreStudent(g, { marks: Object.fromEntries(ids.map((i) => [i, 'R'])) });
  assert.equal(r.score, 0);
  r = scoreStudent(g, { marks: Object.fromEntries(ids.map((i) => [i, 'A'])) });
  assert.equal(r.status, 'absent');
  assert.equal(r.score, null);
  assert.equal(scoreStudent(g, { marks: { c0: '6' } }).status, 'partial');
  assert.equal(scoreStudent(g, { marks: {} }).status, 'empty');
});

test('level grid: steps from the lowest level, weights and manual cells', () => {
  const g = newGrid({ name: 'Banksy', type: 'paliers', presetId: '3e' });
  assert.deepEqual(g.levels.map((l) => l.level), ['B1', 'A2+', 'A2', 'A1+']);
  g.criteria = [newCriterion('Réalisation', 3), newCriterion('Cohérence', 2), newCriterion('Grammaire', 2), newCriterion('Lexique', 2), newCriterion('Prononciation', 1)];
  const info = scaleInfo(g);
  assert.equal(info.reachable, true);
  assert.equal(info.unit, 0.5);
  const [b1, a2p, a2, a1p] = g.levels.map((l) => l.id);
  const [real, coh, , , pron] = g.criteria.map((c) => c.id);
  assert.deepEqual([b1, a2p, a2, a1p].map((l) => cellPoints(g, l, coh)), [4, 3, 2, 1]);
  assert.deepEqual([b1, a2p, a2, a1p].map((l) => cellPoints(g, l, real)), [6, 4.5, 3, 1.5]);
  assert.deepEqual([b1, a2p, a2, a1p].map((l) => cellPoints(g, l, pron)), [2, 1.5, 1, 0.5]);
  // Manual value snaps to the half point, the top level cannot be changed.
  setCellPoints(g, a2p, real, 5.2);
  assert.equal(cellPoints(g, a2p, real), 5);
  setCellPoints(g, b1, real, 3);
  assert.equal(cellPoints(g, b1, real), 6);
  setCellPoints(g, a1p, real, 99);
  assert.equal(cellPoints(g, a1p, real), 6);
  resetCellPoints(g, a1p, real);
  assert.equal(cellPoints(g, a1p, real), 1.5);
  const all = Object.fromEntries(g.criteria.map((c) => [c.id, b1]));
  assert.equal(scoreStudent(g, { marks: all }).score, 20);
  assert.equal(scoreStudent(g, { marks: { ...all, [real]: a2p, [coh]: a2 } }).score, 17);
  // Manual cells follow a weight change and stay on half points.
  g.criteria[0].weight = 4;
  const after = scaleInfo(g);
  assert.ok(isHalf(cellPoints(g, a2p, real, after)));
  assert.ok(isHalf(criterionMax(g, real, after)));
});

test('migration from version 0.1 keeps proportions', () => {
  assert.deepEqual(integerWeights([5, 5, 5, 5]), [1, 1, 1, 1]);
  assert.deepEqual(integerWeights([8, 4, 4, 4]), [2, 1, 1, 1]);
  assert.deepEqual(integerWeights([2, 2, 2.6667, 2.6667, 2.6667, 4, 4]), [3, 3, 4, 4, 4, 6, 6]);
  const old = {
    id: 'g',
    type: 'competences',
    maxScore: 20,
    rounding: 0.5,
    scale: { 6: 100 },
    rows: [
      { id: 'r', level: 'A2', points: 12, pinned: true, categories: [{ id: 'a', points: 8, pinned: true }, { id: 'b', points: 4 }] },
      { id: 's', level: 'B1', points: 8, categories: [{ id: 'c', points: 8 }] },
    ],
  };
  migrateGrid(old);
  assert.equal(old.target, 20);
  assert.equal(old.maxScore, undefined);
  assert.deepEqual(old.rows.flatMap((r) => r.categories.map((c) => c.weight)), [2, 1, 2]);
  assert.equal(scaleInfo(old).reachable, false);
  assert.equal(old.convert, true);
  assert.equal(scaleInfo(old).finalMax, 20);
  const pal = { id: 'p', type: 'paliers', maxScore: 20, levels: [{ id: 'l1', level: 'B1' }, { id: 'l2', level: 'A2' }], criteria: [{ id: 'x', points: 12 }, { id: 'y', points: 8 }], cells: { l1: { x: { ratio: 0.5, pinned: true } }, l2: { x: { ratio: 0.4, pinned: true } } } };
  migrateGrid(pal);
  assert.deepEqual(pal.criteria.map((c) => c.weight), [3, 2]);
  assert.equal(pal.cells.l1.x.pinned, false);
  assert.equal(cellPoints(pal, 'l2', 'x'), 5);
});

test('rounding helpers', () => {
  assert.equal(roundTo(14.24, 0.5), 14);
  assert.equal(roundTo(14.25, 0.5), 14.5);
  assert.equal(snapHalf(2.3), 2.5);
  assert.equal(snapHalf(2.2), 2);
});

test('name splitting', () => {
  assert.deepEqual(splitFullName('EJANGUE ESSAKA Darnell'), { lastName: 'EJANGUE ESSAKA', firstName: 'Darnell' });
  assert.deepEqual(splitFullName('SIDIBÉ Maïssa'), { lastName: 'SIDIBÉ', firstName: 'Maïssa' });
  assert.deepEqual(splitFullName('Jean-Marie DUPONT'), { lastName: 'DUPONT', firstName: 'Jean-Marie' });
  assert.deepEqual(splitFullName("D'ALMEIDA Anne Sophie"), { lastName: "D'ALMEIDA", firstName: 'Anne Sophie' });
});

test('pronote export', { skip: !process.env.PRONOTE_CSV }, () => {
  const text = decodeBytes(readFileSync(process.env.PRONOTE_CSV));
  const { students, className, error } = extractStudents(text);
  assert.equal(error, null);
  assert.equal(students.length, 24);
  assert.equal(className, '');
  assert.deepEqual(students[0], { lastName: 'BATHILY', firstName: 'Ibrahima' });
  assert.deepEqual(students[11], { lastName: 'ISACCO LENOBLE', firstName: 'Clara' });
});

test('simple csv with separate columns and class', () => {
  const text = 'Nom,Prénom,Classe\nMARTIN,Léa,5A\nDURAND,Tom,5A\n';
  const r = extractStudents(text);
  assert.equal(r.className, '5A');
  assert.deepEqual(r.students[1], { lastName: 'DURAND', firstName: 'Tom' });
});

test('windows-1252 decoding', () => {
  const bytes = new Uint8Array([0x45, 0x6c, 0xe8, 0x76, 0x65, 0x73]);
  assert.equal(decodeBytes(bytes), 'Elèves');
});
