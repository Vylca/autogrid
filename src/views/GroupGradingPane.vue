<script setup>
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { store } from '../lib/store.js';
import { t, lang } from '../lib/i18n.js';
import { emptyResult, acqLevel } from '../lib/model.js';
import { scaleInfo, usesRoles, hasRoles } from '../lib/bareme.js';
import { itemScore, formatNumber, studentAcquisition } from '../lib/scoring.js';
import AcqBadge from '../components/AcqBadge.vue';
import { groupMembers, roleMap, examScore, examAverage, rolesOf } from '../lib/groups.js';
import Icon from '../components/Icon.vue';
import Adjustments from '../components/Adjustments.vue';
import AcqPicker from '../components/AcqPicker.vue';

const props = defineProps({ exam: Object, cls: Object });
const emit = defineEmits(['groups']);

const grid = computed(() => props.exam.grid);
const info = computed(() => scaleInfo(grid.value));
const byId = computed(() => Object.fromEntries(props.cls.students.map((s) => [s.id, s])));
const roleById = computed(() => Object.fromEntries(rolesOf(grid.value).map((r) => [r.id, r])));
const groups = computed(() =>
  (props.exam.groups || [])
    .map((g, i) => ({ group: g, index: i, members: groupMembers(grid.value, g).filter((m) => byId.value[m.studentId]) }))
    .filter((g) => g.members.length),
);
const map = computed(() => roleMap(props.exam));
const scores = computed(() => {
  const out = {};
  for (const g of groups.value) for (const m of g.members) out[m.studentId] = examScore(props.exam, m.studentId, map.value);
  return out;
});
const acqs = computed(() => {
  const out = {};
  for (const g of groups.value) {
    for (const m of g.members) out[m.studentId] = studentAcquisition(grid.value, props.exam.results[m.studentId], m.role.id);
  }
  return out;
});
const average = computed(() => examAverage(props.exam, Object.keys(map.value)));

// The card takes the colour of the student's average acquisition.
function cardColor(id) {
  const lvl = acqLevel(acqs.value[id]?.overall?.code);
  return lvl ? { '--acq': lvl.color } : null;
}

const currentId = ref(groups.value.find((g) => g.group.id === store.route.groupId)?.group.id || groups.value[0]?.group.id || null);
const current = computed(() => groups.value.find((g) => g.group.id === currentId.value) || groups.value[0] || null);
const currentPos = computed(() => groups.value.indexOf(current.value));
const members = computed(() => current.value?.members || []);

const visible = computed({
  get: () => Math.max(1, Math.min(4, props.exam.sheetsVisible || Math.min(3, members.value.length || 1))),
  set: (v) => (props.exam.sheetsVisible = v),
});
const offset = ref(0);
const shown = computed(() => members.value.slice(offset.value, offset.value + visible.value));
const focusSheet = ref(0);
const focusRow = ref(0);
const openComments = ref({});

watch(currentId, (id) => {
  store.route = { ...store.route, groupId: id };
  offset.value = 0;
  focusSheet.value = 0;
  focusRow.value = firstUngraded(0);
});
watch(visible, () => {
  offset.value = Math.max(0, Math.min(offset.value, members.value.length - visible.value));
  keepVisible();
});

const withRoles = computed(() => usesRoles(grid.value));
const roleLabels = computed(() => hasRoles(grid.value));
// Without roles every member has the whole grid.
const allRows = computed(() => grid.value.categories.flatMap((c) => c.rows));
// Category name shown above the first row of each category (no roles, several categories).
const catStarts = computed(() => {
  const out = {};
  if (withRoles.value || !grid.value.useCategories) return out;
  for (const c of grid.value.categories) if (c.rows[0]) out[c.rows[0].id] = { id: c.id, name: c.name || t('common.untitled') };
  return out;
});

function rowsOf(m) {
  return withRoles.value ? roleById.value[m.role.id]?.rows || [] : allRows.value;
}

function resultOf(id) {
  return props.exam.results[id] || null;
}

function ensureResult(id) {
  if (!props.exam.results[id]) props.exam.results[id] = emptyResult();
  return props.exam.results[id];
}

