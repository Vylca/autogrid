import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newGrid, newCategory, newRow, newCriterion, newExam, emptyResult } from '../src/lib/model.js';
import { splitHalf, colorPoints, levelPoints, scaleInfo, cellPoints, setCellPoints, resetCellPoints, snapHalf } from '../src/lib/bareme.js';
import { scoreStudent, roundTo, gridItems } from '../src/lib/scoring.js';
import { integerWeights, migrateGrid, migrateExam } from '../src/lib/migrate.js';
import { decodeBytes, extractStudents, splitFullName } from '../src/lib/csv.js';

const isHalf = (v) => Math.abs(v * 2 - Math.round(v * 2)) < 1e-9;
const sum = (a) => a.reduce((x, y) => x + y, 0);

function skills(categories, { target = 20, rowImportance = false } = {}) {
  const g = newGrid({ name: 't', type: 'competences', presetId: 'empty', categoryNames: categories.map((c) => c.name || 'x') });
  g.target = target;
  g.rowImportance = rowImportance;
  g.categories = categories.map((c, i) => ({
    ...newCategory(c.name || ''),
    id: `c${i}`,
    importance: c.imp || 0,
    rows: (c.rows || [0]).map((imp, j) => ({ ...newRow('A2'), id: `c${i}r${j}`, importance: imp })),
  }));
  return g;
}

test('parts: normal is 4, each +1 adds a quarter', () => {
  assert.deepEqual(splitHalf(20, [4, 4, 4, 4]), [5, 5, 5, 5]);
  assert.deepEqual(splitHalf(20, [5, 4, 4, 4]), [6, 5, 4.5, 4.5]);
  assert.deepEqual(splitHalf(20, [6, 4, 4, 4]), [6.5, 4.5, 4.5, 4.5]);
  assert.deepEqual(splitHalf(20, [8, 4, 4, 4]), [8, 4, 4, 4]);
  assert.deepEqual(splitHalf(20, [4, 4, 4]), [7, 6.5, 6.5]);
  assert.deepEqual(splitHalf(20, [6, 4, 4, 3, 3]), [6, 4, 4, 3, 3]);
});

test('split always lands exactly on the target, in half points', () => {
  for (const target of [10, 15, 17.5, 20, 23, 40]) {
    for (const parts of [[4], [4, 4, 4], [5, 4, 4, 4, 3, 7], [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], [12, 1]]) {
      const r = splitHalf(target, parts);
      assert.equal(sum(r), target);
      r.forEach((v) => assert.ok(isHalf(v)));
    }
  }
});

test('color points are fifths of the row, rounded to the half point', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((c) => colorPoints(5, String(c))), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((c) => colorPoints(6, String(c))), [0, 1, 2.5, 3.5, 5, 6]);
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((c) => colorPoints(2, String(c))), [0, 0.5, 1, 1, 1.5, 2]);
  assert.equal(colorPoints(5, 'A'), null);
});

test('level points: lowest is 1 step, highest is the whole criterion', () => {
  assert.deepEqual([1, 2, 3, 4].map((k) => levelPoints(4, k, 4)), [1, 2, 3, 4]);
  assert.deepEqual([1, 2, 3, 4].map((k) => levelPoints(6, k, 4)), [1.5, 3, 4.5, 6]);
  assert.deepEqual([1, 2, 3, 4].map((k) => levelPoints(3, k, 4)), [1, 1.5, 2.5, 3]);
});

test('categories: Grammaire +1 with 3 rows, Lexique and Prononciation with 2', () => {
  const g = skills([{ name: 'Grammaire', imp: 1, rows: [0, 0, 0] }, { name: 'Lexique', rows: [0, 0] }, { name: 'Prononciation', rows: [0, 0] }]);
  const info = scaleInfo(g);
  assert.deepEqual(g.categories.map((c) => info.catMax[c.id]), [8, 6, 6]);
  assert.deepEqual(g.categories.flatMap((c) => c.rows.map((r) => info.rowMax[r.id])), [3, 2.5, 2.5, 3, 3, 3, 3]);
  assert.equal(info.total, 20);
  const top = Object.fromEntries(gridItems(g).map((it) => [it.id, '6']));
  assert.equal(scoreStudent(g, { marks: top }).score, 20);
});

