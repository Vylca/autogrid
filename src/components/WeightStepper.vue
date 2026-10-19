<script setup>
import { nextTick } from 'vue';
import Icon from './Icon.vue';
import { t } from '../lib/i18n.js';
import { clampWeight, MAX_WEIGHT } from '../lib/bareme.js';

const props = defineProps({ value: Number });
const emit = defineEmits(['set']);

function set(v) {
  const w = clampWeight(v);
  if (w !== props.value) emit('set', w);
}

function commit(e) {
  set(e.target.value);
  nextTick(() => (e.target.value = String(props.value)));
}
</script>

<template>
  <span class="stepper" :title="t('grid.weightHint')">
    <span class="st-label">{{ t('grid.weight') }}</span>
    <button class="st-btn" type="button" :disabled="props.value <= 1" :aria-label="t('grid.weightDown')" @click="set(props.value - 1)">
      <Icon name="minus" :size="14" />
    </button>
    <input :value="props.value" inputmode="numeric" :aria-label="t('grid.weight')" @change="commit" @keydown.enter.prevent="$event.target.blur()" @focus="$event.target.select()" />
    <button class="st-btn" type="button" :disabled="props.value >= MAX_WEIGHT" :aria-label="t('grid.weightUp')" @click="set(props.value + 1)">
      <Icon name="plus" :size="14" />
    </button>
  </span>
</template>

<style scoped>
.stepper {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--rule-strong);
  border-radius: var(--radius);
  background: var(--surface);
  overflow: hidden;
}
.stepper:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.st-label {
  padding: 0 8px 0 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-3);
}
.st-btn {
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
.st-btn:last-child {
  border-left: 1px solid var(--rule);
}
.st-btn:hover {
  background: var(--accent-soft);
  color: var(--accent-ink);
}
.st-btn:disabled {
  opacity: 0.35;
  pointer-events: none;
}
input {
  width: 34px;
  height: 30px;
  padding: 0;
  border: 0;
  border-left: 1px solid var(--rule);
  background: none;
  text-align: center;
  font-weight: 800;
  font-size: 15px;
  font-variant-numeric: tabular-nums;
}
input:focus {
  outline: none;
}
</style>
