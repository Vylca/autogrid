<script setup>
import { computed } from 'vue';
import Icon from './Icon.vue';
import { t } from '../lib/i18n.js';
import { clampImportance, MIN_IMPORTANCE, MAX_IMPORTANCE } from '../lib/bareme.js';

const props = defineProps({ modelValue: Number, disabled: Boolean, compact: Boolean });
const emit = defineEmits(['update:modelValue']);

const value = computed(() => clampImportance(props.modelValue || 0));
const label = computed(() => {
  if (value.value === 0) return t('imp.normal');
  return value.value > 0 ? `+${value.value}` : `−${-value.value}`;
});

function set(v) {
  const n = clampImportance(v);
  if (n !== value.value) emit('update:modelValue', n);
}
</script>

<template>
  <span class="imp" :class="{ raised: value > 0, lowered: value < 0 }" :title="t('imp.hint')">
    <span v-if="!props.compact" class="imp-label">{{ t('imp.label') }}</span>
    <button class="imp-btn" type="button" :disabled="props.disabled || value <= MIN_IMPORTANCE" :aria-label="t('imp.down')" @click="set(value - 1)">
      <Icon name="minus" :size="14" />
    </button>
    <span class="imp-value" aria-live="polite">{{ label }}</span>
    <button class="imp-btn" type="button" :disabled="props.disabled || value >= MAX_IMPORTANCE" :aria-label="t('imp.up')" @click="set(value + 1)">
      <Icon name="plus" :size="14" />
    </button>
  </span>
</template>

<style scoped>
.imp {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--rule-strong);
  border-radius: var(--radius);
  background: var(--surface);
  overflow: hidden;
  white-space: nowrap;
}
.imp-label {
  padding: 0 8px 0 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-3);
}
.imp-label + .imp-btn {
  border-left: 1px solid var(--rule);
}
.imp-btn:first-child {
  border-left: 0;
}
.imp-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 30px;
  padding: 0;
  border: 0;
  border-left: 1px solid var(--rule);
  background: var(--paper);
  color: var(--ink-2);
  cursor: pointer;
}
.imp-btn:hover {
  background: var(--accent-soft);
  color: var(--accent-ink);
}
.imp-btn:disabled {
  opacity: 0.35;
  pointer-events: none;
}
.imp-value {
  min-width: 70px;
  height: 30px;
  line-height: 30px;
  border-left: 1px solid var(--rule);
  text-align: center;
  font-weight: 800;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  color: var(--ink-2);
}
.imp.raised .imp-value {
  color: var(--accent-ink);
  background: var(--accent-soft);
}
.imp.lowered .imp-value {
  color: var(--ink);
  background: var(--paper);
}
</style>
