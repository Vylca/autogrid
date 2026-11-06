// "Relevé global": one table for the class, with the mark and the average
// acquisition of each student, per category when there are some, and the
// class average at the bottom.
import { scaleInfo, usesRoles } from './bareme.js';
import { gridItems, itemScore, formatNumber, studentAcquisition, meanAcquisition, roundTo } from './scoring.js';
import { examScore, examAverage, roleMap, rolesOf } from './groups.js';
import { acqCell } from './printRender.js';
import { tFor, formatDateFor } from './i18n.js';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Points of one category (or criterion) for one student: { earned, possible, complete }.
function partPoints(grid, info, items, marks) {
  let earned = 0;
  let possible = 0;
  let graded = 0;
  let ungraded = 0;
  for (const it of items) {
    const s = itemScore(grid, it, marks[it.id], info);
    if (s.ungraded) {
      ungraded++;
      continue;
    }
    graded++;
    if (s.counted) {
      earned += s.earned;
      possible += it.max;
    }
  }
  return { earned, possible, graded, complete: graded > 0 && ungraded === 0 };
}

function levelName(grid, mark) {
  return grid.levels.find((l) => l.id === mark)?.level || '';
}

export function renderSummary({ exam, cls, students, lang }) {
  const T = (k, p) => tFor(lang, k, p);
  const fmt = (v, d = 2) => formatNumber(v, lang, d);
  const grid = exam.grid;
  const info = scaleInfo(grid);
  const isPal = grid.type === 'paliers';
  const roles = usesRoles(grid);
  const map = grid.groupWork ? roleMap(exam) : null;
  const roleNames = Object.fromEntries(rolesOf(grid).map((r) => [r.id, r.name || T('common.untitled')]));
  const items = gridItems(grid, info);

  // Columns per part: categories (skills grid without roles) or criteria (level grid).
  let parts = [];
  if (isPal) {
    parts = grid.criteria.map((c) => ({ id: c.id, name: c.name || T('common.untitled'), items: items.filter((it) => it.id === c.id), max: info.critMax[c.id] || 0 }));
  } else if (grid.useCategories && !roles) {
    parts = grid.categories
      .filter((c) => c.rows.length)
      .map((c) => ({ id: c.id, name: c.name || T('common.untitled'), items: items.filter((it) => it.category.id === c.id), max: info.catMax[c.id] || 0 }));
  }

  const target = fmt(info.target);
  let head = `<th class="name">${esc(T('print.student'))}</th>`;
  if (roles) head += `<th>${esc(T('print.role'))}</th>`;
  head += `<th class="num">${esc(T('print.mark'))}<br><small>/ ${target}</small></th>`;
  if (!isPal) head += `<th>${esc(T('acq.average'))}</th>`;
  for (const p of parts) {
    head += `<th class="part" colspan="${isPal ? 1 : 2}">${esc(p.name)}<br><small>/ ${fmt(p.max)}</small></th>`;
  }

  let body = '';
  let partial = false;
  const overallAcqs = [];
  const partStats = Object.fromEntries(parts.map((p) => [p.id, { sum: 0, n: 0, acqs: [] }]));
  for (const s of students) {
    const result = exam.results[s.id];
    const marks = result?.marks || {};
    const roleId = map?.[s.id]?.roleId;
    const sc = examScore(exam, s.id, map);
    const acq = isPal ? null : studentAcquisition(grid, result, roleId);
    if (acq?.overall && sc.status !== 'absent' && sc.status !== 'exempt') overallAcqs.push(acq.overall);
    let mark;
    if (sc.status === 'absent') mark = `<span class="muted">${esc(T('acq.absent'))}</span>`;
    else if (sc.status === 'exempt') mark = `<span class="muted">${esc(T('acq.exempt'))}</span>`;
    else if (sc.score === null) mark = '<span class="muted">–</span>';
    else if (sc.status === 'partial') {
      partial = true;
      mark = `${esc(fmt(sc.score))}<span class="star">*</span>`;
    } else mark = `<strong>${esc(fmt(sc.score))}</strong>`;
    let tr = `<tr><td class="name"><strong>${esc(s.lastName)}</strong> ${esc(s.firstName)}</td>`;
    if (roles) tr += `<td class="role">${esc(roleNames[roleId] || '')}</td>`;
    tr += `<td class="num mark">${mark}</td>`;
    if (!isPal) tr += acqCell(acq?.overall, lang, 'sum');
    for (const p of parts) {
      const pp = partPoints(grid, info, p.items, marks);
      const st = partStats[p.id];
      let txt = '<span class="muted">–</span>';
      const special = p.items.map((it) => marks[it.id]).find((m) => m === 'A' || m === 'D');
      if (pp.graded && pp.possible === 0 && special) {
        txt = `<span class="muted">${esc(T(special === 'A' ? 'acq.absent' : 'acq.exempt'))}</span>`;
      } else if (pp.graded && pp.possible > 0) {
        txt = esc(fmt(pp.earned));
        if (pp.complete) {
          st.sum += (pp.earned / pp.possible) * p.max;
          st.n++;
        }
      }
      if (isPal) {
        const lvl = levelName(grid, marks[p.id]);
        tr += `<td class="num">${txt}${lvl ? ` <small>(${esc(lvl)})</small>` : ''}</td>`;
      } else {
        const a = acq?.byCategory[p.id];
        if (a) st.acqs.push(a);
        tr += `<td class="num">${txt}</td>${acqCell(a, lang, 'sum small')}`;
      }
    }
    body += `${tr}</tr>`;
  }

  // Class average.
  const avg = examAverage(exam, students.map((s) => s.id));
  let foot = `<tr class="avg"><td class="name">${esc(T('print.classAverage'))}</td>`;
  if (roles) foot += '<td></td>';
  foot += `<td class="num mark"><strong>${avg === null ? '–' : esc(fmt(roundTo(avg, 0.01)))}</strong></td>`;
  if (!isPal) foot += acqCell(meanAcquisition(overallAcqs), lang, 'sum');
  for (const p of parts) {
    const st = partStats[p.id];
    const v = st.n ? esc(fmt(st.sum / st.n, 1)) : '–';
    foot += `<td class="num">${v}</td>`;
    if (!isPal) foot += acqCell(meanAcquisition(st.acqs), lang, 'sum small');
  }
  foot += '</tr>';

  const meta = [cls?.name, exam.date ? formatDateFor(lang, exam.date) : '', grid.name, T('print.nStudents', { n: students.length })]
    .filter(Boolean)
    .map((x) => `<span>${esc(x)}</span>`)
    .join('');
  const notes = [];
  if (!isPal) notes.push(T('print.acqScale'));
  if (partial) notes.push(T('print.partialNote'));

  return `<div class="summary">
    <div class="g-head">
      <div class="g-left">
        <div class="g-title">${esc(T('print.summaryTitle', { name: exam.name || T('common.untitled') }))}</div>
        <div class="g-meta">${meta}</div>
      </div>
    </div>
    <table class="sum">
      <thead><tr>${head}</tr></thead>
      <tbody>${body}${foot}</tbody>
    </table>
    ${notes.map((n) => `<p class="sum-note">${esc(n)}</p>`).join('')}
  </div>`;
}
