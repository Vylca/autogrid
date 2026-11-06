<script setup>
import { computed } from 'vue';
import { ACQ_LEVELS } from '../lib/model.js';
import { formatNumber } from '../lib/scoring.js';
import { t, lang } from '../lib/i18n.js';

// acq: { value (1 to 6), code } from studentAcquisition, or null.
const props = defineProps({ acq: Object, compact: Boolean });
const level = computed(() => ACQ_LEVELS.find((l) => l.code === props.acq?.code) || null);
const value = computed(() => (props.acq ? formatNumber(props.acq.value, lang.value, 1) : ''));
</script>

<template>
  <span v-if="level" class="acqb" :class="{ compact: props.compact }" :title="t('acq.averageHint', { v: value })">
    <span class="sw" :style="{ background: level.color }"></span>
    <span class="lbl">{{ t('acq.' + level.key) }}</span>
    <span class="val">{{ value }}</span>
  </span>
  <span v-else class="acqb none">{{ t('acq.none') }}</span>
</template>

<style scoped>
.acqb {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}
.sw {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex: none;
}
.val {
  padding: 0 5px;
  border-radius: 4px;
  background: var(--paper);
  font-size: 12px;
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
}
.compact {
  font-size: 12px;
  gap: 5px;
}
.compact .sw {
  width: 10px;
  height: 10px;
}
.none {
  font-weight: 400;
  color: var(--ink-3);
}
</style>
