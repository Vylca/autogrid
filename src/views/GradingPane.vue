<script setup>
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { store } from '../lib/store.js';
import { t, lang } from '../lib/i18n.js';
import { sortStudents, emptyResult, SPECIAL_MARKS } from '../lib/model.js';
import { gridItems, scoreStudent, itemScore, classAverage, formatNumber } from '../lib/scoring.js';
import { cellPoints, criterionMax } from '../lib/weights.js';
import Icon from '../components/Icon.vue';
import AcqPicker from '../components/AcqPicker.vue';

const props = defineProps({ exam: Object, cls: Object });

const grid = computed(() => props.exam.grid);
const students = computed(() => sortStudents(props.cls.students));
const items = computed(() => gridItems(grid.value));
const itemIndex = computed(() => Object.fromEntries(items.value.map((it, i) => [it.id, i])));

const currentId = ref(store.route.studentId && students.value.some((s) => s.id === store.route.studentId) ? store.route.studentId : students.value[0]?.id);
const focusIndex = ref(0);
const openComments = ref({});

const current = computed(() => students.value.find((s) => s.id === currentId.value) || null);
const currentPos = computed(() => students.value.findIndex((s) => s.id === currentId.value));
const result = computed(() => props.exam.results[currentId.value] || null);
const marks = computed(() => result.value?.marks || {});

const scores = computed(() => {
  const out = {};
  for (const s of students.value) out[s.id] = scoreStudent(grid.value, props.exam.results[s.id]);
  return out;
});
const currentScore = computed(() => scores.value[currentId.value] || null);
const average = computed(() => classAverage(grid.value, props.exam.results, students.value.map((s) => s.id)));

const groups = computed(() => {
  // Group header cells for paliers grids: consecutive criteria with the same group.
  const out = [];
  for (const c of grid.value.criteria) {
    const g = (c.group || '').trim();
    const last = out[out.length - 1];
    if (g && last && last.name === g) last.span++;
    else out.push({ name: g, span: 1, first: c.id });
  }
  return out;
});
const hasGroups = computed(() => groups.value.some((g) => g.name));

watch(currentId, (id) => {
  store.route = { ...store.route, studentId: id };
  focusIndex.value = firstUngraded();
});

function ensureResult() {
  if (!props.exam.results[currentId.value]) props.exam.results[currentId.value] = emptyResult();
  return props.exam.results[currentId.value];
}

function firstUngraded() {
  const m = props.exam.results[currentId.value]?.marks || {};
  const i = items.value.findIndex((it) => !m[it.id]);
  return i === -1 ? 0 : i;
}

