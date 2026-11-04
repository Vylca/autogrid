import { renderGridBlock } from './printRender.js';
import { roleMap, rolesOf } from './groups.js';
import { usesRoles } from './bareme.js';
import { sortStudents } from './model.js';
import { toast } from './store.js';
import { t, lang } from './i18n.js';

function plain(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function report(res, perStudent) {
  if (!res || res.canceled) return res;
  if (!res.ok) {
    toast(t('export.failed', { error: res.error || '' }), { kind: 'error', duration: 9000 });
    return res;
  }
  const message = perStudent ? t('export.doneMany', { n: res.count }) : t('export.doneOne');
  toast(message, {
    action: { label: perStudent ? t('export.openFolder') : t('export.open'), run: () => window.api.openPath(res.path) },
    duration: 9000,
  });
  return res;
}

// opts: { studentIds, layout: 'perPage' | 'packed' | 'perStudent', color, orientation }
export async function exportExamPdf(exam, cls, opts) {
  const l = lang.value;
  const wanted = new Set(opts.studentIds);
  const map = exam.grid.groupWork ? roleMap(exam) : null;
  // Group work: each student gets only the rows of their role.
  const students = sortStudents(cls.students).filter((s) => wanted.has(s.id) && (!map || map[s.id]));
  if (!students.length) return null;
  const block = (s) =>
    renderGridBlock({ exam, grid: exam.grid, student: s, result: exam.results[s.id], lang: l, className: cls.name, roleId: usesRoles(exam.grid) ? map?.[s.id]?.roleId : undefined });
  const base = {
    orientation: opts.orientation,
    color: opts.color,
    dialogTitle: t('export.dialogTitle'),
    outputPath: opts.outputPath,
    outputDir: opts.outputDir,
  };
  let req;
  if (opts.layout === 'perStudent') {
    req = {
      ...base,
      kind: 'perStudent',
      layout: 'perPage',
      subfolder: `${exam.name || t('common.untitled')} ${cls.name}`.trim(),
      documents: students.map((s) => ({
        fileName: `${s.lastName} ${s.firstName} - ${exam.name || t('common.untitled')}`,
        blocks: [block(s)],
      })),
    };
  } else {
    req = {
      ...base,
      kind: 'single',
      layout: opts.layout,
      defaultName: `${exam.name || t('common.untitled')} - ${cls.name}`,
      documents: [{ blocks: students.map(block) }],
    };
  }
  const res = await window.api.exportPdf(plain(req));
  return report(res, opts.layout === 'perStudent');
}

// opts: { layout: 'perPage' | 'packed', color, orientation }
export async function exportBlankGrid(grid, opts) {
  // Group work: one blank sheet per role. Otherwise the page is filled with copies.
  const roles = usesRoles(grid) ? rolesOf(grid) : [];
  const blocks = roles.length
    ? roles.map((r) => renderGridBlock({ grid, blank: true, lang: lang.value, roleId: r.id }))
    : [renderGridBlock({ grid, blank: true, lang: lang.value })];
  const req = {
    kind: 'single',
    layout: opts.layout === 'packed' ? (roles.length ? 'packed' : 'fill') : 'perPage',
    orientation: opts.orientation,
    color: opts.color,
    dialogTitle: t('export.dialogTitle'),
    outputPath: opts.outputPath,
    defaultName: grid.name || t('common.untitled'),
    documents: [{ blocks }],
  };
  const res = await window.api.exportPdf(plain(req));
  return report(res, false);
}
