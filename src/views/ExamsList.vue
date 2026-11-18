<script setup>
import { computed, ref } from 'vue';
import { store, navigate, findClass, findGrid } from '../lib/store.js';
import { t, lang, formatDate } from '../lib/i18n.js';
import { newExam } from '../lib/model.js';
import { formatNumber } from '../lib/scoring.js';
import { examScore, examAverage, roleMap } from '../lib/groups.js';
import { scaleInfo } from '../lib/bareme.js';
import { GROUP_BY, groupExams, examThemes } from '../lib/organize.js';
import Icon from '../components/Icon.vue';
import Modal from '../components/Modal.vue';

const exams = computed(() =>
  [...store.data.exams].sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt.localeCompare(a.createdAt)),
);
const canCreate = computed(() => store.data.grids.length > 0 && store.data.classes.length > 0);

// Organized by date (one list), class, level, grid or theme.
const groupBy = computed({
  get: () => (GROUP_BY.includes(store.data.settings.examsGroupBy) ? store.data.settings.examsGroupBy : 'date'),
  set: (v) => (store.data.settings.examsGroupBy = v),
});
const groups = computed(() =>
  groupExams(exams.value, groupBy.value, {
    classes: store.data.classes,
    grids: store.data.grids,
    labels: { noClass: t('exams.noClass'), noLevel: t('exams.noLevel'), noTheme: t('exams.noTheme'), untitled: t('common.untitled') },
  }),
);
const themesOf = (exam) => examThemes(exam, store.data.grids);

function stats(exam) {
  const cls = findClass(exam.classId);
  const map = exam.grid.groupWork ? roleMap(exam) : null;
  // Group work: only students placed in a group are graded.
  const ids = cls ? cls.students.map((s) => s.id).filter((id) => !map || map[id]) : [];
  let done = 0;
  for (const id of ids) {
    const s = examScore(exam, id, map);
    if (s.status === 'complete' || s.status === 'offtopic' || s.status === 'absent' || s.status === 'exempt') done++;
  }
  const avg = examAverage(exam, ids);
  return { total: ids.length, done, avg, cls };
}

const showNew = ref(false);
const form = ref({ name: '', date: '', classId: '', gridId: '' });

function openNew() {
  form.value = {
    name: '',
    date: new Date().toISOString().slice(0, 10),
    classId: store.data.classes[0]?.id || '',
    gridId: store.data.grids[0]?.id || '',
  };
  showNew.value = true;
}

const formValid = computed(() => form.value.name.trim() && form.value.classId && form.value.gridId);

