// Development self test: seeds demo data, takes screenshots and exports PDFs.
// Runs only when the app is started with AUTOGRID_SELFTEST=<folder>.
import { nextTick } from 'vue';
import { store, navigate } from './store.js';
import { newGrid, newRow, newCriterion, newClass, newStudent, newExam, emptyResult } from './model.js';
import { setCellPoints } from './bareme.js';
import { exportExamPdf, exportBlankGrid } from './exporter.js';
import { scoreStudent } from './scoring.js';

const FAKE = [
  ['ARNAUD', 'Lina'], ['BENALI', 'Yanis'], ['COSTA', 'Inès'], ['DIALLO', 'Moussa'], ['DUBOIS LAMBERT', 'Chloé'],
  ['FERREIRA', 'Hugo'], ['GARCIA', 'Nora'], ['HAMIDI', 'Rayan'], ['KONATÉ', 'Awa'], ['LEROY', 'Tom'],
  ['MARTIN', 'Jade'], ['NGUYEN', 'Léo'], ['PETIT', 'Sarah'], ['ROUSSEL', 'Adam'], ['TRAORÉ', 'Fatou'],
  ['VIDAL', 'Emma'],
];

function seed() {
  const comp = newGrid({
    name: 'Expression orale en interaction 5e',
    type: 'competences',
    presetId: '5e',
    categoryNames: ['Grammaire', 'Lexique', 'Prononciation'],
  });
  const content = [
    [['A1', 'Utilise quelques structures mémorisées (I like, I have got).'], ['A2', 'Utilise le présent simple et le présent en be+ing.'], ['A2+', 'Relie ses idées avec and, but, because.']],
    [['A1', 'Utilise des mots isolés vus en classe.'], ['A2', 'Vocabulaire de la séquence : routine, loisirs.']],
    [['A1', 'Prononce des mots familiers de façon compréhensible.'], ['A2', 'Intonation correcte dans les questions.']],
  ];
  comp.categories.forEach((cat, i) => {
    cat.rows = content[i].map(([lvl, d]) => newRow(lvl, d));
  });
  comp.categories[0].importance = 1;
  comp.categoryComments = true;

  const plain = newGrid({ name: 'Compréhension de l\'écrit 3e', type: 'competences', presetId: '3e' });
  ['Repère des informations simples.', 'Comprend l\'essentiel d\'un texte court.', 'Comprend les points principaux.', 'Comprend le point de vue de l\'auteur.'].forEach((d, i) => {
    plain.categories[0].rows[i].descriptor = d;
  });

  const pal = newGrid({ name: 'Débat : street art au collège', type: 'paliers', presetId: '3e' });
  pal.criteria = [
    newCriterion('Réalisation de la tâche', 2),
    newCriterion('Cohérence'),
    Object.assign(newCriterion('Grammaire'), { group: 'Langue' }),
    Object.assign(newCriterion('Lexique', -1), { group: 'Langue' }),
    Object.assign(newCriterion('Prononciation', -1), { group: 'Langue' }),
  ];
  pal.cellOverride = true;
  const [b1, a2p, a2, a1p] = pal.levels.map((l) => l.id);
  const texts = {
    0: ['Défend son point de vue avec des arguments préparés et réagit à ceux des autres.', 'Utilise ses arguments, parfois sans lien avec ce qui précède.', 'Reprend des arguments de la leçon et propose des réponses courtes.', 'Identifie quelques mots du sujet, répond par des mots isolés.'],
    1: ['Respecte les tours de parole et adapte son registre.', 'Maîtrise les règles du débat, coupe parfois la parole.', 'Participe quand on le sollicite.', 'Participe très peu.'],
    2: ['Bon contrôle grammatical, erreurs rares.', 'Ensemble clair malgré des erreurs.', 'Structures simples correctes.', 'Structures mémorisées, erreurs fréquentes.'],
    3: ['Varié et pertinent.', 'Précis sur les sujets étudiés.', 'Suffisant, lié au chapitre.', 'Pauvre.'],
    4: ['Clairement intelligible.', 'Globalement correcte.', 'Claire mais accent marqué.', 'Difficile à comprendre.'],
  };
  pal.criteria.forEach((c, ci) => {
    pal.levels.forEach((l, li) => {
      if (!pal.cells[l.id]) pal.cells[l.id] = {};
      pal.cells[l.id][c.id] = { descriptor: texts[ci][li], ratio: null, pinned: false };
    });
  });
  setCellPoints(pal, a2p, pal.criteria[0].id, 5);

  const c3 = newClass('3e B', FAKE.slice(0, 10).map(([l, f]) => newStudent(l, f)));
  const c5 = newClass('5e A', FAKE.slice(6).map(([l, f]) => newStudent(l, f)));

  const e5 = newExam({ name: 'My daily routine', date: '2026-10-12', classId: c5.id, grid: comp });
  const codes = ['6', '5', '4', '3', '2', '1', 'R', '5', '6', '4'];
  const items = e5.grid.categories.flatMap((c) => c.rows);
  c5.students.forEach((s, si) => {
    if (si === c5.students.length - 1) return; // one student left to grade
    const r = emptyResult();
    items.forEach((it, ii) => {
      r.marks[it.id] = codes[(si + ii) % codes.length];
    });
    if (si === 2) items.forEach((it) => (r.marks[it.id] = 'A'));
    if (si === 0) {
      r.comment = 'Très bonne participation, continue à enrichir ton vocabulaire.';
      r.comments[e5.grid.categories[1].id] = 'Revoir les mots de la routine.';
    }
    e5.results[s.id] = r;
  });

  const e3 = newExam({ name: 'Banksy debate', date: '2026-10-16', classId: c3.id, grid: pal });
  const lv = e3.grid.levels.map((l) => l.id);
  c3.students.forEach((s, si) => {
    if (si > 6) return;
    const r = emptyResult();
    e3.grid.criteria.forEach((c, ci) => {
      r.marks[c.id] = lv[(si + ci) % lv.length];
    });
    if (si === 3) r.marks[e3.grid.criteria[4].id] = 'D';
    e3.results[s.id] = r;
  });

  store.data.grids.push(comp, plain, pal);
  store.data.classes.push(c3, c5);
  store.data.exams.push(e5, e3);
  return { comp, plain, pal, c3, c5, e5, e3 };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(name) {
  await nextTick();
  await wait(500);
  await window.api.selftestScreenshot(name);
}

export async function runSelftest(info) {
  const dir = info.dir;
  const raw = seed();
  // Work through the reactive store so edits made by the test refresh the screen.
  const byId = (list, id) => list.find((x) => x.id === id);
  const d = {
    comp: byId(store.data.grids, raw.comp.id),
    plain: byId(store.data.grids, raw.plain.id),
    pal: byId(store.data.grids, raw.pal.id),
    c3: byId(store.data.classes, raw.c3.id),
    c5: byId(store.data.classes, raw.c5.id),
    e5: byId(store.data.exams, raw.e5.id),
    e3: byId(store.data.exams, raw.e3.id),
  };
  navigate('exams');
  await shot('01-exams');
  navigate('exam', d.e5.id, { tab: 'grading' });
  await shot('02-grading-competences');
  // Keyboard grading on the last (ungraded) student.
  const last = d.c5.students[d.c5.students.length - 1];
  store.route = { ...store.route, studentId: last.id };
  navigate('exams');
  await wait(100);
  navigate('exam', d.e5.id, { tab: 'grading', studentId: last.id });
  await wait(300);
  const press = (key) => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  for (const k of ['6', '5', '4', '3', 'r', 'ArrowUp', 'd', '2']) {
    press(k);
    await wait(60);
  }
  const before = JSON.parse(JSON.stringify(d.e5.results[last.id] || null));
  await shot('02b-keyboard');
  press('ArrowLeft');
  await wait(200);
  await window.api.selftestLog('keyboard', { marks: before, route: store.route.studentId === last.id ? 'same' : 'moved' });
  navigate('exam', d.e3.id, { tab: 'grading' });
  await shot('03-grading-paliers');
  navigate('grid', d.comp.id);
  await shot('04-grid-competences');
  document.querySelector('.cat-tab:nth-child(2)')?.click();
  await shot('04b-grid-second-tab');
  navigate('grid', d.plain.id);
  await shot('04c-grid-no-categories');
  d.plain.categories[0].rows.push(...['A2', 'B1', 'B1', 'A2+'].map((l) => newRow(l)));
  d.plain.target = 10;
  await shot('04d-grid-warnings');
  d.plain.categories[0].rows.splice(4);
  d.plain.target = 20;
  navigate('grid', d.pal.id);
  await shot('05-grid-paliers');
  document.querySelector('.main').scrollTop = 640;
  await shot('05b-grid-paliers-cells');
  navigate('exam', d.e5.id, { tab: 'export' });
  await shot('06-export');
  navigate('classes');
  await shot('07-classes');
  navigate('grids');
  await shot('08-grids');
  document.querySelector('.page-head .btn.primary')?.click();
  await wait(200);
  document.querySelectorAll('.modal .segmented button')[1]?.click();
  await wait(100);
  const draft = document.querySelector('.modal .draft input');
  for (const n of ['Grammaire', 'Lexique']) {
    draft.value = n;
    draft.dispatchEvent(new Event('input'));
    draft.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await wait(60);
  }
  await shot('08b-new-grid');
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await wait(100);

  const ids5 = d.c5.students.map((s) => s.id);
  const ids3 = d.c3.students.map((s) => s.id);
  await exportExamPdf(d.e5, d.c5, { studentIds: ids5, layout: 'perPage', color: true, orientation: 'portrait', outputPath: `${dir}/comp-perpage-color.pdf` });
  await exportExamPdf(d.e5, d.c5, { studentIds: ids5, layout: 'packed', color: true, orientation: 'portrait', outputPath: `${dir}/comp-packed-color.pdf` });
  await exportExamPdf(d.e5, d.c5, { studentIds: ids5, layout: 'packed', color: false, orientation: 'portrait', outputPath: `${dir}/comp-packed-bw.pdf` });
  await exportExamPdf(d.e5, d.c5, { studentIds: ids5.slice(0, 3), layout: 'perStudent', color: true, orientation: 'portrait', outputDir: dir });
  await exportExamPdf(d.e3, d.c3, { studentIds: ids3, layout: 'perPage', color: true, orientation: 'landscape', outputPath: `${dir}/pal-perpage-landscape.pdf` });
  await exportExamPdf(d.e3, d.c3, { studentIds: ids3, layout: 'packed', color: false, orientation: 'portrait', outputPath: `${dir}/pal-packed-bw.pdf` });
  // An assessment graded with an earlier version keeps its points.
  d.e5.grid.legacy = true;
  const fixed = [3, 3, 2, 3, 3, 3, 3];
  d.e5.grid.categories.flatMap((c) => c.rows).forEach((r, i) => (r.fixedPoints = fixed[i]));
  d.e5.grid.target = 20;
  await exportExamPdf(d.e5, d.c5, { studentIds: ids5.slice(0, 2), layout: 'perPage', color: true, orientation: 'portrait', outputPath: `${dir}/comp-legacy.pdf` });
  navigate('exam', d.e5.id, { tab: 'grading', studentId: d.c5.students[0].id });
  await shot('02c-grading-legacy');
  navigate('exam', d.e5.id, { tab: 'grid' });
  await shot('02d-grid-legacy');
  await window.api.selftestLog('legacy', d.c5.students.map((s) => scoreStudent(d.e5.grid, d.e5.results[s.id])));
  d.e5.grid.legacy = false;
  await exportBlankGrid(d.comp, { layout: 'packed', color: true, orientation: 'portrait', outputPath: `${dir}/blank-comp-fill.pdf` });
  await exportBlankGrid(d.pal, { layout: 'perPage', color: true, orientation: 'landscape', outputPath: `${dir}/blank-pal.pdf` });
  store.data.settings.lang = 'en';
  navigate('exam', d.e5.id, { tab: 'grading' });
  await shot('09-grading-en');
  await exportExamPdf(d.e5, d.c5, { studentIds: ids5.slice(0, 2), layout: 'perPage', color: true, orientation: 'portrait', outputPath: `${dir}/comp-en.pdf` });
  await wait(300);
  await window.api.selftestDone();
}
