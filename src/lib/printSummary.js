// "Relevé global": one table for the class, with the mark and the average
// acquisition of each student, per category when there are some, the skills
// ticked to appear on their own, and the class average at the bottom.
import { scaleInfo, usesRoles } from './bareme.js';
import { gridItems, itemScore, formatNumber, studentAcquisition, meanAcquisition, acquisitionOf, roundTo } from './scoring.js';
import { examScore, examAverage, roleMap, rolesOf } from './groups.js';
import { acqLevel, SPECIAL_MARKS } from './model.js';
import { acqCell, dots } from './printRender.js';
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

// Skills (rows of a skills grid) ticked to get their own column.
export function summaryRows(grid, info = scaleInfo(grid)) {
  if (grid.type === 'paliers') return [];
  return gridItems(grid, info).filter((it) => it.row.inSummary);
}

// One ticked skill for one student: what the cell shows and what goes into the class average.
// kind: 'level' (a colour), 'special' (A, D, R), 'none' (not graded), 'other' (another role).
export function rowMark(grid, info, item, marks, roleId) {
  if (usesRoles(grid) && roleId !== item.category.id) return { kind: 'other' };
  const mark = marks?.[item.id];
  const s = itemScore(grid, item, mark, info);
  if (s.ungraded) return { kind: 'none' };
  const acq = acquisitionOf([item], marks);
  if (acqLevel(mark)) return { kind: 'level', mark, earned: s.earned, acq };
  return { kind: 'special', mark, earned: s.counted ? s.earned : null, acq };
}

function shortText(text, max = 70) {
  const one = String(text || '').replace(/\s+/g, ' ').trim();
  return one.length > max ? `${one.slice(0, max - 1).trimEnd()}…` : one;
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

  const picked = summaryRows(grid, info);
  const pts = (v, d = 2) => T('common.points', { n: v, v: fmt(v, d) });

  const target = fmt(info.target);
  let head = `<th class="name">${esc(T('print.student'))}</th>`;
  if (roles) head += `<th>${esc(T('print.role'))}</th>`;
  head += `<th class="num">${esc(T('print.mark'))}<br><small>/ ${target}</small></th>`;
  if (!isPal) head += `<th>${esc(T('acq.average'))}</th>`;
  for (const p of parts) {
    head += `<th class="part" colspan="${isPal ? 1 : 2}">${esc(p.name)}<br><small>/ ${fmt(p.max)}</small></th>`;
  }
  picked.forEach((it, i) => {
    const cat = grid.useCategories ? `<span class="rc-cat">${esc(it.category.name || T('common.untitled'))}</span>` : '';
    const text = shortText(it.row.descriptor) || T('grading.noDescriptor');
    head += `<th class="rc${i === 0 ? ' first' : ''}">${cat}<span class="rc-txt"><b>${esc(it.row.level)}</b> ${esc(text)}</span><small>/ ${fmt(it.max)}</small></th>`;
  });

  let body = '';
  let partial = false;
  const overallAcqs = [];
  const partStats = Object.fromEntries(parts.map((p) => [p.id, { sum: 0, n: 0, acqs: [] }]));
  const rowStats = Object.fromEntries(picked.map((it) => [it.id, { sum: 0, n: 0, acqs: [] }]));
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
    picked.forEach((it, i) => {
      const first = i === 0 ? ' first' : '';
      const rm = rowMark(grid, info, it, marks, roleId);
      const st = rowStats[it.id];
      if (rm.acq) st.acqs.push(rm.acq);
      if (rm.earned !== undefined && rm.earned !== null) {
        st.sum += rm.earned;
        st.n++;
      }
      if (rm.kind === 'level') {
        const lvl = acqLevel(rm.mark);
        tr += `<td class="acq sum rc${first}" style="--c:${lvl.color};--tc:${lvl.text}"><span class="acq-label">${esc(T(`acq.${lvl.key}`))}</span>${dots(lvl.code)}<span class="acq-val">${esc(pts(rm.earned))}</span></td>`;
      } else if (rm.kind === 'special') {
        const key = SPECIAL_MARKS.find((m) => m.code === rm.mark)?.key;
        const val = rm.earned === null ? '' : `<span class="acq-val">${esc(pts(rm.earned))}</span>`;
        tr += `<td class="acq sum special rc${first}"><span class="acq-label">${esc(T(`acq.${key}`))}</span>${val}</td>`;
      } else {
        tr += `<td class="num rc${first}"><span class="muted">–</span></td>`;
      }
    });
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
  picked.forEach((it, i) => {
    const first = i === 0 ? ' first' : '';
    const st = rowStats[it.id];
    const mean = meanAcquisition(st.acqs);
    const lvl = mean ? acqLevel(mean.code) : null;
    const val = st.n ? `<span class="acq-val">${esc(pts(st.sum / st.n, 1))}</span>` : '';
    if (lvl) foot += `<td class="acq sum rc${first}" style="--c:${lvl.color};--tc:${lvl.text}"><span class="acq-label">${esc(T(`acq.${lvl.key}`))}</span>${dots(lvl.code)}${val}</td>`;
    else foot += `<td class="num rc${first}">${st.n ? esc(pts(st.sum / st.n, 1)) : '–'}</td>`;
  });
  foot += '</tr>';

  const columns = 2 + (roles ? 1 : 0) + (isPal ? 0 : 1) + parts.length * (isPal ? 1 : 2) + picked.length;
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
    <table class="sum${columns > 11 ? ' dense' : ''}">
      <thead><tr>${head}</tr></thead>
      <tbody>${body}${foot}</tbody>
    </table>
    ${notes.map((n) => `<p class="sum-note">${esc(n)}</p>`).join('')}
  </div>`;
}