test('grid without categories: rows share the mark equally', () => {
  const g = newGrid({ name: 't', type: 'competences', presetId: '3e' });
  assert.equal(g.useCategories, false);
  assert.equal(g.categories.length, 1);
  const info = scaleInfo(g);
  assert.deepEqual(g.categories[0].rows.map((r) => info.rowMax[r.id]), [5, 5, 5, 5]);
  const ids = gridItems(g).map((it) => it.id);
  const r = scoreStudent(g, { marks: { [ids[0]]: '6', [ids[1]]: '5', [ids[2]]: '3', [ids[3]]: '1' } });
  assert.equal(r.score, 11);
  assert.equal(r.status, 'complete');
});

test('row importance is only used when the advanced option is on', () => {
  const off = skills([{ name: 'A', rows: [2, 0, 0, 0] }]);
  const on = skills([{ name: 'A', rows: [2, 0, 0, 0] }], { rowImportance: true });
  assert.deepEqual(off.categories[0].rows.map((r) => scaleInfo(off).rowMax[r.id]), [5, 5, 5, 5]);
  assert.deepEqual(on.categories[0].rows.map((r) => scaleInfo(on).rowMax[r.id]), [6.5, 4.5, 4.5, 4.5]);
});

test('empty categories get nothing and are flagged, the total stays on target', () => {
  const g = skills([{ name: 'A', rows: [0, 0] }, { name: 'B', rows: [] }]);
  const info = scaleInfo(g);
  assert.equal(info.total, 20);
  assert.deepEqual(info.warnings.map((w) => w.type), ['emptyCategory']);
});

test('rows under 2.5 points are flagged', () => {
  const g = skills([{ name: 'A', rows: Array(10).fill(0) }]);
  const info = scaleInfo(g);
  assert.equal(info.warnings[0].type, 'merged');
  assert.equal(info.warnings[0].ids.length, 10);
  assert.equal(scaleInfo(skills([{ name: 'A', rows: Array(8).fill(0) }])).warnings.length, 0);
});

test('every mark of every grid is a whole or half point', () => {
  for (const target of [10, 15, 20, 25]) {
    const g = skills([{ name: 'A', imp: 2, rows: [0, 1, 0] }, { name: 'B', imp: -1, rows: [0, 0] }, { name: 'C', rows: [3] }], { target, rowImportance: true });
    const items = gridItems(g);
    for (let code = 1; code <= 6; code++) {
      const marks = Object.fromEntries(items.map((it) => [it.id, String(code)]));
      const r = scoreStudent(g, { marks });
      assert.ok(isHalf(r.score));
      if (code === 6) assert.equal(r.score, target);
    }
  }
});

test('special marks', () => {
  const g = newGrid({ name: 't', type: 'competences', presetId: '3e' });
  const ids = gridItems(g).map((it) => it.id);
  // Dispensé: 5 + 4 + 2 out of 15 -> 14.67 -> 14.5
  let r = scoreStudent(g, { marks: { [ids[0]]: '6', [ids[1]]: '5', [ids[2]]: '3', [ids[3]]: 'D' } });
  assert.equal(r.score, 14.5);
  r = scoreStudent(g, { marks: Object.fromEntries(ids.map((i) => [i, 'R'])) });
  assert.equal(r.score, 0);
  r = scoreStudent(g, { marks: Object.fromEntries(ids.map((i) => [i, 'A'])) });
  assert.equal(r.status, 'absent');
  assert.equal(r.score, null);
  assert.equal(scoreStudent(g, { marks: { [ids[0]]: '6' } }).status, 'partial');
  assert.equal(scoreStudent(g, { marks: {} }).status, 'empty');
});

test('level grid: Banksy with importance, manual cells only in advanced mode', () => {
  const g = newGrid({ name: 'Banksy', type: 'paliers', presetId: '3e' });
  g.criteria = [newCriterion('Réalisation', 2), newCriterion('Cohérence'), newCriterion('Grammaire'), newCriterion('Lexique', -1), newCriterion('Prononciation', -1)];
  const info = scaleInfo(g);
  assert.deepEqual(g.criteria.map((c) => info.critMax[c.id]), [6, 4, 4, 3, 3]);
  const [b1, a2p, a2, a1p] = g.levels.map((l) => l.id);
  const [real, coh] = g.criteria.map((c) => c.id);
  assert.deepEqual([b1, a2p, a2, a1p].map((l) => cellPoints(g, l, coh)), [4, 3, 2, 1]);
  assert.deepEqual([b1, a2p, a2, a1p].map((l) => cellPoints(g, l, real)), [6, 4.5, 3, 1.5]);
  g.cellOverride = true;
  setCellPoints(g, a2p, real, 5.2);
  assert.equal(cellPoints(g, a2p, real), 5);
  setCellPoints(g, b1, real, 3);
  assert.equal(cellPoints(g, b1, real), 6);
  g.cellOverride = false;
  assert.equal(cellPoints(g, a2p, real), 4.5);
  g.cellOverride = true;
  resetCellPoints(g, a2p, real);
  assert.equal(cellPoints(g, a2p, real), 4.5);
  const all = Object.fromEntries(g.criteria.map((c) => [c.id, b1]));
  assert.equal(scoreStudent(g, { marks: all }).score, 20);
  assert.equal(scoreStudent(g, { marks: { ...all, [real]: a2p, [coh]: a2 } }).score, 16.5);
});

