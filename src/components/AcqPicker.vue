<script setup>
import { computed } from 'vue';
import { ACQ_LEVELS, SPECIAL_MARKS } from '../lib/model.js';
import { t } from '../lib/i18n.js';

const props = defineProps({ value: String });
const emit = defineEmits(['pick']);

const levels = [...ACQ_LEVELS].reverse(); // 1 (insuffisante) to 6 (très bonne)
const selected = computed(() => ACQ_LEVELS.find((l) => l.code === props.value) || null);
const label = computed(() => {
  if (!props.value) return t('grading.notGraded');
  if (selected.value) return t(`acq.${selected.value.key}`);
  const sp = SPECIAL_MARKS.find((s) => s.code === props.value);
  return sp ? t(`acq.${sp.key}`) : '';
});
</script>

<template>
  <div class="acq-picker">
    <div class="acq-buttons" role="radiogroup">
      <button
        v-for="l in levels"
        :key="l.code"
        class="acq-btn"
        :class="{ on: props.value === l.code, dim: props.value && props.value !== l.code }"
        :style="{ '--c': l.color, '--tc': l.text }"
        :title="t('acq.' + l.key)"
        role="radio"
        :aria-checked="props.value === l.code"
        tabindex="-1"
        @click.stop="emit('pick', l.code)"
      >
        {{ l.code }}
      </button>
      <span class="acq-sep"></span>
      <button
        v-for="s in SPECIAL_MARKS"
        :key="s.code"
        class="acq-btn special"
        :class="{ on: props.value === s.code }"
        :title="t('acq.' + s.key)"
        role="radio"
        :aria-checked="props.value === s.code"
        tabindex="-1"
        @click.stop="emit('pick', s.code)"
      >
        {{ s.code }}
      </button>
    </div>
    <div class="acq-label" :class="{ muted: !props.value }">
      <span v-if="selected" class="acq-swatch" :style="{ background: selected.color }"></span>{{ label }}
    </div>
  </div>
</template>

<style scoped>
.acq-picker {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.acq-buttons {
  display: flex;
  align-items: center;
  gap: 4px;
}
.acq-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 2px solid color-mix(in srgb, var(--c) 55%, white);
  border-radius: 50%;
  background: color-mix(in srgb, var(--c) 16%, white);
  color: var(--ink);
  font-weight: 800;
  font-size: 14px;
  cursor: pointer;
  transition: transform 0.08s ease;
}
.acq-btn:hover {
  border-color: var(--c);
  transform: scale(1.08);
}
.acq-btn.on {
  border-color: color-mix(in srgb, var(--c) 70%, black);
  background: var(--c);
  color: var(--tc);
  transform: scale(1.12);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--c) 30%, white);
}
.acq-btn.dim {
  opacity: 0.55;
}
.acq-btn.special {
  --c: #7a8396;
  --tc: #fff;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  font-size: 12px;
}
.acq-btn.special.on {
  background: var(--ink-2);
  border-color: var(--ink);
}
.acq-sep {
  width: 1px;
  height: 22px;
  margin: 0 3px;
  background: var(--rule-strong);
}
.acq-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-2);
}
.acq-label.muted {
  font-weight: 400;
  color: var(--ink-3);
}
.acq-swatch {
  width: 10px;
  height: 10px;
}
</style>
