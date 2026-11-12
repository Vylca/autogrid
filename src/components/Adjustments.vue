<script setup>
// Bonus and penalties of one student, each with its reason. Points are on the
// mark out of the target, in half points.
import { nextTick, ref } from 'vue';
import { t, lang } from '../lib/i18n.js';
import { uid } from '../lib/model.js';
import { formatNumber } from '../lib/scoring.js';
import Icon from './Icon.vue';

const props = defineProps({
  // Returns the result, creating it if needed.
  ensure: Function,
  result: Object,
  max: { type: Number, default: 20 },
  compact: Boolean,
});

const root = ref(null);

function list() {
  return props.result?.adjustments || [];
}

async function add(sign) {
  const r = props.ensure();
  if (!Array.isArray(r.adjustments)) r.adjustments = [];
  r.adjustments.push({ id: uid(), reason: '', points: sign });
  await nextTick();
  const inputs = root.value?.querySelectorAll('.adj-reason');
  inputs?.[inputs.length - 1]?.focus();
}

function step(a, delta) {
  const v = Math.round((Number(a.points) + delta) * 2) / 2;
  a.points = Math.max(-props.max, Math.min(props.max, v));
}

function remove(i) {
  props.result.adjustments.splice(i, 1);
}

function signed(v) {
  const n = formatNumber(Math.abs(v), lang.value);
  if (v > 0) return `+${n}`;
  if (v < 0) return `−${n}`;
  return '0';
}
</script>

<template>
  <div ref="root" class="adj" :class="{ compact: props.compact }">
    <div class="adj-head">
      <span class="adj-title">{{ t('grading.adjustments') }}</span>
      <span class="adj-add">
        <button class="btn small" type="button" @click="add(1)"><Icon name="plus" :size="14" /> {{ t('grading.addBonus') }}</button>
        <button class="btn small" type="button" @click="add(-1)"><Icon name="minus" :size="14" /> {{ t('grading.addMalus') }}</button>
      </span>
    </div>
    <div v-for="(a, i) in list()" :key="a.id" class="adj-row" :class="a.points > 0 ? 'plus' : a.points < 0 ? 'minus' : ''">
      <input v-model="a.reason" class="input adj-reason" :placeholder="a.points < 0 ? t('grading.malusReason') : t('grading.bonusReason')" />
      <span class="adj-step">
        <button type="button" aria-label="-" @click="step(a, -0.5)"><Icon name="minus" :size="13" /></button>
        <span class="adj-val">{{ signed(a.points) }}</span>
        <button type="button" aria-label="+" @click="step(a, 0.5)"><Icon name="plus" :size="13" /></button>
      </span>
      <button class="icon-btn danger" type="button" :title="t('common.delete')" @click="remove(i)"><Icon name="trash" :size="16" /></button>
    </div>
  </div>
</template>

<style scoped>
.adj {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.adj-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px 10px;
}
.adj-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--ink-2);
}
.adj-add {
  display: inline-flex;
  gap: 6px;
}
.adj-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.adj-reason {
  flex: 1;
  min-width: 0;
}
.adj-step {
  display: inline-flex;
  align-items: center;
  flex: none;
  border: 1px solid var(--rule-strong);
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--surface);
}
.adj-step button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 30px;
  padding: 0;
  border: 0;
  background: var(--paper);
  color: var(--ink-2);
  cursor: pointer;
}
.adj-step button:hover {
  background: var(--accent-soft);
  color: var(--accent-ink);
}
.adj-val {
  min-width: 46px;
  height: 30px;
  line-height: 30px;
  border-left: 1px solid var(--rule);
  border-right: 1px solid var(--rule);
  text-align: center;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.adj-row.plus .adj-val {
  color: var(--ok);
}
.adj-row.minus .adj-val {
  color: var(--danger);
}
.compact .adj-row {
  flex-wrap: wrap;
}
.compact .adj-reason {
  flex-basis: 100%;
}
</style>
