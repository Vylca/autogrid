<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import Icon from './Icon.vue';
import { t } from '../lib/i18n.js';

const props = defineProps({ title: String, wide: Boolean });
const emit = defineEmits(['close']);

function onKey(e) {
  if (e.key === 'Escape') {
    e.stopPropagation();
    emit('close');
  }
}
const box = ref(null);
onMounted(() => {
  window.addEventListener('keydown', onKey, true);
  nextTick(() => box.value?.querySelector('.modal-body input, .modal-body select, .modal-body textarea')?.focus());
});
onBeforeUnmount(() => window.removeEventListener('keydown', onKey, true));
</script>

<template>
  <Teleport to="body">
    <div class="modal-backdrop" @mousedown.self="emit('close')">
      <div ref="box" class="modal" :class="{ wide: props.wide }" role="dialog" aria-modal="true">
        <div class="modal-head">
          <h2>{{ props.title }}</h2>
          <button class="icon-btn" :title="t('common.close')" @click="emit('close')"><Icon name="x" /></button>
        </div>
        <div class="modal-body"><slot /></div>
        <div v-if="$slots.footer" class="modal-foot"><slot name="footer" /></div>
      </div>
    </div>
  </Teleport>
</template>