function scrollToFocus() {
  nextTick(() => {
    const el = document.querySelector('[data-focused="true"]');
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

function setMark(itemId, code, fromClick = false) {
  const r = ensureResult();
  if (fromClick && r.marks[itemId] === code) {
    delete r.marks[itemId];
    return;
  }
  r.marks[itemId] = code;
  const idx = itemIndex.value[itemId];
  if (idx !== undefined) {
    focusIndex.value = Math.min(idx + 1, items.value.length - 1);
    scrollToFocus();
  }
}

function clearMark(itemId) {
  const r = props.exam.results[currentId.value];
  if (r) delete r.marks[itemId];
}

function toggleAbsent() {
  const r = ensureResult();
  const allAbsent = items.value.length > 0 && items.value.every((it) => r.marks[it.id] === 'A');
  for (const it of items.value) {
    if (allAbsent) delete r.marks[it.id];
    else r.marks[it.id] = 'A';
  }
}

function clearAll() {
  const r = props.exam.results[currentId.value];
  if (!r || Object.keys(r.marks).length === 0) return;
  if (!window.confirm(t('grading.confirmClear'))) return;
  r.marks = {};
}

function moveStudent(delta) {
  const i = currentPos.value + delta;
  if (i >= 0 && i < students.value.length) currentId.value = students.value[i].id;
}

function moveFocus(delta) {
  const n = items.value.length;
  if (!n) return;
  focusIndex.value = Math.max(0, Math.min(n - 1, focusIndex.value + delta));
  scrollToFocus();
}

function digit(n) {
  const item = items.value[focusIndex.value];
  if (!item) return;
  if (grid.value.type === 'paliers') {
    const levels = grid.value.levels;
    const idx = levels.length - n;
    if (idx >= 0 && idx < levels.length) setMark(item.id, levels[idx].id);
  } else if (n >= 1 && n <= 6) {
    setMark(item.id, String(n));
  }
}

function onKey(e) {
  const tag = e.target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    if (e.key === 'Escape') e.target.blur();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (document.querySelector('.modal-backdrop')) return;
  const k = e.key;
  const item = items.value[focusIndex.value];
  if (/^[1-9]$/.test(k)) digit(Number(k));
  else if (/^[adr]$/i.test(k) && item) setMark(item.id, k.toUpperCase());
  else if (k === 'ArrowDown') moveFocus(1);
  else if (k === 'ArrowUp') moveFocus(-1);
  else if (k === 'ArrowRight' || k === 'PageDown') moveStudent(1);
  else if (k === 'ArrowLeft' || k === 'PageUp') moveStudent(-1);
  else if ((k === 'Backspace' || k === 'Delete') && item) clearMark(item.id);
  else return;
  e.preventDefault();
}

onMounted(() => {
  window.addEventListener('keydown', onKey);
  focusIndex.value = firstUngraded();
});
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));

function statusOf(id) {
  return scores.value[id]?.status || 'empty';
}

function scoreText(s) {
  if (!s) return '';
  if (s.status === 'absent') return t('grading.absShort');
  if (s.status === 'exempt') return t('grading.exemptShort');
  if (s.score === null) return '';
  return formatNumber(s.score, lang.value);
}

function itemPoints(item) {
  const s = itemScore(grid.value, item, marks.value[item.id]);
  if (s.ungraded) return `– / ${formatNumber(item.max, lang.value)}`;
  if (s.excluded) return t('grading.excluded');
  return `${formatNumber(s.earned, lang.value)} / ${formatNumber(item.max, lang.value)}`;
}

function specialLabel(code) {
  const sp = SPECIAL_MARKS.find((s) => s.code === code);
  return sp ? t(`acq.${sp.key}`) : '';
}

function toggleComment(id) {
  openComments.value[id] = !openComments.value[id];
}

const commentModel = (itemId) => ({
  get: () => result.value?.comments?.[itemId] || '',
  set: (v) => {
    const r = ensureResult();
    if (!r.comments) r.comments = {};
    if (v) r.comments[itemId] = v;
    else delete r.comments[itemId];
  },
});

const studentComment = computed({
  get: () => result.value?.comment || '',
  set: (v) => {
    ensureResult().comment = v;
  },
});
</script>

<template>
  <div v-if="!students.length" class="empty">{{ t('grading.noStudents') }}</div>
  <div v-else-if="!items.length" class="empty">
    <p>{{ t('grading.emptyGrid') }}</p>
    <div class="actions">
      <button class="btn primary" @click="store.route = { ...store.route, tab: 'grid' }"><Icon name="grid" /> {{ t('exam.tabGrid') }}</button>
    </div>
  </div>
  <div v-else class="grading">
    <aside class="roster">
      <div class="roster-list">
        <button
          v-for="s in students"
          :key="s.id"
          class="roster-item"
          :class="{ on: s.id === currentId }"
          @click="currentId = s.id"
        >
          <span class="status" :class="'st-' + statusOf(s.id)" :title="t('status.' + statusOf(s.id))"></span>
          <span class="rname"><strong>{{ s.lastName }}</strong> {{ s.firstName }}</span>
          <span class="rscore">{{ scoreText(scores[s.id]) }}</span>
        </button>
      </div>
      <div class="roster-foot">
        <span>{{ t('grading.average') }}</span>
        <strong v-if="average !== null">{{ formatNumber(average, lang, 2) }} / {{ formatNumber(grid.maxScore, lang) }}</strong>
        <span v-else class="hint">–</span>
      </div>
    </aside>

    <section class="sheet" v-if="current">
      <header class="sheet-head">
        <div class="who">
          <div class="student-name"><strong>{{ current.lastName }}</strong> {{ current.firstName }}</div>
          <div class="hint">{{ t('grading.position', { n: currentPos + 1, total: students.length }) }}</div>
        </div>
        <div class="head-actions">
          <button class="icon-btn" :disabled="currentPos <= 0" :title="t('grading.prev')" @click="moveStudent(-1)"><Icon name="left" /></button>
          <button class="icon-btn" :disabled="currentPos >= students.length - 1" :title="t('grading.next')" @click="moveStudent(1)"><Icon name="right" /></button>
          <button class="btn small" @click="toggleAbsent">{{ t('grading.markAbsent') }}</button>
          <button class="btn small ghost" @click="clearAll">{{ t('grading.clear') }}</button>
        </div>
        <div class="score-box" :class="currentScore?.status">
          <span class="big">{{ scoreText(currentScore) || '–' }}</span>
          <span class="out" v-if="currentScore?.score !== null">/ {{ formatNumber(grid.maxScore, lang) }}</span>
          <span class="state">{{ t('status.' + (currentScore?.status || 'empty')) }}</span>
        </div>
      </header>

      <!-- Competences grid -->
      <div v-if="grid.type === 'competences'" class="comp">
        <div v-for="row in grid.rows" :key="row.id" class="row-group">
          <div class="lvl-cell">
            <span class="lvl">{{ row.level }}</span>
            <span class="hint">{{ formatNumber(row.points, lang) }} pts</span>
          </div>
          <div class="cats">
            <div
              v-for="cat in row.categories"
              :key="cat.id"
              class="cat"
              :class="{ focused: itemIndex[cat.id] === focusIndex }"
              :data-focused="itemIndex[cat.id] === focusIndex"
              @click="focusIndex = itemIndex[cat.id]"
            >
              <div class="cat-text">
                <strong v-if="cat.name">{{ cat.name }}</strong>
                <p v-if="cat.descriptor" class="desc">{{ cat.descriptor }}</p>
                <p v-if="!cat.name && !cat.descriptor" class="hint">{{ t('common.untitled') }}</p>
              </div>
              <AcqPicker :value="marks[cat.id]" @pick="(code) => { focusIndex = itemIndex[cat.id]; setMark(cat.id, code, true); }" />
              <div class="cat-side">
                <span class="cat-pts">{{ itemPoints(items[itemIndex[cat.id]]) }}</span>
                <button
                  v-if="grid.categoryComments"
                  class="icon-btn"
                  :class="{ has: result?.comments?.[cat.id] }"
                  :title="t('grading.categoryComment')"
                  @click.stop="toggleComment(cat.id)"
                >
                  <Icon name="comment" :size="16" />
                </button>
              </div>
              <div v-if="grid.categoryComments && (openComments[cat.id] || result?.comments?.[cat.id])" class="cat-comment" @click.stop>
                <input
                  class="input"
                  :placeholder="t('grading.categoryCommentPlaceholder')"
                  :value="commentModel(cat.id).get()"
                  @input="commentModel(cat.id).set($event.target.value)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Paliers grid -->
      <div v-else class="matrix-wrap">
        <table class="matrix">
          <thead>
            <tr v-if="hasGroups">
              <th rowspan="2" class="lvl-head">{{ t('grid.level') }}</th>
              <template v-for="g in groups" :key="g.first">
                <th v-if="g.name" :colspan="g.span" class="group-head">{{ g.name }}</th>
                <th
                  v-else
                  rowspan="2"
                  class="crit-head"
                  :class="{ focused: itemIndex[g.first] === focusIndex }"
                  :data-focused="itemIndex[g.first] === focusIndex"
                  @click="focusIndex = itemIndex[g.first]"
                >
                  <div class="crit-title">{{ grid.criteria.find((c) => c.id === g.first).name || t('common.untitled') }}</div>
                  <div class="crit-sub">
                    <span class="hint">/ {{ formatNumber(criterionMax(grid, g.first), lang) }}</span>
                    <span class="specials">
                      <button v-for="s in SPECIAL_MARKS" :key="s.code" class="sp" :class="{ on: marks[g.first] === s.code }" :title="t('acq.' + s.key)" @click.stop="setMark(g.first, s.code, true)">{{ s.code }}</button>
                    </span>
                  </div>
                </th>
              </template>
            </tr>
            <tr>
              <th v-if="!hasGroups" class="lvl-head">{{ t('grid.level') }}</th>
              <template v-for="c in grid.criteria" :key="c.id">
                <th
                  v-if="!hasGroups || (c.group || '').trim()"
                  class="crit-head"
                  :class="{ focused: itemIndex[c.id] === focusIndex }"
                  :data-focused="itemIndex[c.id] === focusIndex"
                  @click="focusIndex = itemIndex[c.id]"
                >
                  <div class="crit-title">{{ c.name || t('common.untitled') }}</div>
                  <div class="crit-sub">
                    <span class="hint">/ {{ formatNumber(criterionMax(grid, c.id), lang) }}</span>
                    <span class="specials">
                      <button v-for="s in SPECIAL_MARKS" :key="s.code" class="sp" :class="{ on: marks[c.id] === s.code }" :title="t('acq.' + s.key)" @click.stop="setMark(c.id, s.code, true)">{{ s.code }}</button>
                    </span>
                  </div>
                </th>
              </template>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(lvl, li) in grid.levels" :key="lvl.id">
              <th class="lvl-cell-m">
                <span class="kbd">{{ grid.levels.length - li }}</span>
                <span class="lvl">{{ lvl.level }}</span>
              </th>
              <td
                v-for="c in grid.criteria"
                :key="c.id"
                class="mcell"
                :class="{ selected: marks[c.id] === lvl.id, focused: itemIndex[c.id] === focusIndex, muted: ['A', 'D', 'R'].includes(marks[c.id]) }"
                @click="focusIndex = itemIndex[c.id]; setMark(c.id, lvl.id, true)"
              >
                <p class="desc">{{ grid.cells?.[lvl.id]?.[c.id]?.descriptor }}</p>
                <span class="mpts">{{ formatNumber(cellPoints(grid, lvl.id, c.id), lang) }} pts</span>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="crit-status">
          <span v-for="c in grid.criteria" :key="c.id" class="tag" v-show="['A', 'D', 'R'].includes(marks[c.id])">
            {{ c.name || t('common.untitled') }} : {{ specialLabel(marks[c.id]) }}
          </span>
        </div>
        <div v-if="grid.categoryComments" class="m-comments">
          <label v-for="c in grid.criteria" :key="c.id" class="field">
            <span>{{ c.name || t('common.untitled') }}</span>
            <input class="input" :placeholder="t('grading.categoryCommentPlaceholder')" :value="commentModel(c.id).get()" @input="commentModel(c.id).set($event.target.value)" />
          </label>
        </div>
      </div>

      <label class="field student-comment">
        <span>{{ t('grading.comment') }}</span>
        <textarea v-model="studentComment" class="input" rows="2" :placeholder="t('grading.commentPlaceholder')"></textarea>
      </label>

      <footer class="keys">
        <span v-if="grid.type === 'competences'"><span class="kbd">1</span>…<span class="kbd">6</span> {{ t('keys.level') }}</span>
        <span v-else><span class="kbd">1</span>…<span class="kbd">{{ grid.levels.length }}</span> {{ t('keys.palier') }}</span>
        <span><span class="kbd">A</span> <span class="kbd">D</span> <span class="kbd">R</span> {{ t('keys.special') }}</span>
        <span><span class="kbd">↑</span> <span class="kbd">↓</span> {{ grid.type === 'competences' ? t('keys.category') : t('keys.criterion') }}</span>
        <span><span class="kbd">←</span> <span class="kbd">→</span> {{ t('keys.student') }}</span>
        <span><span class="kbd">⌫</span> {{ t('keys.clear') }}</span>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.grading {
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}

/* Roster */
.roster {
  position: sticky;
  top: 12px;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 230px);
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--surface);
}
.roster-list {
  overflow: auto;
  padding: 6px;
}
.roster-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: 5px;
  background: none;
  text-align: left;
  font-size: 14px;
  cursor: pointer;
}
.roster-item:hover {
  background: var(--paper);
}
.roster-item.on {
  background: var(--accent-soft);
}
.rname {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rscore {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--ink-2);
}
.status {
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--rule-strong);
}
.status.st-partial {
  border-color: var(--accent);
  background: linear-gradient(90deg, var(--accent) 50%, transparent 50%);
}
.status.st-complete {
  border-color: var(--ok);
  background: var(--ok);
}
.status.st-absent,
.status.st-exempt {
  border-color: var(--ink-3);
  background: var(--ink-3);
}
.roster-foot {
  display: flex;
  justify-content: space-between;
  padding: 10px 14px;
  border-top: 1px solid var(--rule);
  font-size: 14px;
}

