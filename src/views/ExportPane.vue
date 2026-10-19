<script setup>
import { computed, ref } from 'vue';
import { store } from '../lib/store.js';
import { t, lang } from '../lib/i18n.js';
import { sortStudents } from '../lib/model.js';
import { scoreStudent, formatNumber } from '../lib/scoring.js';
import { exportExamPdf } from '../lib/exporter.js';
import Icon from '../components/Icon.vue';
import ExportOptions from '../components/ExportOptions.vue';

const props = defineProps({ exam: Object, cls: Object });

if (!store.data.settings.export) store.data.settings.export = { layout: 'perPage', color: true, orientation: 'portrait' };
const options = store.data.settings.export;

const students = computed(() => sortStudents(props.cls.students));
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
  const sc = scoreStudent(props.exam.grid, props.exam.results[s.id]);
  if (sc.status === 'absent') return t('grading.absShort');
  if (sc.status === 'exempt') return t('grading.exemptShort');
  if (sc.score === null) return '';
  return formatNumber(sc.score, lang.value);
}

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
      <div class="pick-actions">
        <button class="btn small" @click="selectAll">{{ t('export.all') }}</button>
        <button class="btn small" @click="selectNone">{{ t('export.none') }}</button>
      </div>
      <div class="pick-list">
        <label v-for="s in students" :key="s.id" class="checkbox pick-item">
          <input type="checkbox" :checked="selected.has(s.id)" @change="toggle(s.id)" />
          <span class="pname"><strong>{{ s.lastName }}</strong> {{ s.firstName }}</span>
          <span class="pscore">{{ scoreLabel(s) }}</span>
        </label>
      </div>
    </section>
    <section class="panel opts">
      <ExportOptions :options="options" allow-per-student />
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
.pscore {
  font-weight: 700;
  font-size: 14px;
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
}
.go {
  margin-top: 22px;
  display: flex;
  justify-content: flex-end;
}
</style>