// ---- Migration ------------------------------------------------------------------------

function v2Skills() {
  return {
    id: 'g',
    type: 'competences',
    target: 20,
    convert: false,
    categoryComments: true,
    rows: [
      { id: 'r1', level: 'A1', categories: [{ id: 'a', name: 'Prononciation', descriptor: 'p1', weight: 1 }, { id: 'b', name: 'Lexique', descriptor: 'l1', weight: 1 }] },
      { id: 'r2', level: 'A2', categories: [{ id: 'c', name: 'Grammaire', descriptor: 'g2', weight: 2 }, { id: 'd', name: 'lexique ', descriptor: 'l2', weight: 1 }] },
      { id: 'r3', level: 'A2+', categories: [{ id: 'e', name: 'Grammaire', descriptor: 'g3', weight: 2 }, { id: 'f', name: 'Prononciation', descriptor: 'p3', weight: 1 }] },
    ],
    levels: [],
    criteria: [],
    cells: {},
  };
}

test('0.2 template: items sharing a name become one category', () => {
  const g = migrateGrid(v2Skills());
  assert.equal(g.model, 3);
  assert.equal(g.useCategories, true);
  assert.equal(g.legacy, undefined);
  assert.deepEqual(g.categories.map((c) => c.name), ['Prononciation', 'Lexique', 'Grammaire']);
  assert.deepEqual(g.categories.map((c) => c.rows.map((r) => r.level)), [['A1', 'A2+'], ['A1', 'A2'], ['A2', 'A2+']]);
  assert.deepEqual(g.categories.map((c) => c.importance), [0, 0, 4]);
  assert.equal(scaleInfo(g).total, 20);
  assert.equal(g.rows, undefined);
});

test('0.2 graded assessment keeps its exact marks', () => {
  const e = { grid: v2Skills(), results: {} };
  const codes = ['6', '5', '4', '3', '2', '1', 'R', 'D'];
  const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
  for (let s = 0; s < 8; s++) {
    e.results[`s${s}`] = { marks: Object.fromEntries(ids.map((id, i) => [id, codes[(s + i) % codes.length]])), comments: { b: 'revoir', d: 'mots' }, comment: '' };
  }
  // Marks computed by version 0.2 for these students.
  const expected = [9.5, 6, 4, 5.5, 8.5, 10.5, 12.5, 12];
  migrateExam(e);
  assert.equal(e.grid.legacy, true);
  Object.values(e.results).forEach((r, i) => assert.equal(scoreStudent(e.grid, r).score, expected[i], `student ${i}`));
  const lex = e.grid.categories.find((c) => c.name === 'Lexique');
  assert.equal(e.results.s0.comments[lex.id], 'revoir\nmots');
});

test('0.1 points convert to weights with the same proportions', () => {
  assert.deepEqual(integerWeights([5, 5, 5, 5]), [1, 1, 1, 1]);
  assert.deepEqual(integerWeights([8, 4, 4, 4]), [2, 1, 1, 1]);
});

test('0.1 level grid keeps its manual cells', () => {
  const pal = { id: 'p', type: 'paliers', maxScore: 20, levels: [{ id: 'l1', level: 'B1' }, { id: 'l2', level: 'A2' }], criteria: [{ id: 'x', points: 12 }, { id: 'y', points: 8 }], cells: { l1: { x: { ratio: 0.5, pinned: true } }, l2: { x: { ratio: 0.4, pinned: true } } } };
  migrateGrid(pal);
  assert.deepEqual(pal.criteria.map((c) => c.importance), [2, 0]);
  assert.equal(pal.cellOverride, true);
  assert.equal(pal.cells.l1.x.pinned, false);
  assert.equal(scaleInfo(pal).critMax.x, 12);
  assert.equal(cellPoints(pal, 'l2', 'x'), 5);
});

