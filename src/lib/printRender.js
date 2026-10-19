// Builds the HTML of one printable grid block. The print window paginates the blocks.
import { ACQ_LEVELS, SPECIAL_MARKS, acqLevel } from './model.js';
import { gridItems, scoreStudent, itemScore, formatNumber } from './scoring.js';
import { cellPoints, criterionMax } from './weights.js';
import { tFor, formatDateFor } from './i18n.js';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nl2br(s) {
  return esc(s).replace(/\n/g, '<br>');
}

const CHECK_SVG =
  '<svg class="chk" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';

function dots(code) {
  // Six-step meter readable in black and white.
  const n = Number(code);
  let out = '<span class="meter">';
  for (let i = 1; i <= 6; i++) out += `<i class="${i <= n ? 'f' : ''}"></i>`;
  return `${out}</span>`;
}

function specialLabel(lang, code) {
  const sp = SPECIAL_MARKS.find((s) => s.code === code);
  return sp ? tFor(lang, `acq.${sp.key}`) : '';
}

function header({ exam, grid, student, score, lang, blank, className }) {
  const title = exam ? exam.name : grid.name;
  const metaParts = [];
  if (className) metaParts.push(`<span>${esc(className)}</span>`);
  if (exam?.date) metaParts.push(`<span>${esc(formatDateFor(lang, exam.date))}</span>`);
  const maxTxt = formatNumber(grid.maxScore, lang);
  let who;
  let scoreHtml;
  if (blank || !student) {
    who = `<div class="who blank">${esc(tFor(lang, 'print.name'))} <span class="line"></span></div>`;
    scoreHtml = `<div class="score"><span class="v blank"></span><span class="o">/ ${maxTxt}</span></div>`;
  } else {
    who = `<div class="who"><strong>${esc(student.lastName)}</strong> ${esc(student.firstName)}</div>`;
    let v;
    if (score.status === 'absent') v = esc(tFor(lang, 'acq.absent'));
    else if (score.status === 'exempt') v = esc(tFor(lang, 'acq.exempt'));
    else if (score.score === null) v = '';
    else v = esc(formatNumber(score.score, lang));
    const showMax = score.status !== 'absent' && score.status !== 'exempt';
    scoreHtml = `<div class="score"><span class="v">${v}</span>${showMax ? `<span class="o">/ ${maxTxt}</span>` : ''}</div>`;
  }
  return `<div class="g-head">
    <div class="g-left">
      <div class="g-title">${esc(title || tFor(lang, 'common.untitled'))}</div>
      ${metaParts.length ? `<div class="g-meta">${metaParts.join('')}</div>` : ''}
    </div>
    <div class="g-right">${who}${scoreHtml}</div>
  </div>`;
}