function create() {
  if (!formValid.value) return;
  const grid = findGrid(form.value.gridId);
  const exam = newExam({ name: form.value.name.trim(), date: form.value.date, classId: form.value.classId, grid });
  store.data.exams.push(exam);
  showNew.value = false;
  navigate('exam', exam.id, { tab: 'grading' });
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>{{ t('exams.title') }}</h1>
        <p class="sub">{{ t('exams.subtitle') }}</p>
      </div>
      <button class="btn primary" :disabled="!canCreate" @click="openNew"><Icon name="plus" /> {{ t('exams.new') }}</button>
    </div>

    <div v-if="!canCreate" class="empty">
      <h2>{{ t('exams.setupTitle') }}</h2>
      <p>{{ t('exams.setupText') }}</p>
      <div class="actions">
        <button class="btn" :class="{ primary: !store.data.grids.length }" @click="navigate('grids')">
          <Icon :name="store.data.grids.length ? 'check' : 'grid'" /> {{ t('exams.setupGrid') }}
        </button>
        <button class="btn" :class="{ primary: store.data.grids.length && !store.data.classes.length }" @click="navigate('classes')">
          <Icon :name="store.data.classes.length ? 'check' : 'users'" /> {{ t('exams.setupClass') }}
        </button>
      </div>
    </div>

    <div v-else-if="!exams.length" class="empty">
      <h2>{{ t('exams.emptyTitle') }}</h2>
      <p>{{ t('exams.emptyText') }}</p>
      <div class="actions">
        <button class="btn primary" @click="openNew"><Icon name="plus" /> {{ t('exams.new') }}</button>
      </div>
    </div>

    <template v-else>
    <div class="organize">
      <span class="org-label">{{ t('exams.groupBy') }}</span>
      <div class="segmented">
        <button v-for="b in GROUP_BY" :key="b" :class="{ on: groupBy === b }" @click="groupBy = b">{{ t('exams.by.' + b) }}</button>
      </div>
    </div>
    <section v-for="g in groups" :key="g.key" class="exam-group">
      <h2 v-if="groupBy !== 'date'" class="group-head" :class="{ none: g.none }">
        <Icon v-if="groupBy === 'theme' && !g.none" name="tag" :size="17" />
        {{ g.label }}
        <span class="hint">{{ t('exams.count', { n: g.exams.length }) }}</span>
      </h2>
    <div class="list">
      <div v-for="exam in g.exams" :key="exam.id" class="list-item clickable" @click="navigate('exam', exam.id, { tab: 'grading' })">
        <div class="grow">
          <div class="title">{{ exam.name || t('common.untitled') }}</div>
          <div class="meta">
            <span>{{ stats(exam).cls?.name || t('exams.noClass') }}</span>
            <span>{{ formatDate(exam.date) }}</span>
            <span>{{ exam.grid.name || t('common.untitled') }}</span>
            <span v-for="th in themesOf(exam)" :key="th" class="tag theme"><Icon name="tag" :size="12" /> {{ th }}</span>
          </div>
        </div>
        <div class="exam-progress">
          <div class="progress"><span :style="{ width: (stats(exam).total ? (100 * stats(exam).done) / stats(exam).total : 0) + '%' }"></span></div>
          <span class="hint">{{ t('exams.graded', { n: stats(exam).done, total: stats(exam).total }) }}</span>
        </div>
        <div class="exam-avg">
          <template v-if="stats(exam).avg !== null">
            <strong>{{ formatNumber(stats(exam).avg, lang, 1) }}</strong>
            <span class="hint out">/ {{ formatNumber(scaleInfo(exam.grid).target, lang) }}</span>
          </template>
        </div>
        <Icon name="right" class="chev" />
      </div>
    </div>
    </section>
    </template>

    <Modal v-if="showNew" :title="t('exams.new')" @close="showNew = false">
      <label class="field">
        <span>{{ t('exams.name') }}</span>
        <input v-model="form.name" class="input" :placeholder="t('exams.namePlaceholder')" autofocus @keydown.enter="create" />
      </label>
      <div class="form-grid">
        <label class="field">
          <span>{{ t('exams.class') }}</span>
          <select v-model="form.classId" class="input">
            <option v-for="c in store.data.classes" :key="c.id" :value="c.id">{{ c.name }} ({{ c.students.length }})</option>
          </select>
        </label>
        <label class="field">
          <span>{{ t('exams.date') }}</span>
          <input v-model="form.date" type="date" class="input" />
        </label>
      </div>
      <label class="field">
        <span>{{ t('exams.grid') }}</span>
        <select v-model="form.gridId" class="input">
          <option v-for="g in store.data.grids" :key="g.id" :value="g.id">{{ g.name || t('common.untitled') }}</option>
        </select>
        <span class="hint">{{ t('exams.gridCopyHint') }}</span>
      </label>
      <template #footer>
        <button class="btn" @click="showNew = false">{{ t('common.cancel') }}</button>
        <button class="btn primary" :disabled="!formValid" @click="create">{{ t('exams.create') }}</button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.organize {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin-bottom: 18px;
}
.org-label {
  font-size: 14px;
  font-weight: 700;
  color: var(--ink-2);
}
.exam-group + .exam-group {
  margin-top: 26px;
}
.group-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 10px;
  font-size: 19px;
}
.group-head .hint {
  font-size: 14px;
  font-weight: 600;
}
.group-head.none {
  color: var(--ink-2);
}
.tag.theme {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-color: var(--accent-soft);
  background: var(--accent-soft);
  color: var(--accent-ink);
}
.exam-progress {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  width: 140px;
}
.exam-avg {
  width: 84px;
  text-align: right;
  font-size: 18px;
  font-variant-numeric: tabular-nums;
}
.exam-avg .out {
  margin-left: 3px;
}
.chev {
  color: var(--ink-3);
}
</style>