test('exams copy the grid', () => {
  const g = newGrid({ name: 't', type: 'competences', presetId: '5e', categoryNames: ['Grammaire', 'Lexique'] });
  const e = newExam({ name: 'e', classId: 'c', grid: g });
  e.grid.categories[0].name = 'changed';
  assert.equal(g.categories[0].name, 'Grammaire');
  assert.equal(g.categories[0].rows.length, 4);
  assert.deepEqual(emptyResult(), { marks: {}, comments: {}, comment: '', partial: {}, adjustments: [] });
});

test('rounding helpers', () => {
  assert.equal(roundTo(14.24, 0.5), 14);
  assert.equal(roundTo(14.25, 0.5), 14.5);
  assert.equal(snapHalf(2.3), 2.5);
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

// ---- Group work -------------------------------------------------------------------------

import { roleMap, examScore, examAverage, fillRandomly, assignStudent, newGroup, groupSlots, groupSize, placeStudent, moveStudent, addToGroup, moveGroup, groupNumbers, clearSlot } from '../src/lib/groups.js';

function interviewExam() {
  const g = newGrid({ name: 'Interview', type: 'competences', presetId: 'empty', roleNames: ['Intervieweur', 'Monstre'], roleGrids: true });
  g.categories[0].rows = ['A1', 'A1', 'A2', 'A2', 'B1'].map((l) => newRow(l));
  g.categories[1].rows = ['A1', 'A1', 'A2', 'A2'].map((l) => newRow(l));
  const e = newExam({ name: 'e', classId: 'c', grid: g });
  return e;
}

test('group work: each role is graded on the whole target', () => {
  const e = interviewExam();
  const g = e.grid;
  assert.equal(g.groupWork, true);
  const info = scaleInfo(g);
  assert.deepEqual(g.categories.map((c) => info.catMax[c.id]), [20, 20]);
  assert.deepEqual(g.categories[0].rows.map((r) => info.rowMax[r.id]), [4, 4, 4, 4, 4]);
  assert.deepEqual(g.categories[1].rows.map((r) => info.rowMax[r.id]), [5, 5, 5, 5]);
  assert.equal(info.total, 20);
  const [inter, monstre] = g.categories;
  const grp = newGroup(g);
  e.groups.push(grp);
  assignStudent(e, grp, inter.id, 0, 'giovani');
  assignStudent(e, grp, monstre.id, 0, 'illyes');
  e.results.giovani = { marks: Object.fromEntries(inter.rows.map((r) => [r.id, '6'])), comments: {}, comment: '' };
  e.results.illyes = { marks: Object.fromEntries(monstre.rows.map((r, i) => [r.id, i < 2 ? '6' : '1'])), comments: {}, comment: '' };
  assert.equal(examScore(e, 'giovani').score, 20);
  assert.equal(examScore(e, 'illyes').score, 10);
  assert.equal(examScore(e, 'illyes').status, 'complete');
  assert.equal(examScore(e, 'nobody').status, 'noRole');
  assert.equal(examAverage(e, ['giovani', 'illyes', 'nobody']), 15);
  // Moving a student removes them from their previous slot.
  assignStudent(e, grp, inter.id, 0, 'illyes');
  assert.deepEqual(roleMap(e), { illyes: { roleId: inter.id, groupId: grp.id, groupIndex: 0 } });
});

test('group work: random groups fill every slot, then new groups', () => {
  const e = interviewExam();
  e.grid.categories[1].count = 2;
  assert.equal(groupSize(e.grid), 3);
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  let seed = 1;
  fillRandomly(e, ids, () => ((seed = (seed * 16807) % 2147483647) / 2147483647));
  assert.equal(e.groups.length, 3);
  const map = roleMap(e);
  assert.deepEqual(Object.keys(map).sort(), ids);
  assert.equal(groupSlots(e.grid, e.groups[2]).filter((s) => s.studentId).length, 1);
  // A second call places nobody twice.
  fillRandomly(e, ids);
  assert.equal(e.groups.length, 3);
});

test('group work without roles: same sheet for every member, graded separately', () => {
  const g = newGrid({ name: 'Dialogue', type: 'competences', presetId: '3e', groupWork: true, groupSize: 2 });
  assert.equal(g.groupWork, true);
  assert.equal(g.useRoles, false);
  assert.equal(groupSize(g), 2);
  const e = newExam({ name: 'e', classId: 'c', grid: g });
  fillRandomly(e, ['a', 'b', 'c']);
  assert.equal(e.groups.length, 2);
  const rows = e.grid.categories[0].rows;
  e.results.a = { marks: Object.fromEntries(rows.map((r) => [r.id, '6'])), comments: {}, comment: '' };
  e.results.b = { marks: Object.fromEntries(rows.map((r) => [r.id, '4'])), comments: {}, comment: '' };
  assert.equal(examScore(e, 'a').score, 20);
  assert.equal(examScore(e, 'b').score, 12);
  assert.equal(examScore(e, 'c').status, 'empty');
  assert.equal(examScore(e, 'z').status, 'noRole');
  assert.equal(scaleInfo(e.grid).total, 20);
});

test('0.4 to 0.7 group grids keep one grid per role', () => {
  const g = newGrid({ name: 'x', type: 'competences', presetId: 'empty', roleNames: ['A', 'B'], roleGrids: true });
  delete g.useRoles;
  delete g.roleGrids;
  delete g.roles;
  migrateGrid(g);
  assert.equal(g.useRoles, true);
  assert.equal(g.roleGrids, true);
  assert.deepEqual(g.roles, []);
  assert.deepEqual(rolesOf(g).map((r) => r.name), ['A', 'B']);
  const plain = newGrid({ name: 'y', type: 'competences', presetId: '5e' });
  delete plain.roleGrids;
  migrateGrid(plain);
  assert.equal(plain.roleGrids, false);
});

test('a student can be in several groups with one sheet, and one role', () => {
  const e = interviewExam();
  const [inter, monstre] = e.grid.categories;
  const g1 = newGroup(e.grid);
  const g2 = newGroup(e.grid);
  e.groups.push(g1, g2);
  assert.deepEqual(placeStudent(e, g1, inter.id, 0, 'ana'), { ok: true });
  assert.deepEqual(placeStudent(e, g2, inter.id, 0, 'ana'), { ok: true });
  assert.deepEqual(groupNumbers(e), { ana: [1, 2] });
  // Same role everywhere.
  assert.deepEqual(placeStudent(e, g2, monstre.id, 0, 'ana'), { ok: false, reason: 'role', roleId: inter.id });
  // Marks are shared: one result per student.
  e.results.ana = { marks: Object.fromEntries(inter.rows.map((r) => [r.id, '6'])), comments: {}, comment: '' };
  assert.equal(examScore(e, 'ana').score, 20);
  // Only once per group: placing again in the same group moves them within it.
  e.grid.categories[0].count = 2;
  placeStudent(e, g1, inter.id, 1, 'ana');
  assert.deepEqual(g1.slots[inter.id], [null, 'ana']);
});

test('moving between slots swaps students when roles allow', () => {
  const e = newExam({ name: 'e', classId: 'c', grid: newGrid({ name: 'd', type: 'competences', presetId: '3e', groupWork: true, groupSize: 2 }) });
  const g1 = newGroup(e.grid);
  const g2 = newGroup(e.grid);
  e.groups.push(g1, g2);
  placeStudent(e, g1, 'member', 0, 'a');
  placeStudent(e, g2, 'member', 0, 'b');
  assert.deepEqual(moveStudent(e, { groupId: g1.id, roleId: 'member', index: 0 }, { groupId: g2.id, roleId: 'member', index: 0 }), { ok: true });
  assert.deepEqual([g1.slots.member, g2.slots.member], [['b', null], ['a', null]]);
  assert.deepEqual(addToGroup(e, g1, 'c'), { ok: true });
  assert.deepEqual(g1.slots.member, ['b', 'c']);
  assert.deepEqual(addToGroup(e, g1, 'd'), { ok: false, reason: 'full', roleId: null });
  clearSlot(e, { groupId: g1.id, roleId: 'member', index: 1 });
  assert.deepEqual(g1.slots.member, ['b', null]);
  moveGroup(e, 1, 0);
  assert.equal(e.groups[0].id, g2.id);
  // Swapping across roles is refused and nothing changes.
  const r = interviewExam();
  const [inter, monstre] = r.grid.categories;
  const h = newGroup(r.grid);
  r.groups.push(h);
  placeStudent(r, h, inter.id, 0, 'x');
  // x is also an interviewer in another group, so x cannot become a monster.
  const h2 = newGroup(r.grid);
  r.groups.push(h2);
  placeStudent(r, h2, inter.id, 0, 'x');
  const k = newGroup(r.grid);
  r.groups.push(k);
  placeStudent(r, k, monstre.id, 0, 'y');
  const res = moveStudent(r, { groupId: k.id, roleId: monstre.id, index: 0 }, { groupId: h.id, roleId: inter.id, index: 0 });
  assert.equal(res.ok, false);
  assert.deepEqual([h.slots[inter.id][0], k.slots[monstre.id][0]], ['x', 'y']);
});

import { studentAcquisition, acquisitionOf, meanAcquisition } from '../src/lib/scoring.js';

test('acquisition average: weighted by points, per category, R counts as lowest', () => {
  const g = skills([{ name: 'Grammaire', imp: 4, rows: [0, 0] }, { name: 'Lexique', rows: [0, 0] }]);
  const marks = { c0r0: '6', c0r1: '6', c1r0: '2', c1r1: 'R' };
  const a = studentAcquisition(g, { marks });
  assert.equal(a.byCategory.c0.code, '6');
  assert.equal(a.byCategory.c0.value, 6);
  // Lexique: steps 1 and 0, weighted by the points of each row (6.5 pts split 3.5 / 3).
  const li = scaleInfo(g);
  assert.ok(Math.abs(a.byCategory.c1.value - (1 + li.rowMax.c1r0 / (li.rowMax.c1r0 + li.rowMax.c1r1))) < 1e-9);
  assert.equal(a.byCategory.c1.code, '2');
  // Whole sheet: Grammaire weighs twice as much.
  const info = scaleInfo(g);
  const w = (id) => info.rowMax[id];
  const expected = (5 * w('c0r0') + 5 * w('c0r1') + 1 * w('c1r0')) / (w('c0r0') + w('c0r1') + w('c1r0') + w('c1r1')) + 1;
  assert.ok(Math.abs(a.overall.value - expected) < 1e-9);
  assert.equal(a.overall.code, String(Math.floor(expected - 1 + 0.5) + 1));
  // Absent and exempt rows are left out, nothing graded gives null.
  assert.equal(studentAcquisition(g, { marks: { c0r0: 'A', c0r1: 'D' } }).overall, null);
  assert.equal(acquisitionOf([], {}), null);
  assert.equal(meanAcquisition([{ value: 6 }, { value: 4 }, null]).code, '5');
  assert.equal(studentAcquisition(newGrid({ name: 'p', type: 'paliers', presetId: '3e' }), { marks: {} }), null);
});

import { summaryColumns, rowMark, renderSummary } from '../src/lib/printSummary.js';

test('summary: ticked skills get their own column, per role, with the class average', () => {
  const g = skills([{ name: 'Grammaire', rows: [0, 0] }, { name: 'Lexique', rows: [0] }]);
  assert.deepEqual(summaryColumns(g), []);
  g.categories[0].rows[1].inSummary = true;
  g.categories[1].rows[0].inSummary = true;
  const info = scaleInfo(g);
  const rows = summaryColumns(g, info);
  assert.deepEqual(rows.map((it) => it.id), ['c0r1', 'c1r0']);
  assert.deepEqual(rowMark(g, info, rows[0], { c0r1: '6' }), { kind: 'level', mark: '6', earned: info.rowMax.c0r1, acq: acquisitionOf([rows[0]], { c0r1: '6' }) });
  assert.equal(rowMark(g, info, rows[0], { c0r1: 'R' }).earned, 0);
  assert.equal(rowMark(g, info, rows[0], { c0r1: 'A' }).earned, null);
  assert.equal(rowMark(g, info, rows[0], {}).kind, 'none');
  const e = newExam({ name: 'e', classId: 'c', grid: g });
  e.results = { a: { marks: { c0r0: '6', c0r1: '6', c1r0: '4' } }, b: { marks: { c0r0: '2', c0r1: '2', c1r0: 'A' } } };
  const html = renderSummary({ exam: e, cls: { name: '5e A' }, students: [{ id: 'a', lastName: 'A', firstName: 'a' }, { id: 'b', lastName: 'B', firstName: 'b' }], lang: 'fr' });
  assert.equal((html.match(/<th class="rc/g) || []).length, 2);
  // Two students and the class average row, each with two skill cells.
  assert.equal((html.match(/<td class="[^"]*\brc\b/g) || []).length, 6);
  // Role grids: a skill of another role shows a dash.
  const r = interviewExam();
  r.grid.categories[0].rows[0].inSummary = true;
  const ri = scaleInfo(r.grid);
  assert.equal(rowMark(r.grid, ri, summaryColumns(r.grid, ri)[0], {}, r.grid.categories[1].id).kind, 'other');
});

import { splitRoleGrids, mergeRoleGrids, roleGridsIdentical } from '../src/lib/groups.js';
import { hasRoles, usesRoles, rowsOf } from '../src/lib/bareme.js';
import { rolesOf } from '../src/lib/groups.js';

test('roles: same grid for every role by default, the role is only a name', () => {
  const g = newGrid({ name: 'r', type: 'competences', presetId: '3e', roleNames: ['Pour', 'Contre'], categoryNames: ['Langue', 'Interaction'] });
  assert.equal(hasRoles(g), true);
  assert.equal(usesRoles(g), false);
  assert.deepEqual(rolesOf(g).map((r) => r.name), ['Pour', 'Contre']);
  assert.deepEqual(g.categories.map((c) => c.name), ['Langue', 'Interaction']);
  assert.equal(scaleInfo(g).total, 20);
  const e = newExam({ name: 'e', classId: 'c', grid: g });
  e.groups = [{ id: 'g1', slots: { [g.roles[0].id]: ['a'], [g.roles[1].id]: ['b'] } }];
  const all = rowsOf(g);
  e.results.a = { marks: Object.fromEntries(all.map((r) => [r.id, '6'])), comments: {}, comment: '' };
  e.results.b = { marks: Object.fromEntries(all.map((r) => [r.id, '6'])), comments: {}, comment: '' };
  assert.equal(examScore(e, 'a').score, 20);
  assert.equal(examScore(e, 'b').score, 20);
  // No role conflict: the sheet is the same whatever the role.
  e.groups.push({ id: 'g2', slots: { [g.roles[0].id]: [null], [g.roles[1].id]: [null] } });
  assert.equal(addToGroup(e, e.groups[1], 'a').ok, true);
});

test('roles: switching between one grid per role and the same grid keeps the marks', () => {
  const g = newGrid({ name: 'r', type: 'competences', presetId: 'empty', roleNames: ['R1', 'R2'], roleGrids: true });
  for (const c of g.categories) c.rows = [newRow('A2', 'Se présenter'), newRow('B1', "Qualité de l'oral")];
  g.categories[1].rows[1].inSummary = true;
  assert.equal(roleGridsIdentical(g), true);
  const e = newExam({ name: 'e', classId: 'c', grid: g });
  const [r1, r2] = e.grid.categories;
  e.groups = [{ id: 'g1', slots: { [r1.id]: ['a'], [r2.id]: ['b'] } }];
  e.results.a = { marks: { [r1.rows[0].id]: '6', [r1.rows[1].id]: '3' }, comments: { [r1.rows[1].id]: 'ok' }, comment: '' };
  e.results.b = { marks: { [r2.rows[0].id]: '4', [r2.rows[1].id]: '5' }, comments: {}, comment: '' };
  const before = ['a', 'b'].map((id) => examScore(e, id).score);
  // Two columns become one in the summary even before merging.
  assert.equal(summaryColumns(e.grid).length, 1);
  mergeRoleGrids(e.grid, e);
  assert.equal(usesRoles(e.grid), false);
  assert.deepEqual(e.grid.roles.map((r) => r.name), ['R1', 'R2']);
  assert.equal(rowsOf(e.grid).length, 2);
  assert.equal(rowsOf(e.grid)[1].inSummary, true);
  assert.deepEqual(['a', 'b'].map((id) => examScore(e, id).score), before);
  assert.equal(e.results.a.comments[rowsOf(e.grid)[1].id], 'ok');
  // And back: each role gets a copy of the rows, marks follow the role.
  splitRoleGrids(e.grid, e);
  assert.equal(usesRoles(e.grid), true);
  assert.deepEqual(e.grid.categories.map((c) => c.name), ['R1', 'R2']);
  assert.deepEqual(['a', 'b'].map((id) => examScore(e, id).score), before);
  assert.equal(Object.keys(e.results.b.marks).every((id) => e.grid.categories[1].rows.some((r) => r.id === id)), true);
});

test('roles: different role grids keep only the rows that match when merged', () => {
  const g = newGrid({ name: 'r', type: 'competences', presetId: 'empty', roleNames: ['R1', 'R2'], roleGrids: true });
  g.categories[0].rows = [newRow('A1', 'x'), newRow('A2', 'y')];
  g.categories[1].rows = [newRow('A1', 'x'), newRow('A2', 'z')];
  assert.equal(roleGridsIdentical(g), false);
  const e = newExam({ name: 'e', classId: 'c', grid: g });
  const [r1, r2] = e.grid.categories;
  e.groups = [{ id: 'g1', slots: { [r1.id]: ['a'], [r2.id]: ['b'] } }];
  e.results.b = { marks: { [r2.rows[0].id]: '6', [r2.rows[1].id]: '6' }, comments: {}, comment: '' };
  mergeRoleGrids(e.grid, e);
  assert.deepEqual(Object.keys(e.results.b.marks), [rowsOf(e.grid)[0].id]);
});

import { partialPoints } from '../src/lib/bareme.js';
import { adjustmentTotal } from '../src/lib/scoring.js';

test('level grid: a level partly reached gives half of the step from the level below', () => {
  const g = newGrid({ name: 'Banksy', type: 'paliers', presetId: '3e' });
  g.criteria = [newCriterion('Réalisation', 2), newCriterion('Cohérence'), newCriterion('Grammaire'), newCriterion('Lexique', -1), newCriterion('Prononciation', -1)];
  const [b1, a2p, a2, a1p] = g.levels.map((l) => l.id);
  const [real, coh] = g.criteria.map((c) => c.id);
  // Cohérence: 4, 3, 2, 1 points.
  assert.deepEqual([b1, a2p, a2, a1p].map((l) => partialPoints(g, l, coh)), [3.5, 2.5, 1.5, 0.5]);
  // Réalisation: 6, 4.5, 3, 1.5 points. Steps of 1.5 are rounded down to the half point.
  assert.deepEqual([b1, a2p, a2, a1p].map((l) => partialPoints(g, l, real)), [5, 3.5, 2, 0.5]);
  const all = Object.fromEntries(g.criteria.map((c) => [c.id, b1]));
  assert.equal(scoreStudent(g, { marks: all }).score, 20);
  assert.equal(scoreStudent(g, { marks: all, partial: { [coh]: true } }).score, 19.5);
  // The flag is ignored on a special mark.
  assert.equal(scoreStudent(g, { marks: { ...all, [coh]: 'R' }, partial: { [coh]: true } }).score, 16);
});

test('bonus and penalties: added to the mark, which stays between 0 and the target', () => {
  const g = skills([{ name: 'A', rows: [0, 0] }]);
  const all = { c0r0: '4', c0r1: '4' };
  const base = scoreStudent(g, { marks: all }).score;
  assert.equal(adjustmentTotal({ adjustments: [{ points: 1 }, { points: -0.5 }, { points: 'x' }] }), 0.5);
  const s = scoreStudent(g, { marks: all, adjustments: [{ reason: 'Participation', points: 1.5 }, { reason: 'Retard', points: -0.5 }] });
  assert.equal(s.base, base);
  assert.equal(s.adjust, 1);
  assert.equal(s.score, base + 1);
  assert.equal(scoreStudent(g, { marks: { c0r0: '6', c0r1: '6' }, adjustments: [{ points: 2 }] }).score, 20);
  assert.equal(scoreStudent(g, { marks: { c0r0: '1', c0r1: '1' }, adjustments: [{ points: -3 }] }).score, 0);
  // Nothing graded or absent: no mark, no bonus.
  assert.equal(scoreStudent(g, { marks: {}, adjustments: [{ points: 2 }] }).score, null);
  assert.equal(scoreStudent(g, { marks: { c0r0: 'A', c0r1: 'A' }, adjustments: [{ points: 2 }] }).score, null);
  // Summary: one column for bonus and penalties.
  const e = newExam({ name: 'e', classId: 'c', grid: g });
  e.results = { a: { marks: all, adjustments: [{ id: 'x', reason: 'Participation', points: 1 }] }, b: { marks: all } };
  const html = renderSummary({ exam: e, cls: { name: '5e A' }, students: [{ id: 'a', lastName: 'A', firstName: 'a' }, { id: 'b', lastName: 'B', firstName: 'b' }], lang: 'fr' });
  assert.match(html, /Bonus \/ malus/);
  assert.match(html, /<td class="num adj">\+1<\/td>/);
});

import { markLevel } from '../src/lib/scoring.js';

test('level grids: the colour follows the mark', () => {
  assert.deepEqual([0, 4, 8, 10, 12, 16, 20].map((v) => markLevel(v, 20)), ['1', '2', '3', '4', '4', '5', '6']);
  assert.equal(markLevel(null, 20), null);
});