function firstUngraded(sheet) {
  const m = members.value[sheet];
  if (!m) return 0;
  const marks = resultOf(m.studentId)?.marks || {};
  const i = rowsOf(m).findIndex((r) => !marks[r.id]);
  return i === -1 ? 0 : i;
}

function keepVisible() {
  if (focusSheet.value < offset.value) offset.value = focusSheet.value;
  if (focusSheet.value >= offset.value + visible.value) offset.value = focusSheet.value - visible.value + 1;
}

function focusOn(sheet, row) {
  focusSheet.value = sheet;
  focusRow.value = row;
  keepVisible();
  nextTick(() => {
    const el = document.querySelector('.gsheet [data-focused="true"]');
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

function setMark(sheet, row, code, fromClick = false) {
  const m = members.value[sheet];
  if (!m) return;
  const r = ensureResult(m.studentId);
  const rowId = rowsOf(m)[row]?.id;
  if (!rowId) return;
  if (fromClick && r.marks[rowId] === code) {
    delete r.marks[rowId];
    return;
  }
  r.marks[rowId] = code;
  focusOn(sheet, Math.min(row + 1, rowsOf(m).length - 1));
}

function clearMark() {
  const m = members.value[focusSheet.value];
  const rowId = m && rowsOf(m)[focusRow.value]?.id;
  if (rowId && resultOf(m.studentId)) delete resultOf(m.studentId).marks[rowId];
}

function toggleAbsent(m) {
  const r = ensureResult(m.studentId);
  const rows = rowsOf(m);
  const all = rows.length > 0 && rows.every((row) => r.marks[row.id] === 'A');
  for (const row of rows) {
    if (all) delete r.marks[row.id];
    else r.marks[row.id] = 'A';
  }
}

function moveGroup(d) {
  const i = currentPos.value + d;
  if (i >= 0 && i < groups.value.length) currentId.value = groups.value[i].group.id;
}

function moveSheet(d) {
  const i = focusSheet.value + d;
  if (i >= 0 && i < members.value.length) focusOn(i, firstUngraded(i));
  else if (i >= members.value.length) moveGroup(1);
  else moveGroup(-1);
}

function moveRow(d) {
  const m = members.value[focusSheet.value];
  if (!m) return;
  focusOn(focusSheet.value, Math.max(0, Math.min(rowsOf(m).length - 1, focusRow.value + d)));
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
  if (/^[1-6]$/.test(k)) setMark(focusSheet.value, focusRow.value, k);
  else if (/^[adr]$/i.test(k)) setMark(focusSheet.value, focusRow.value, k.toUpperCase());
  else if (k === 'ArrowDown') moveRow(1);
  else if (k === 'ArrowUp') moveRow(-1);
  else if (k === 'ArrowRight') moveSheet(1);
  else if (k === 'ArrowLeft') moveSheet(-1);
  else if (k === 'PageDown') moveGroup(1);
  else if (k === 'PageUp') moveGroup(-1);
  else if (k === 'Backspace' || k === 'Delete') clearMark();
  else return;
  e.preventDefault();
}

onMounted(() => {
  window.addEventListener('keydown', onKey);
  focusRow.value = firstUngraded(0);
});
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));

function scoreText(s) {
  if (!s) return '';
  if (s.status === 'absent') return t('grading.absShort');
  if (s.status === 'exempt') return t('grading.exemptShort');
  if (s.score === null) return '';
  return formatNumber(s.score, lang.value);
}

function rowPoints(m, row) {
  const max = info.value.rowMax[row.id] || 0;
  const mark = resultOf(m.studentId)?.marks?.[row.id];
  const s = itemScore(grid.value, { id: row.id, max }, mark, info.value);
  const mx = formatNumber(max, lang.value);
  if (s.ungraded) return `– / ${mx}`;
  if (s.excluded) return t('grading.excluded');
  return `${formatNumber(s.earned, lang.value)} / ${mx}`;
}

function memberStatus(id) {
  return scores.value[id]?.status || 'empty';
}

function setComment(id, value) {
  ensureResult(id).comment = value;
}

function setRowComment(id, rowId, value) {
  const r = ensureResult(id);
  if (!r.comments) r.comments = {};
  if (value) r.comments[rowId] = value;
  else delete r.comments[rowId];
}

</script>

<template>
  <div v-if="!groups.length" class="empty">
    <h2>{{ t('groups.noneTitle') }}</h2>
    <p>{{ t('groups.noneText') }}</p>
    <div class="actions">
      <button class="btn primary" @click="emit('groups')"><Icon name="users" /> {{ t('exam.tabGroups') }}</button>
    </div>
  </div>
  <div v-else class="gg">
    <aside class="roster only-wide">
      <div class="roster-list">
        <button v-for="g in groups" :key="g.group.id" class="g-item" :class="{ on: g.group.id === current?.group.id }" @click="currentId = g.group.id">
          <span class="g-name">{{ t('groups.name', { n: g.index + 1 }) }}</span>
          <span v-for="m in g.members" :key="m.studentId" class="g-member">
            <span class="status" :class="'st-' + memberStatus(m.studentId)"></span>
            <span class="g-mname">{{ byId[m.studentId].lastName }} {{ byId[m.studentId].firstName }}</span>
            <span class="g-score">{{ scoreText(scores[m.studentId]) }}</span>
          </span>
        </button>
      </div>
      <div class="roster-foot">
        <span>{{ t('grading.average') }}</span>
        <strong v-if="average !== null">{{ formatNumber(average, lang, 2) }} / {{ formatNumber(info.target, lang) }}</strong>
        <span v-else class="hint">–</span>
      </div>
    </aside>

    <section v-if="current" class="gsheets">
      <header class="gs-head">
        <div class="who">
          <div class="g-title">{{ t('groups.name', { n: current.index + 1 }) }}</div>
          <div class="hint">{{ t('groups.position', { n: currentPos + 1, total: groups.length }) }}</div>
          <select v-model="currentId" class="input only-narrow group-select" :aria-label="t('exam.tabGroups')">
            <option v-for="g in groups" :key="g.group.id" :value="g.group.id">{{ t('groups.name', { n: g.index + 1 }) }}</option>
          </select>
        </div>
        <div class="head-actions">
          <button class="icon-btn" :disabled="currentPos <= 0" :title="t('groups.prev')" @click="moveGroup(-1)"><Icon name="left" /></button>
          <button class="icon-btn" :disabled="currentPos >= groups.length - 1" :title="t('groups.next')" @click="moveGroup(1)"><Icon name="right" /></button>
          <span class="label">{{ t('groups.visible') }}</span>
          <div class="segmented">
            <button v-for="n in 4" :key="n" :class="{ on: visible === n }" @click="visible = n">{{ n }}</button>
          </div>
        </div>
      </header>

      <div class="sheets-wrap">
        <button v-if="offset > 0" class="pager left" :title="t('groups.prevSheets')" @click="offset--"><Icon name="left" /></button>
        <div class="sheets" :style="{ '--cols': Math.min(visible, members.length) }">
          <article
            v-for="(m, i) in shown"
            :key="m.studentId"
            class="gsheet"
            :class="{ focused: offset + i === focusSheet, 'has-acq': !!cardColor(m.studentId) }"
            :style="cardColor(m.studentId)"
            @click="focusSheet = offset + i"
          >
            <header class="gsheet-head">
              <div class="gs-who">
                <div class="gs-name"><strong>{{ byId[m.studentId].lastName }}</strong> {{ byId[m.studentId].firstName }}</div>
                <div class="gs-tags">
                  <span v-if="roleLabels" class="role-tag">{{ m.role.name || t('common.untitled') }}</span>
                  <AcqBadge compact :acq="acqs[m.studentId]?.overall" />
                </div>
              </div>
              <div class="mini-score" :class="'st-' + memberStatus(m.studentId)">
                <strong>{{ scoreText(scores[m.studentId]) || '–' }}</strong>
                <span>/ {{ formatNumber(info.target, lang) }}</span>
              </div>
            </header>
            <template v-for="(row, ri) in rowsOf(m)" :key="row.id">
            <div v-if="catStarts[row.id]" class="scat">
              <span>{{ catStarts[row.id].name }}</span>
              <AcqBadge compact :acq="acqs[m.studentId]?.byCategory[catStarts[row.id].id]" />
            </div>
            <div
              class="sline"
              :class="{ rfocus: offset + i === focusSheet && ri === focusRow }"
              :data-focused="offset + i === focusSheet && ri === focusRow"
              @click.stop="focusOn(offset + i, ri)"
            >
              <span class="lvl-badge">{{ row.level }}</span>
              <p class="desc">{{ row.descriptor || t('grading.noDescriptor') }}</p>
              <span class="line-pts">{{ rowPoints(m, row) }}</span>
              <div class="picker-cell">
                <AcqPicker compact :value="resultOf(m.studentId)?.marks?.[row.id]" @pick="(code) => { focusOn(offset + i, ri); setMark(offset + i, ri, code, true); }" />
                <button
                  v-if="grid.categoryComments"
                  class="icon-btn"
                  :class="{ has: resultOf(m.studentId)?.comments?.[row.id] }"
                  :title="t('grading.rowComment')"
                  @click.stop="openComments[m.studentId + row.id] = !openComments[m.studentId + row.id]"
                >
                  <Icon name="comment" :size="15" />
                </button>
              </div>
              <input
                v-if="grid.categoryComments && (openComments[m.studentId + row.id] || resultOf(m.studentId)?.comments?.[row.id])"
                class="input row-comment"
                :placeholder="t('grading.categoryCommentPlaceholder')"
                :value="resultOf(m.studentId)?.comments?.[row.id] || ''"
                @click.stop
                @input="setRowComment(m.studentId, row.id, $event.target.value)"
              />
            </div>
            </template>
            <footer class="gsheet-foot">
              <textarea
                class="input"
                rows="2"
                :placeholder="t('grading.commentPlaceholder')"
                :value="resultOf(m.studentId)?.comment || ''"
                @input="setComment(m.studentId, $event.target.value)"
              ></textarea>
              <button class="btn small" @click.stop="toggleAbsent(m)">{{ t('grading.markAbsent') }}</button>
            </footer>
            <Adjustments class="gsheet-adj" compact :result="resultOf(m.studentId)" :ensure="() => ensureResult(m.studentId)" :max="info.target" @click.stop />
          </article>
        </div>
        <button v-if="offset + visible < members.length" class="pager right" :title="t('groups.nextSheets')" @click="offset++"><Icon name="right" /></button>
      </div>

      <footer class="keys">
        <span><span class="kbd">1</span>…<span class="kbd">6</span> {{ t('keys.level') }}</span>
        <span><span class="kbd">A</span> <span class="kbd">D</span> <span class="kbd">R</span> {{ t('keys.special') }}</span>
        <span><span class="kbd">↑</span> <span class="kbd">↓</span> {{ t('keys.category') }}</span>
        <span><span class="kbd">←</span> <span class="kbd">→</span> {{ t('keys.sheet') }}</span>
        <span><span class="kbd">PgUp</span> <span class="kbd">PgDn</span> {{ t('keys.group') }}</span>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.gg {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}
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
.g-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: 7px 8px;
  border: 0;
  border-radius: 5px;
  background: none;
  text-align: left;
  cursor: pointer;
}
.g-item + .g-item {
  margin-top: 2px;
}
.g-item:hover {
  background: var(--paper);
}
.g-item.on {
  background: var(--accent-soft);
}
.g-name {
  font-weight: 800;
  font-size: 13px;
  color: var(--accent-ink);
}
.g-member {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
}
.g-mname {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.g-score {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--ink-2);
}
.status {
  flex: none;
  width: 9px;
  height: 9px;
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
.gsheets {
  min-width: 0;
}
.gs-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--rule);
}
.who {
  flex: 1;
  min-width: 200px;
}
.g-title {
  font-size: 22px;
  font-weight: 800;
}
.head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sheets-wrap {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 6px;
}
.group-select {
  width: auto;
  margin-top: 6px;
}
.sheets-wrap {
  container-type: inline-size;
}
.sheets {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
  gap: 12px;
}
.pager {
  position: sticky;
  top: 40%;
  flex: none;
  width: 30px;
  height: 60px;
  border: 1px solid var(--rule-strong);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--ink-2);
  cursor: pointer;
}
.pager:hover {
  border-color: var(--accent);
  color: var(--accent-ink);
}
.gsheet {
  container-type: inline-size;
  border: 1px solid var(--rule);
  border-top: 3px solid var(--rule-strong);
  border-radius: var(--radius);
  background: var(--surface);
  overflow: hidden;
}
.gsheet.focused {
  border-top-color: var(--accent);
  box-shadow: 0 2px 10px rgba(39, 71, 176, 0.12);
}
.gsheet.has-acq {
  border-color: color-mix(in srgb, var(--acq) 50%, var(--rule));
  border-top-color: var(--acq);
  background: color-mix(in srgb, var(--acq) 5%, var(--surface));
  transition: background 0.2s ease, border-color 0.2s ease;
}
.gsheet.has-acq .gsheet-head {
  background: color-mix(in srgb, var(--acq) 24%, var(--surface));
  border-bottom-color: color-mix(in srgb, var(--acq) 45%, var(--surface));
  transition: background 0.2s ease;
}
.gsheet.has-acq.focused {
  box-shadow: 0 0 0 2px var(--accent), 0 2px 10px rgba(39, 71, 176, 0.12);
}
.gsheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  background: var(--accent-soft);
  border-bottom: 1px solid var(--rule);
}
.gs-who {
  min-width: 0;
}
.gs-name {
  font-size: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.role-tag {
  display: inline-block;
  margin-top: 2px;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}
.mini-score {
  flex: none;
  display: flex;
  align-items: baseline;
  gap: 3px;
  padding: 4px 10px;
  border: 2px solid var(--rule-strong);
  border-radius: 6px;
  background: var(--surface);
  font-variant-numeric: tabular-nums;
}
.mini-score strong {
  font-size: 20px;
}
.mini-score span {
  font-size: 13px;
  color: var(--ink-2);
}
.mini-score.st-complete {
  border-color: var(--ink);
}
.gs-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  margin-top: 3px;
}
.gs-tags .role-tag {
  margin-top: 0;
}
.scat {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 12px;
  background: var(--paper);
  border-bottom: 1px solid var(--rule);
  font-size: 13px;
  font-weight: 800;
  color: var(--accent-ink);
}
.sline {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  gap: 4px 10px;
  align-items: center;
  padding: 8px 10px 8px 6px;
  border-left: 4px solid transparent;
  border-bottom: 1px solid var(--rule);
  cursor: default;
}
.sline.rfocus {
  border-left-color: var(--accent);
  background: color-mix(in srgb, var(--accent-soft) 45%, white);
}
.lvl-badge {
  justify-self: center;
  font-size: 15px;
  font-weight: 800;
  color: var(--accent-ink);
}
.desc {
  font-size: 13.5px;
  white-space: pre-line;
}
.line-pts {
  font-weight: 700;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.picker-cell {
  grid-column: 2 / -1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 6px;
}
.row-comment {
  grid-column: 2 / -1;
  padding: 4px 8px;
  font-size: 13px;
}
.icon-btn.has {
  color: var(--accent);
}
.gsheet-foot {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px;
}
.gsheet-foot textarea {
  font-size: 13.5px;
}
.gsheet-adj {
  padding: 0 10px 10px;
}
.keys {
  position: sticky;
  bottom: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  margin-top: 16px;
  padding: 10px 0;
  background: var(--paper);
  border-top: 1px solid var(--rule);
  font-size: 13px;
  color: var(--ink-2);
}
@media (max-width: 1100px) {
  .gg {
    grid-template-columns: 200px minmax(0, 1fr);
    gap: 14px;
  }
}
@media (max-width: 900px) {
  .gg {
    grid-template-columns: minmax(0, 1fr);
  }
}
/* Too narrow for the chosen number of sheets: stack them. */
@container (max-width: 560px) {
  .sheets {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
