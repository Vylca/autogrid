<script setup>
import { computed, ref } from 'vue';
import { t, lang } from '../lib/i18n.js';
import { ACTIVITIES, getDescriptor } from '../lib/descriptors.js';
import { CECRL_LEVELS } from '../lib/model.js';
import Modal from './Modal.vue';
import Icon from './Icon.vue';

const props = defineProps({ level: String });
const emit = defineEmits(['insert']);

const open = ref(false);
const activity = ref('EE');
const level = ref('A2');
const text = computed(() => getDescriptor(lang.value, activity.value, level.value));

function show() {
  level.value = CECRL_LEVELS.includes(props.level) ? props.level : 'A2';
  open.value = true;
}
function insert() {
  emit('insert', text.value);
  open.value = false;
}
</script>

<template>
  <button class="btn small ghost" type="button" :title="t('desc.button')" @click="show"><Icon name="book" :size="16" /> CECRL</button>
  <Modal v-if="open" :title="t('desc.title')" @close="open = false">
    <div class="field">
      <span>{{ t('desc.activity') }}</span>
      <div class="choices acts">
        <label v-for="a in ACTIVITIES" :key="a" class="choice" :class="{ on: activity === a }">
          <input v-model="activity" type="radio" :value="a" />
          <div><strong>{{ a }}</strong><small>{{ t('activity.' + a) }}</small></div>
        </label>
      </div>
    </div>
    <label class="field">
      <span>{{ t('grid.level') }}</span>
      <select v-model="level" class="input">
        <option v-for="l in CECRL_LEVELS" :key="l" :value="l">{{ l }}</option>
      </select>
    </label>
    <div class="preview">{{ text }}</div>
    <p class="hint">{{ t('desc.hint') }}</p>
    <template #footer>
      <button class="btn" @click="open = false">{{ t('common.cancel') }}</button>
      <button class="btn primary" @click="insert">{{ t('desc.insert') }}</button>
    </template>
  </Modal>
</template>

<style scoped>
.acts {
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
}
.preview {
  padding: 12px 14px;
  border-left: 3px solid var(--accent);
  background: var(--paper);
  font-size: 14px;
}
</style>
