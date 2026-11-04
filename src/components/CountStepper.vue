<script setup>
import Icon from './Icon.vue';

const props = defineProps({ modelValue: Number, min: { type: Number, default: 1 }, max: { type: Number, default: 8 }, label: String });
const emit = defineEmits(['update:modelValue']);

function set(v) {
  const n = Math.min(props.max, Math.max(props.min, Math.round(v)));
  if (n !== props.modelValue) emit('update:modelValue', n);
}
</script>

<template>
  <span class="cs">
    <span v-if="props.label" class="cs-label">{{ props.label }}</span>
    <button class="cs-btn" type="button" :disabled="props.modelValue <= props.min" aria-label="-" @click="set(props.modelValue - 1)"><Icon name="minus" :size="14" /></button>
    <span class="cs-value">{{ props.modelValue }}</span>
    <button class="cs-btn" type="button" :disabled="props.modelValue >= props.max" aria-label="+" @click="set(props.modelValue + 1)"><Icon name="plus" :size="14" /></button>
  </span>
</template>

<style scoped>
.cs {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--rule-strong);
  border-radius: var(--radius);
  background: var(--surface);
  overflow: hidden;
  white-space: nowrap;
}
.cs-label {
  padding: 0 8px 0 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-3);
}
.cs-btn {
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
.cs-btn:first-child {
  border-left: 0;
}
.cs-btn:hover {
  background: var(--accent-soft);
  color: var(--accent-ink);
}
.cs-btn:disabled {
  opacity: 0.35;
  pointer-events: none;
}
.cs-value {
  min-width: 34px;
  height: 30px;
  line-height: 30px;
  border-left: 1px solid var(--rule);
  text-align: center;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
</style>
