<script setup>
import { store, dismissToast } from '../lib/store.js';
import Icon from './Icon.vue';
import { t } from '../lib/i18n.js';

function run(toast) {
  toast.action.run();
  dismissToast(toast.id);
}
</script>

<template>
  <div class="toasts" aria-live="polite">
    <div v-for="toast in store.toasts" :key="toast.id" class="toast" :class="toast.kind">
      <span class="msg">{{ toast.message }}</span>
      <button v-if="toast.action" @click="run(toast)">{{ toast.action.label }}</button>
      <button class="icon-btn" :title="t('common.close')" @click="dismissToast(toast.id)"><Icon name="x" :size="16" /></button>
    </div>
  </div>
</template>
