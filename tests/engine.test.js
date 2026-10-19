import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newGrid, newCategory, newCriterion, newLevel } from '../src/lib/model.js';
import { setRowPoints, setCategoryPoints, setMaxScore, setWeight, rebalance, setCriterionPoints, setCellPoints, cellPoints } from '../src/lib/weights.js';
import { scoreStudent, roundTo } from '../src/lib/scoring.js';
import { decodeBytes, extractStudents, splitFullName } from '../src/lib/csv.js';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('even split then edit one row redistributes the rest (user example)', () => {
  const g = newGrid({ name: 't', type: 'competences', presetId: '3e' });
  assert.equal(g.rows.length, 4);
  g.rows.forEach((r) => close(r.points, 5));
  setRowPoints(g, 0, 8);
  close(g.rows[0].points, 8);
  for (let i = 1; i < 4; i++) close(g.rows[i].points, 4);
  // Second edit keeps the first one pinned.
  setRowPoints(g, 1, 6);
  close(g.rows[0].points, 8);
  close(g.rows[1].points, 6);
  close(g.rows[2].points, 3);
  close(g.rows[3].points, 3);
  // Categories follow their row.
  close(g.rows[0].categories[0].points, 8);
});

test('edit is clamped to what remains', () => {
  const items = [{ points: 5, pinned: true }, { points: 5, pinned: false }, { points: 10, pinned: false }];
  setWeight(items, 1, 50, 20);
  close(items[0].points, 5);
  close(items[1].points, 15);
  close(items[2].points, 0);
});

test('rebalance after adding an item', () => {
  const items = [{ points: 8, pinned: true }, { points: 12, pinned: false }, { points: 0, pinned: false }];
  rebalance(items, 20);
  close(items[1].points, 6);
  close(items[2].points, 6);
});

test('categories inside a row and max score change', () => {
  const g = newGrid({ name: 't', type: 'competences', presetId: '5e' });
  const row = g.rows[0];
  row.categories.push(newCategory('Lexique'), newCategory('Grammaire'));
  rebalance(row.categories, row.points);
  row.categories.forEach((c) => close(c.points, 5 / 3));
  setCategoryPoints(row, 0, 3);
  close(row.categories[1].points, 1);
  setMaxScore(g, 10);
  close(g.rows[0].points, 2.5);
  close(row.categories[0].points, 1.5);
});

test('competences score with acquisition levels and special marks', () => {
  const g = newGrid({ name: 't', type: 'competences', presetId: '3e' });
  const ids = g.rows.map((r) => r.categories[0].id);
  // 6 -> 100%, 5 -> 80%, 3 -> 40%, 1 -> 0%  => 5 + 4 + 2 + 0 = 11
  let r = scoreStudent(g, { marks: { [ids[0]]: '6', [ids[1]]: '5', [ids[2]]: '3', [ids[3]]: '1' } });
  assert.equal(r.status, 'complete');
  assert.equal(r.score, 11);
  // Dispensé on one row: 5 + 4 + 2 out of 15 -> 14.67 -> rounded to 14.5
  r = scoreStudent(g, { marks: { [ids[0]]: '6', [ids[1]]: '5', [ids[2]]: '3', [ids[3]]: 'D' } });
  assert.equal(r.score, 14.5);
  // Non rendu counts as zero.
  r = scoreStudent(g, { marks: { [ids[0]]: 'R', [ids[1]]: 'R', [ids[2]]: 'R', [ids[3]]: 'R' } });
  assert.equal(r.score, 0);
  assert.equal(r.status, 'complete');
  r = scoreStudent(g, { marks: { [ids[0]]: 'A', [ids[1]]: 'A', [ids[2]]: 'A', [ids[3]]: 'A' } });
  assert.equal(r.status, 'absent');
  assert.equal(r.score, null);
  r = scoreStudent(g, { marks: { [ids[0]]: '6' } });
  assert.equal(r.status, 'partial');
  r = scoreStudent(g, { marks: {} });
  assert.equal(r.status, 'empty');
  // Custom percentages per grid.
  g.scale['5'] = 90;
  r = scoreStudent(g, { marks: { [ids[0]]: '5', [ids[1]]: '5', [ids[2]]: '5', [ids[3]]: '5' } });
  assert.equal(r.score, 18);
});

test('paliers grid reproduces the Banksy grid', () => {
  const g = newGrid({ name: 'Banksy', type: 'paliers', presetId: '3e' });
  assert.deepEqual(g.levels.map((l) => l.level), ['B1', 'A2+', 'A2', 'A1+']);
  g.criteria = [newCriterion('Réalisation'), newCriterion('Cohérence'), newCriterion('Grammaire'), newCriterion('Lexique'), newCriterion('Prononciation')];
  rebalance(g.criteria, 20);
  [6, 4, 4, 3].forEach((v, i) => setCriterionPoints(g, i, v));
  close(g.criteria[4].points, 3);
  const [b1, a2p, a2, a1p] = g.levels.map((l) => l.id);
  const [real, coh] = g.criteria.map((c) => c.id);
  // Cohérence: default steps 4, 3, 2, 1
  close(cellPoints(g, a2p, coh), 3);
  close(cellPoints(g, a1p, coh), 1);
  // Réalisation: 6, 5, 3, 1.5
  setCellPoints(g, a2p, real, 5);
  setCellPoints(g, a2, real, 3);
  setCellPoints(g, a1p, real, 1.5);
  const all = Object.fromEntries(g.criteria.map((c) => [c.id, b1]));
  assert.equal(scoreStudent(g, { marks: all }).score, 20);
  const mixed = { ...all, [real]: a2, [coh]: a2p };
  assert.equal(scoreStudent(g, { marks: mixed }).score, 16);
});

test('rounding', () => {
  assert.equal(roundTo(14.24, 0.5), 14);
  assert.equal(roundTo(14.25, 0.5), 14.5);
  assert.equal(roundTo(14.26, 0.1), 14.3);
  assert.equal(roundTo(14.333, 0.01), 14.33);
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
  const bytes = new Uint8Array([0x45, 0x6c, 0xe8, 0x76, 0x65, 0x73]); // "Elèves" in cp1252
  assert.equal(decodeBytes(bytes), 'Elèves');
});
