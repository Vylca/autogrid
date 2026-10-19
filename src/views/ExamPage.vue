<script setup>
import { computed } from 'vue';
import { store, navigate, findExam, findClass } from '../lib/store.js';
import { t } from '../lib/i18n.js';
import Icon from '../components/Icon.vue';
import GradingPane from './GradingPane.vue';
import ExportPane from './ExportPane.vue';
import GridEditor from './GridEditor.vue';

const exam = computed(() => findExam(store.route.id));
const cls = computed(() => (exam.value ? findClass(exam.value.classId) : null));
const tab = computed(() => store.route.tab || 'grading');

function setTab(name) {
  store.route = { ...store.route, tab: name };
}

function remove() {
  if (!window.confirm(t('exam.confirmDelete', { name: exam.value.name }))) return;
  const i = store.data.exams.findIndex((e) => e.id === exam.value.id);
  store.data.exams.splice(i, 1);
  navigate('exams');
}
</script>

<template>
  <div v-if="exam" class="page wide exam-page">
    <button class="back" @click="navigate('exams')"><Icon name="back" :size="16" /> {{ t('nav.exams') }}</button>
    <div class="page-head">
      <div class="grow">
        <input v-model="exam.name" class="input title-input" :placeholder="t('common.untitled')" />
        <div class="exam-meta">
          <label class="field inline">
            <span>{{ t('exams.class') }}</span>
            <select v-model="exam.classId" class="input">
              <option v-for="c in store.data.classes" :key="c.id" :value="c.id">{{ c.name }}</option>
              <option v-if="!cls" :value="exam.classId" disabled>{{ t('exams.noClass') }}</option>
            </select>
          </label>
          <label class="field inline">
            <span>{{ t('exams.date') }}</span>
            <input v-model="exam.date" type="date" class="input" />
          </label>
        </div>
      </div>
      <button class="btn danger small" @click="remove"><Icon name="trash" :size="16" /> {{ t('common.delete') }}</button>
    </div>

    <div class="tabs" role="tablist">
      <button :class="{ on: tab === 'grading' }" @click="setTab('grading')"><Icon name="check" :size="16" /> {{ t('exam.tabGrading') }}</button>
      <button :class="{ on: tab === 'grid' }" @click="setTab('grid')"><Icon name="grid" :size="16" /> {{ t('exam.tabGrid') }}</button>
      <button :class="{ on: tab === 'export' }" @click="setTab('export')"><Icon name="print" :size="16" /> {{ t('exam.tabExport') }}</button>
    </div>

    <template v-if="!cls">
      <div class="empty">
        <p>{{ t('exam.classMissing') }}</p>
      </div>
    </template>
    <GradingPane v-else-if="tab === 'grading'" :exam="exam" :cls="cls" />
    <ExportPane v-else-if="tab === 'export'" :exam="exam" :cls="cls" />
    <div v-else-if="tab === 'grid'">
      <div class="notice"><Icon name="file" /> {{ t('exam.gridCopyNotice') }}</div>
      <GridEditor :grid="exam.grid" />
    </div>
  </div>
  <div v-else class="page">
    <div class="empty">{{ t('exam.notFound') }}</div>
  </div>
</template>

<style scoped>
.page-head .grow {
  flex: 1;
  min-width: 0;
}
.exam-meta {
  display: flex;
  gap: 16px;
  margin-top: 8px;
}
.field.inline {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}
.field.inline .input {
  width: auto;
  padding: 4px 8px;
}
.page-head {
  margin-bottom: 14px;
}
</style>