/* Sheet */
.sheet {
  min-width: 0;
}
.sheet-head {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 14px;
  margin-bottom: 14px;
  border-bottom: 1px solid var(--rule);
}
.who {
  flex: 1;
  min-width: 0;
}
.student-name {
  font-size: 24px;
  line-height: 1.15;
}
.head-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.score-box {
  display: grid;
  grid-template-columns: auto auto;
  align-items: baseline;
  column-gap: 6px;
  min-width: 120px;
  padding: 8px 14px;
  border: 2px solid var(--ink);
  border-radius: 8px;
  background: var(--surface);
}
.score-box .big {
  font-size: 30px;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.score-box .out {
  font-size: 16px;
  color: var(--ink-2);
}
.score-box .state {
  grid-column: 1 / -1;
  font-size: 12px;
  color: var(--ink-3);
}
.score-box.empty,
.score-box.partial {
  border-color: var(--rule-strong);
}

/* Competences */
.row-group {
  display: grid;
  grid-template-columns: 74px minmax(0, 1fr);
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--surface);
  margin-bottom: 10px;
  overflow: hidden;
}
.lvl-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 10px 4px;
  background: var(--accent-soft);
  border-right: 1px solid var(--rule);
}
.lvl {
  font-size: 20px;
  font-weight: 800;
  color: var(--accent-ink);
}
.cat {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 104px;
  gap: 16px;
  align-items: center;
  padding: 10px 14px 10px 12px;
  border-left: 4px solid transparent;
  cursor: default;
}
.cat + .cat {
  border-top: 1px solid var(--rule);
}
.cat.focused {
  border-left-color: var(--accent);
  background: color-mix(in srgb, var(--accent-soft) 45%, white);
}
.cat-text strong {
  display: block;
  font-size: 15px;
}
.desc {
  font-size: 13.5px;
  color: var(--ink-2);
  white-space: pre-line;
}
.cat-side {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}
.cat-pts {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.icon-btn.has {
  color: var(--accent);
}
.cat-comment {
  grid-column: 1 / -1;
}
.cat-comment .input {
  padding: 5px 9px;
  font-size: 14px;
}

/* Paliers */
.matrix-wrap {
  overflow-x: auto;
}
.matrix {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: var(--radius);
}
.matrix th,
.matrix td {
  border-right: 1px solid var(--rule);
  border-bottom: 1px solid var(--rule);
  vertical-align: top;
}
.matrix th:last-child,
.matrix td:last-child {
  border-right: 0;
}
.matrix tbody tr:last-child td,
.matrix tbody tr:last-child th {
  border-bottom: 0;
}
.lvl-head {
  width: 70px;
  font-size: 12px;
  color: var(--ink-3);
  padding: 8px;
}
.group-head {
  padding: 6px 10px;
  text-align: center;
  font-size: 13px;
  color: var(--ink-2);
  background: var(--paper);
}
.crit-head {
  padding: 8px 10px;
  text-align: left;
  cursor: pointer;
  border-top: 3px solid transparent;
}
.crit-head.focused {
  border-top-color: var(--accent);
  background: var(--accent-soft);
}
.crit-title {
  font-weight: 700;
  font-size: 14px;
}
.crit-sub {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
}
.specials {
  display: flex;
  gap: 3px;
}
.sp {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid var(--rule-strong);
  border-radius: 4px;
  background: var(--surface);
  font-size: 11px;
  font-weight: 800;
  color: var(--ink-3);
  cursor: pointer;
}
.sp.on {
  background: var(--ink-2);
  border-color: var(--ink);
  color: #fff;
}
.lvl-cell-m {
  padding: 10px 8px;
  background: var(--accent-soft);
  text-align: center;
}
.lvl-cell-m .kbd {
  display: block;
  margin: 0 auto 4px;
  width: 22px;
}
.mcell {
  position: relative;
  padding: 8px 10px 22px;
  cursor: pointer;
  transition: background 0.08s ease;
}
.mcell:hover {
  background: var(--paper);
}
.mcell.focused {
  background: color-mix(in srgb, var(--accent-soft) 40%, white);
}
.mcell.selected {
  background: var(--accent);
  color: #fff;
}
.mcell.selected .desc,
.mcell.selected .mpts {
  color: #fff;
}
.mcell.muted {
  opacity: 0.45;
}
.mcell .desc {
  font-size: 13px;
}
.mpts {
  position: absolute;
  right: 8px;
  bottom: 4px;
  font-size: 12px;
  font-weight: 700;
  color: var(--ink-2);
}
.crit-status {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.m-comments {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.student-comment {
  margin-top: 16px;
}

.keys {
  position: sticky;
  bottom: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 20px;
  margin-top: 18px;
  padding: 10px 0;
  background: var(--paper);
  border-top: 1px solid var(--rule);
  font-size: 13px;
  color: var(--ink-2);
}
</style>
