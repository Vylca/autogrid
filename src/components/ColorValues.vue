<script setup>
import { computed } from 'vue';
import { ACQ_LEVELS } from '../lib/model.js';
import { colorPoints } from '../lib/bareme.js';
import { formatNumber } from '../lib/scoring.js';
import { t, lang } from '../lib/i18n.js';

// The points each color gives for a row worth `max`, lowest color first.
const props = defineProps({ max: Number });
const values = computed(() =>
  [...ACQ_LEVELS].reverse().map((l) => ({ ...l, pts: colorPoints(props.max, l.code) })),
);
</script>

<template>
  <span class="cv" :title="t('grid.colorValuesHint')">
    <span v-for="v in values" :key="v.code" class="cv-item" :style="{ '--c': v.color }">{{ formatNumber(v.pts, lang) }}</span>
  </span>
</template>

<style scoped>
.cv {
  display: inline-flex;
  gap: 3px;
}
.cv-item {
  min-width: 26px;
  padding: 1px 3px 2px;
  border-bottom: 3px solid var(--c);
  font-size: 12px;
  font-weight: 700;
  text-align: center;
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
}
</style>
