<script setup>
import { computed, ref } from 'vue';
import { store, navigate, toast } from '../lib/store.js';
import { t } from '../lib/i18n.js';
import { newClass, newStudent, sortStudents } from '../lib/model.js';
import { sameStudent } from '../lib/csv.js';
import Modal from './Modal.vue';

// parsed: { fileName, students: [{lastName, firstName}], className }
const props = defineProps({ parsed: Object, targetClassId: String });
const emit = defineEmits(['close']);

const target = ref(props.targetClassId || 'new');
const name = ref(props.parsed.className || props.parsed.fileName.replace(/\.[^.]+$/, ''));

const existing = computed(() => store.data.classes.find((c) => c.id === target.value) || null);
const preview = computed(() => sortStudents(props.parsed.students.map((s, i) => ({ ...s, id: String(i) }))));
const duplicates = computed(() => {
  if (!existing.value) return 0;
  return props.parsed.students.filter((s) => existing.value.students.some((e) => sameStudent(e, s))).length;
});
const valid = computed(() => (target.value === 'new' ? name.value.trim() : true) && props.parsed.students.length);

function confirm() {
  if (!valid.value) return;
  if (target.value === 'new') {
    const cls = newClass(name.value.trim(), props.parsed.students.map((s) => newStudent(s.lastName, s.firstName)));
    store.data.classes.push(cls);
    toast(t('classes.imported', { n: cls.students.length, name: cls.name }));
    emit('close');
    navigate('class', cls.id);
  } else {
    let added = 0;
    for (const s of props.parsed.students) {
      if (existing.value.students.some((e) => sameStudent(e, s))) continue;
      existing.value.students.push(newStudent(s.lastName, s.firstName));
      added++;
    }
    toast(t('classes.merged', { n: added, name: existing.value.name }));
    emit('close');
  }
}
</script>

<template>
  <Modal :title="t('classes.importTitle')" wide @close="emit('close')">
    <p class="hint">{{ t('classes.importFile', { file: props.parsed.fileName, n: props.parsed.students.length }) }}</p>
    <div class="form-grid">
      <label class="field">
        <span>{{ t('classes.importInto') }}</span>
        <select v-model="target" class="input">
          <option value="new">{{ t('classes.newClass') }}</option>
          <option v-for="c in store.data.classes" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </label>
      <label v-if="target === 'new'" class="field">
        <span>{{ t('classes.name') }}</span>
        <input v-model="name" class="input" :placeholder="t('classes.namePlaceholder')" autofocus />
      </label>
    </div>
    <p v-if="target === 'new' && !props.parsed.className" class="hint">{{ t('classes.noClassColumn') }}</p>
    <p v-if="duplicates" class="hint">{{ t('classes.duplicates', { n: duplicates }) }}</p>
    <div class="preview">
      <div v-for="s in preview" :key="s.id" class="pv"><strong>{{ s.lastName }}</strong> {{ s.firstName }}</div>
    </div>
    <template #footer>
      <button class="btn" @click="emit('close')">{{ t('common.cancel') }}</button>
      <button class="btn primary" :disabled="!valid" @click="confirm">{{ t('classes.importConfirm', { n: props.parsed.students.length - duplicates }) }}</button>
    </template>
  </Modal>
</template>

<style scoped>
.preview {
  columns: 3 200px;
  column-gap: 20px;
  max-height: 300px;
  overflow: auto;
  padding: 10px 12px;
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  font-size: 14px;
}
.pv {
  padding: 2px 0;
  break-inside: avoid;
}
</style>
