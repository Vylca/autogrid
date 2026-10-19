<script setup>
import { computed, ref } from 'vue';
import { store, navigate, findClass } from '../lib/store.js';
import { t } from '../lib/i18n.js';
import { newStudent, sortStudents } from '../lib/model.js';
import { pickCsv } from '../lib/importCsv.js';
import Icon from '../components/Icon.vue';
import CsvImportDialog from '../components/CsvImportDialog.vue';

const cls = computed(() => findClass(store.route.id));
const students = computed(() => (cls.value ? sortStudents(cls.value.students) : []));
const exams = computed(() => store.data.exams.filter((e) => e.classId === cls.value?.id));

const draft = ref({ lastName: '', firstName: '' });
function addStudent() {
  const { lastName, firstName } = draft.value;
  if (!lastName.trim() && !firstName.trim()) return;
  cls.value.students.push(newStudent(lastName.trim(), firstName.trim()));
  draft.value = { lastName: '', firstName: '' };
}

function removeStudent(s) {
  if (!window.confirm(t('classes.confirmDeleteStudent', { name: `${s.lastName} ${s.firstName}` }))) return;
  const i = cls.value.students.findIndex((x) => x.id === s.id);
  cls.value.students.splice(i, 1);
}

function removeClass() {
  if (exams.value.length) {
    window.alert(t('classes.cannotDelete', { n: exams.value.length }));
    return;
  }
  if (!window.confirm(t('classes.confirmDelete', { name: cls.value.name }))) return;
  const i = store.data.classes.findIndex((c) => c.id === cls.value.id);
  store.data.classes.splice(i, 1);
  navigate('classes');
}

const parsed = ref(null);
async function importCsv() {
  parsed.value = await pickCsv();
}
</script>

<template>
  <div v-if="cls" class="page">
    <button class="back" @click="navigate('classes')"><Icon name="back" :size="16" /> {{ t('nav.classes') }}</button>
    <div class="page-head">
      <div class="grow">
        <input v-model="cls.name" class="input title-input" :placeholder="t('classes.namePlaceholder')" />
        <p class="sub">{{ t('classes.nStudents', { n: cls.students.length }) }}</p>
      </div>
      <div class="row-actions">
        <button class="btn" @click="importCsv"><Icon name="upload" /> {{ t('classes.importHere') }}</button>
        <button class="btn danger" @click="removeClass"><Icon name="trash" /> {{ t('common.delete') }}</button>
      </div>
    </div>

    <table class="students">
      <thead>
        <tr>
          <th class="num">#</th>
          <th>{{ t('classes.lastName') }}</th>
          <th>{{ t('classes.firstName') }}</th>
          <th class="act"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(s, i) in students" :key="s.id">
          <td class="num">{{ i + 1 }}</td>
          <td><input v-model="s.lastName" class="input cell last" /></td>
          <td><input v-model="s.firstName" class="input cell" /></td>
          <td class="act">
            <button class="icon-btn danger" :title="t('common.delete')" @click="removeStudent(s)"><Icon name="trash" :size="16" /></button>
          </td>
        </tr>
        <tr class="add">
          <td class="num"><Icon name="plus" :size="16" /></td>
          <td><input v-model="draft.lastName" class="input cell last" :placeholder="t('classes.lastName')" @keydown.enter="addStudent" /></td>
          <td><input v-model="draft.firstName" class="input cell" :placeholder="t('classes.firstName')" @keydown.enter="addStudent" /></td>
          <td class="act">
            <button class="btn small" @click="addStudent">{{ t('classes.addStudent') }}</button>
          </td>
        </tr>
      </tbody>
    </table>

    <CsvImportDialog v-if="parsed" :parsed="parsed" :target-class-id="cls.id" @close="parsed = null" />
  </div>
  <div v-else class="page"><div class="empty">{{ t('classes.notFound') }}</div></div>
</template>

<style scoped>
.grow {
  flex: 1;
}
.students {
  width: 100%;
  max-width: 760px;
  border-collapse: collapse;
}
.students th {
  padding: 6px 8px;
  text-align: left;
  font-size: 13px;
  color: var(--ink-3);
  border-bottom: 1px solid var(--rule);
}
.students td {
  padding: 3px 4px;
  border-bottom: 1px solid var(--rule);
}
.num {
  width: 40px;
  text-align: right;
  color: var(--ink-3);
  font-variant-numeric: tabular-nums;
  padding-right: 10px !important;
}
.act {
  width: 120px;
  text-align: right;
}
.input.cell {
  border-color: transparent;
  background: transparent;
  padding: 5px 8px;
}
.input.cell:hover {
  border-color: var(--rule);
}
.input.cell:focus {
  background: var(--surface);
}
.input.cell.last {
  font-weight: 700;
}
tr.add td {
  border-bottom: 0;
  padding-top: 8px;
}
tr.add .input.cell {
  border-color: var(--rule-strong);
  background: var(--surface);
  font-weight: 400;
}
</style>