function competencesTable({ grid, result, lang, blank }) {
  const marks = result?.marks || {};
  const comments = result?.comments || {};
  const items = gridItems(grid);
  const byId = Object.fromEntries(items.map((it) => [it.id, it]));
  let rows = '';
  for (const row of grid.rows) {
    const cats = row.categories.length ? row.categories : [null];
    cats.forEach((cat, i) => {
      let tr = '<tr>';
      if (i === 0) {
        tr += `<td class="lvl" rowspan="${cats.length}">${esc(row.level)}<small>${esc(formatNumber(row.points, lang))} pts</small></td>`;
      }
      if (!cat) {
        tr += '<td></td><td></td><td></td></tr>';
        rows += tr;
        return;
      }
      const mark = blank ? undefined : marks[cat.id];
      const lvl = acqLevel(mark);
      let text = '';
      if (cat.name) text += `<div class="cat-name">${esc(cat.name)}</div>`;
      if (cat.descriptor) text += `<div class="desc">${nl2br(cat.descriptor)}</div>`;
      if (!blank && grid.categoryComments && comments[cat.id]) {
        text += `<div class="cat-comment">${nl2br(comments[cat.id])}</div>`;
      }
      tr += `<td class="txt">${text}</td>`;
      if (lvl) {
        const label = esc(tFor(lang, `acq.${lvl.key}`));
        tr += `<td class="acq lvl-${lvl.code}" style="--c:${lvl.color};--tc:${lvl.text}"><span class="acq-label">${label}</span>${dots(lvl.code)}</td>`;
      } else if (mark) {
        tr += `<td class="acq special"><span class="acq-label">${esc(specialLabel(lang, mark))}</span></td>`;
      } else {
        tr += '<td class="acq"></td>';
      }
      const item = byId[cat.id];
      const max = esc(formatNumber(item.max, lang));
      let pts;
      if (blank || !mark) pts = `<span class="pblank"></span> / ${max}`;
      else {
        const s = itemScore(grid, item, mark);
        pts = s.excluded ? '<span class="excl">–</span>' : `${esc(formatNumber(s.earned, lang))} / ${max}`;
      }
      tr += `<td class="pts">${pts}</td></tr>`;
      rows += tr;
    });
  }
  return `<table class="comp">
    <colgroup><col class="c-lvl"><col><col class="c-acq"><col class="c-pts"></colgroup>
    <thead><tr>
      <th>${esc(tFor(lang, 'print.level'))}</th>
      <th>${esc(tFor(lang, 'print.skill'))}</th>
      <th>${esc(tFor(lang, 'print.acquisition'))}</th>
      <th class="pts">${esc(tFor(lang, 'print.points'))}</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function paliersTable({ grid, result, lang, blank }) {
  const marks = result?.marks || {};
  const groups = [];
  for (const c of grid.criteria) {
    const g = (c.group || '').trim();
    const last = groups[groups.length - 1];
    if (g && last && last.name === g) last.span++;
    else groups.push({ name: g, span: 1, crit: c });
  }
  const hasGroups = groups.some((g) => g.name);
  const critHead = (c) => {
    const mark = blank ? undefined : marks[c.id];
    const sp = mark && ['A', 'D', 'R'].includes(mark) ? `<div class="sp-mark">${esc(specialLabel(lang, mark))}</div>` : '';
    return `<div class="crit-name">${esc(c.name || tFor(lang, 'common.untitled'))}</div><div class="crit-max">/ ${esc(formatNumber(criterionMax(grid, c.id), lang))}</div>${sp}`;
  };
  let thead = '';
  if (hasGroups) {
    thead += `<tr><th rowspan="2" class="lvl-h">${esc(tFor(lang, 'print.level'))}</th>`;
    for (const g of groups) {
      if (g.name) thead += `<th colspan="${g.span}" class="grp">${esc(g.name)}</th>`;
      else thead += `<th rowspan="2">${critHead(g.crit)}</th>`;
    }
    thead += '</tr><tr>';
    for (const c of grid.criteria) if ((c.group || '').trim()) thead += `<th>${critHead(c)}</th>`;
    thead += '</tr>';
  } else {
    thead = `<tr><th class="lvl-h">${esc(tFor(lang, 'print.level'))}</th>${grid.criteria.map((c) => `<th>${critHead(c)}</th>`).join('')}</tr>`;
  }
  let tbody = '';
  for (const lvl of grid.levels) {
    tbody += `<tr><td class="lvl">${esc(lvl.level)}</td>`;
    for (const c of grid.criteria) {
      const selected = !blank && marks[c.id] === lvl.id;
      const desc = grid.cells?.[lvl.id]?.[c.id]?.descriptor || '';
      tbody += `<td class="mcell${selected ? ' sel' : ''}">${selected ? CHECK_SVG : ''}<div class="desc">${nl2br(desc)}</div><div class="mpts">${esc(formatNumber(cellPoints(grid, lvl.id, c.id), lang))} pts</div></td>`;
    }
    tbody += '</tr>';
  }
  const comments = result?.comments || {};
  let critComments = '';
  if (!blank && grid.categoryComments) {
    const list = grid.criteria.filter((c) => comments[c.id]);
    if (list.length) {
      critComments = `<div class="crit-comments">${list
        .map((c) => `<div><strong>${esc(c.name)}</strong> : ${nl2br(comments[c.id])}</div>`)
        .join('')}</div>`;
    }
  }
  return `<table class="pal"><colgroup><col class="c-lvl">${grid.criteria.map(() => '<col>').join('')}</colgroup>
    <thead>${thead}</thead><tbody>${tbody}</tbody></table>${critComments}`;
}

// Returns the HTML for one block (one student, or a blank grid).
export function renderGridBlock({ exam = null, grid, student = null, result = null, lang = 'fr', blank = false, className = '' }) {
  const score = student && !blank ? scoreStudent(grid, result) : null;
  let html = `<div class="g">`;
  html += header({ exam, grid, student, score, lang, blank, className });
  html += grid.type === 'paliers' ? paliersTable({ grid, result, lang, blank }) : competencesTable({ grid, result, lang, blank });
  if (!blank && result?.comment) {
    html += `<div class="comment"><span class="c-label">${esc(tFor(lang, 'print.comment'))}</span> ${nl2br(result.comment)}</div>`;
  }
  html += '</div>';
  return html;
}

export { ACQ_LEVELS };
