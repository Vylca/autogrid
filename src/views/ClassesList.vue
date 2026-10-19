<script setup>
import { computed, ref } from 'vue';
import { store, navigate } from '../lib/store.js';
import { t } from '../lib/i18n.js';
import { newClass } from '../lib/model.js';
import { pickCsv } from '../lib/importCsv.js';
import Icon from '../components/Icon.vue';
import Modal from '../components/Modal.vue';
import CsvImportDialog from '../components/CsvImportDialog.vue';

const classes = computed(() => [...store.data.classes].sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true })));
const examCount = (c) => store.data.exams.filter((e) => e.classId === c.id).length;

const parsed = ref(null);
async function importCsv() {
  parsed.value = await pickCsv();
}

const showNew = ref(false);
const name = ref('');
function create() {
  if (!name.value.trim()) return;
  const c = newClass(name.value.trim());
  store.data.classes.push(c);
  showNew.value = false;
  navigate('class', c.id);
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>{{ t('classes.title') }}</h1>
        <p class="sub">{{ t('classes.subtitle') }}</p>
      </div>
      <div class="row-actions">
        <button class="btn" @click="name = ''; showNew = true"><Icon name="plus" /> {{ t('classes.new') }}</button>
        <button class="btn primary" @click="importCsv"><Icon name="upload" /> {{ t('classes.import') }}</button>
      </div>
    </div>

    <div v-if="!classes.length" class="empty">
      <h2>{{ t('classes.emptyTitle') }}</h2>
      <p>{{ t('classes.emptyText') }}</p>
      <div class="actions">
        <button class="btn primary" @click="importCsv"><Icon name="upload" /> {{ t('classes.import') }}</button>
      </div>
    </div>

    <div v-else class="list">
      <div v-for="c in classes" :key="c.id" class="list-item clickable" @click="navigate('class', c.id)">
        <div class="grow">
          <div class="title">{{ c.name }}</div>
          <div class="meta">
            <span>{{ t('classes.nStudents', { n: c.students.length }) }}</span>
            <span>{{ t('classes.nExams', { n: examCount(c) }) }}</span>
          </div>
        </div>
        <Icon name="right" />
      </div>
    </div>

    <CsvImportDialog v-if="parsed" :parsed="parsed" @close="parsed = null" />

    <Modal v-if="showNew" :title="t('classes.new')" @close="showNew = false">
      <label class="field">
        <span>{{ t('classes.name') }}</span>
        <input v-model="name" class="input" :placeholder="t('classes.namePlaceholder')" autofocus @keydown.enter="create" />
      </label>
      <template #footer>
        <button class="btn" @click="showNew = false">{{ t('common.cancel') }}</button>
        <button class="btn primary" :disabled="!name.trim()" @click="create">{{ t('classes.create') }}</button>
      </template>
    </Modal>
  </div>
</template>
