<script setup>
import { computed, ref } from 'vue';
import { store, navigate, findClass, findGrid } from '../lib/store.js';
import { t, lang, formatDate } from '../lib/i18n.js';
import { newExam } from '../lib/model.js';
import { scoreStudent, classAverage, formatNumber } from '../lib/scoring.js';
import Icon from '../components/Icon.vue';
import Modal from '../components/Modal.vue';

const exams = computed(() =>
  [...store.data.exams].sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt.localeCompare(a.createdAt)),
);
const canCreate = computed(() => store.data.grids.length > 0 && store.data.classes.length > 0);

function stats(exam) {
  const cls = findClass(exam.classId);
  const ids = cls ? cls.students.map((s) => s.id) : [];
  let done = 0;
  for (const id of ids) {
    const s = scoreStudent(exam.grid, exam.results[id]);
    if (s.status === 'complete' || s.status === 'absent' || s.status === 'exempt') done++;
  }
  const avg = classAverage(exam.grid, exam.results, ids);
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

    <div v-else class="list">
      <div v-for="exam in exams" :key="exam.id" class="list-item clickable" @click="navigate('exam', exam.id, { tab: 'grading' })">
        <div class="grow">
          <div class="title">{{ exam.name || t('common.untitled') }}</div>
          <div class="meta">
            <span>{{ stats(exam).cls?.name || t('exams.noClass') }}</span>
            <span>{{ formatDate(exam.date) }}</span>
            <span>{{ exam.grid.name || t('common.untitled') }}</span>
          </div>
        </div>
        <div class="exam-progress">
          <div class="progress"><span :style="{ width: (stats(exam).total ? (100 * stats(exam).done) / stats(exam).total : 0) + '%' }"></span></div>
          <span class="hint">{{ t('exams.graded', { n: stats(exam).done, total: stats(exam).total }) }}</span>
        </div>
        <div class="exam-avg">
          <template v-if="stats(exam).avg !== null">
            <strong>{{ formatNumber(stats(exam).avg, lang, 1) }}</strong>
            <span class="hint out">/ {{ formatNumber(exam.grid.maxScore, lang) }}</span>
          </template>
        </div>
        <Icon name="right" class="chev" />
      </div>
    </div>

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
