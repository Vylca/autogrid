<script setup>
import { computed, ref } from 'vue';
import { store } from '../lib/store.js';
import { t, lang } from '../lib/i18n.js';
import { sortStudents } from '../lib/model.js';
import { formatNumber } from '../lib/scoring.js';
import { examScore, roleMap, rolesOf } from '../lib/groups.js';
import { exportExamPdf } from '../lib/exporter.js';
import Icon from '../components/Icon.vue';
import ExportOptions from '../components/ExportOptions.vue';

const props = defineProps({ exam: Object, cls: Object });

if (!store.data.settings.export) store.data.settings.export = { layout: 'perPage', color: true, orientation: 'portrait' };
const options = store.data.settings.export;

const group = computed(() => !!props.exam.grid.groupWork);
const withRoles = computed(() => !!(props.exam.grid.groupWork && props.exam.grid.useRoles));
const map = computed(() => roleMap(props.exam));
const roleNames = computed(() => Object.fromEntries(rolesOf(props.exam.grid).map((r) => [r.id, r.name])));
// Group work: only students placed in a group have a grid to print.
const students = computed(() => sortStudents(props.cls.students).filter((s) => !group.value || map.value[s.id]));
const missing = computed(() => (group.value ? props.cls.students.length - students.value.length : 0));
const selected = ref(new Set(students.value.map((s) => s.id)));

function toggle(id) {
  const s = new Set(selected.value);
  if (s.has(id)) s.delete(id);
  else s.add(id);
  selected.value = s;
}
function selectAll() {
  selected.value = new Set(students.value.map((s) => s.id));
}
function selectNone() {
  selected.value = new Set();
}

function scoreLabel(s) {
  const sc = examScore(props.exam, s.id, map.value);
  if (sc.status === 'absent') return t('grading.absShort');
  if (sc.status === 'exempt') return t('grading.exemptShort');
  if (sc.score === null) return '';
  return formatNumber(sc.score, lang.value);
}

// Relevé global: skills ticked to get their own column.
const showRows = computed(() => options.layout === 'summary' && props.exam.grid.type === 'competences');
const rowGroups = computed(() =>
  props.exam.grid.categories
    .filter((c) => c.rows.length)
    .map((c) => ({ id: c.id, name: props.exam.grid.useCategories ? c.name || t('common.untitled') : '', rows: c.rows })),
);
const tickedCount = computed(() => rowGroups.value.reduce((n, g) => n + g.rows.filter((r) => r.inSummary).length, 0));

const busy = ref(false);
async function run() {
  busy.value = true;
  try {
    await exportExamPdf(props.exam, props.cls, { ...options, studentIds: [...selected.value] });
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="export">
    <section class="panel pick">
      <div class="panel-head">
        <h3>{{ t('export.students') }}</h3>
        <span class="hint">{{ t('export.selectedCount', { n: selected.size, total: students.length }) }}</span>
      </div>
      <p v-if="missing" class="hint missing">{{ t('export.notInGroup', { n: missing }) }}</p>
      <div class="pick-actions">
        <button class="btn small" @click="selectAll">{{ t('export.all') }}</button>
        <button class="btn small" @click="selectNone">{{ t('export.none') }}</button>
      </div>
      <div class="pick-list">
        <label v-for="s in students" :key="s.id" class="checkbox pick-item">
          <input type="checkbox" :checked="selected.has(s.id)" @change="toggle(s.id)" />
          <span class="pname"><strong>{{ s.lastName }}</strong> {{ s.firstName }}<span v-if="withRoles" class="prole">{{ roleNames[map[s.id]?.roleId] }}</span></span>
          <span class="pscore">{{ scoreLabel(s) }}</span>
        </label>
      </div>
    </section>
    <section class="panel opts">
      <ExportOptions :options="options" allow-per-student allow-summary />
      <div v-if="showRows" class="sum-rows">
        <div class="sr-head">
          <h4>{{ t('export.summaryRows') }}</h4>
          <span class="hint">{{ t('export.summaryRowsCount', { n: tickedCount }) }}</span>
        </div>
        <p class="hint">{{ t('export.summaryRowsHint') }}</p>
        <div class="sr-list">
          <div v-for="g in rowGroups" :key="g.id" class="sr-group">
            <div v-if="g.name" class="sr-cat">{{ g.name }}</div>
            <label v-for="r in g.rows" :key="r.id" class="checkbox sr-item">
              <input v-model="r.inSummary" type="checkbox" />
              <span class="sr-lvl">{{ r.level }}</span>
              <span class="sr-txt" :class="{ empty: !r.descriptor }">{{ r.descriptor || t('grading.noDescriptor') }}</span>
            </label>
          </div>
        </div>
      </div>
      <div class="go">
        <button class="btn primary" :disabled="busy || selected.size === 0" @click="run">
          <Icon name="download" /> {{ busy ? t('export.working') : t('export.run') }}
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.export {
  display: grid;
  grid-template-columns: minmax(260px, 340px) minmax(0, 560px);
  gap: 20px;
  align-items: start;
}
.panel + .panel {
  margin-top: 0;
}
.pick-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
.pick-list {
  max-height: 56vh;
  overflow: auto;
  margin: 0 -8px;
}
.pick-item {
  display: flex;
  width: 100%;
  padding: 5px 8px;
  border-radius: 5px;
}
.pick-item:hover {
  background: var(--paper);
}
.pname {
  flex: 1;
  font-size: 14px;
}
.prole {
  display: block;
  font-size: 12px;
  color: var(--accent-ink);
}
.missing {
  margin-bottom: 8px;
}
.pscore {
  font-weight: 700;
  font-size: 14px;
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
}
.sum-rows {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--rule);
}
.sr-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}
.sr-head h4 {
  margin: 0;
  font-size: 15px;
}
.sr-list {
  max-height: 40vh;
  overflow: auto;
  margin: 10px -8px 0;
}
.sr-cat {
  padding: 8px 8px 2px;
  font-size: 13px;
  font-weight: 800;
  color: var(--accent-ink);
}
.sr-item {
  display: flex;
  align-items: flex-start;
  width: 100%;
  padding: 5px 8px;
  border-radius: 5px;
}
.sr-item:hover {
  background: var(--paper);
}
.sr-item input {
  flex: none;
  margin-top: 2px;
}
.sr-lvl {
  flex: none;
  min-width: 30px;
  font-weight: 800;
  font-size: 14px;
  color: var(--accent-ink);
}
.sr-txt {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.sr-txt.empty {
  color: var(--ink-3);
  font-style: italic;
}
.go {
  margin-top: 22px;
  display: flex;
  justify-content: flex-end;
}
@media (max-width: 900px) {
  .export {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
