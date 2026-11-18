// Organizing assessments by class, level (6e to 3e), grid or theme.
// Themes are tags of a grid. An assessment takes the themes of the grid it was
// made from, or of its own copy when that grid was deleted.

export const LEVELS = ['6e', '5e', '4e', '3e'];
export const GROUP_BY = ['date', 'class', 'level', 'grid', 'theme'];

const collator = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });

// "3E", "3e B", "301", "3ème A" -> "3e". A level set on the class wins.
export function classLevel(cls) {
  if (!cls) return '';
  if (cls.level) return cls.level;
  const m = String(cls.name || '').trim().match(/^([3-6])/);
  return m ? `${m[1]}e` : '';
}

export function cleanTheme(name) {
  return String(name || '').replace(/\s+/g, ' ').trim();
}

export function themesOf(grid) {
  return Array.isArray(grid?.themes) ? grid.themes : [];
}

export function examThemes(exam, grids) {
  const source = grids.find((g) => g.id === exam.sourceGridId);
  return themesOf(source || exam.grid);
}

// Every theme in use, sorted.
export function allThemes(grids) {
  const seen = new Map();
  for (const g of grids) for (const th of themesOf(g)) if (!seen.has(th.toLowerCase())) seen.set(th.toLowerCase(), th);
  return [...seen.values()].sort(collator.compare);
}

// exams: already sorted (most recent first), kept in that order in each group.
// Returns [{ key, label, exams, none }]. none: the group of exams without a class,
// level or theme, always last. With 'date', one group without a label.
export function groupExams(exams, by, { classes, grids, labels = {} }) {
  if (!GROUP_BY.includes(by) || by === 'date') return [{ key: 'all', label: '', exams: [...exams] }];
  const groups = new Map();
  const add = (key, label, exam, order = label, none = false) => {
    if (!groups.has(key)) groups.set(key, { key, label, order, none, exams: [] });
    groups.get(key).exams.push(exam);
  };
  for (const exam of exams) {
    const cls = classes.find((c) => c.id === exam.classId);
    if (by === 'class') {
      if (cls) add(cls.id, cls.name, exam);
      else add('none', labels.noClass || '', exam, '', true);
    } else if (by === 'level') {
      const lvl = classLevel(cls);
      const i = LEVELS.indexOf(lvl);
      if (lvl) add(`l:${lvl}`, lvl, exam, i === -1 ? `9${lvl}` : String(i));
      else add('none', labels.noLevel || '', exam, '', true);
    } else if (by === 'grid') {
      const source = grids.find((g) => g.id === exam.sourceGridId);
      const name = source ? source.name : exam.grid.name;
      add(source ? source.id : `copy:${name}`, name || labels.untitled || '', exam);
    } else if (by === 'theme') {
      const list = examThemes(exam, grids);
      if (!list.length) add('none', labels.noTheme || '', exam, '', true);
      for (const th of list) add(`t:${th.toLowerCase()}`, th, exam);
    }
  }
  return [...groups.values()].sort((a, b) => (a.none !== b.none ? (a.none ? 1 : -1) : collator.compare(a.order, b.order)));
}
