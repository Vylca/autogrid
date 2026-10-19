<script setup>
import { computed } from 'vue';
import { t, lang } from '../lib/i18n.js';
import { ACQ_LEVELS } from '../lib/model.js';
import { scaleInfo, snapHalf } from '../lib/bareme.js';
import { formatNumber } from '../lib/scoring.js';
import WeightInput from '../components/WeightInput.vue';
import Icon from '../components/Icon.vue';
import CompetencesEditor from './CompetencesEditor.vue';
import PaliersEditor from './PaliersEditor.vue';

const props = defineProps({ grid: Object });

const info = computed(() => scaleInfo(props.grid));
const isPal = computed(() => props.grid.type === 'paliers');
const fmt = (v) => formatNumber(v, lang.value);
const pts = (v) => t('common.points', { n: v, v: fmt(v) });
const steps = [...ACQ_LEVELS].reverse();

function setTarget(v) {
  const x = snapHalf(v);
  if (x >= 0.5 && x <= 1000) props.grid.target = x;
}

function listOr(values) {
  const f = values.map(fmt);
  if (f.length <= 1) return f.join('');
  return `${f.slice(0, -1).join(', ')} ${t('common.or')} ${f[f.length - 1]}`;
}

const sumHint = computed(() => {
  const i = info.value;
  if (i.reachable) return '';
  const itemsKey = isPal.value ? 'grid.criteriaWord' : 'grid.categoriesWord';
  if (i.targetImpossible) return t('grid.targetImpossible', { target: fmt(i.target), steps: i.steps });
  if (i.sumsImpossible) return t('grid.sumImpossible', { target: fmt(i.target), n: i.n, items: t(itemsKey, { n: i.n }) });
  return t('grid.sumHint', { target: fmt(i.target), sums: listOr(i.sums), n: i.totalWeight });
});
</script>

<template>
  <div class="grid-editor">
    <section class="panel scale-panel">
      <div class="scale-top">
        <div class="field">
          <span>{{ t('grid.target') }}</span>
          <WeightInput :value="props.grid.target" :pinnable="false" unit="" @set="setTarget" />
        </div>
        <div class="field">
          <span>{{ t('grid.markedOn') }}</span>
          <strong class="marked-on" :class="{ warn: !info.reachable && !info.convert }">/ {{ fmt(info.finalMax) }}</strong>
        </div>
        <div class="field" v-if="info.n">
          <span>{{ t('grid.weightSum') }}</span>
          <strong class="marked-on">{{ info.totalWeight }}</strong>
        </div>
        <div class="field" v-if="info.n">
          <span>{{ t('grid.stepValue') }}</span>
          <strong class="marked-on">{{ pts(info.unit) }}</strong>
        </div>
        <label class="checkbox advanced">
          <input v-model="props.grid.categoryComments" type="checkbox" />
          <span>{{ isPal ? t('grid.criterionComments') : t('grid.categoryComments') }} <span class="tag">{{ t('grid.advanced') }}</span></span>
        </label>
      </div>

      <div v-if="info.n && !info.reachable" class="unreachable" :class="{ converted: info.convert }">
        <Icon name="alert" :size="18" />
        <div class="u-body">
          <p v-if="info.convert">{{ t('grid.convertedNotice', { max: fmt(info.internalMax), target: fmt(info.target) }) }}</p>
          <p v-else>{{ t('grid.unreachable', { target: fmt(info.target), max: fmt(info.internalMax) }) }}</p>
          <p class="hint">{{ sumHint }}</p>
          <label class="checkbox">
            <input v-model="props.grid.convert" type="checkbox" />
            <span>{{ t('grid.convert', { target: fmt(info.target) }) }}</span>
          </label>
        </div>
      </div>

      <div v-if="info.n" class="possible">
        <span class="label">{{ t('grid.possible') }}</span>
        <div class="chips">
          <button
            v-for="m in info.possible"
            :key="m"
            class="chip"
            :class="{ on: m === info.target }"
            :title="t('grid.useMax', { max: fmt(m) })"
            @click="setTarget(m)"
          >
            / {{ fmt(m) }}
          </button>
        </div>
      </div>

      <div v-if="!isPal" class="steps">
        <span class="label">{{ t('grid.stepsTitle') }}</span>
        <div class="step-list">
          <span v-for="l in steps" :key="l.code" class="step-item">
            <span class="acq-swatch" :style="{ background: l.color }"></span>
            <span>{{ t('acq.' + l.key) }}</span>
            <strong>{{ t('grid.steps', { n: Number(l.code) - 1 }) }}</strong>
          </span>
        </div>
      </div>
    </section>

    <CompetencesEditor v-if="!isPal" :grid="props.grid" :info="info" />
    <PaliersEditor v-else :grid="props.grid" :info="info" />
  </div>
</template>

<style scoped>
.grid-editor {
  max-width: 1100px;
}
.scale-top {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 18px 32px;
}
.marked-on {
  display: inline-block;
  padding: 5px 0;
  font-size: 17px;
  font-variant-numeric: tabular-nums;
}
.marked-on.warn {
  color: var(--danger);
}
.advanced {
  margin-left: auto;
  padding-bottom: 6px;
  font-size: 14px;
}
.unreachable {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  padding: 12px 14px;
  border-left: 3px solid var(--danger);
  background: var(--danger-soft);
  color: var(--danger);
}
.unreachable.converted {
  border-left-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-ink);
}
.u-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--ink);
}
.u-body > p:first-child {
  font-weight: 700;
}
.possible,
.steps {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--rule);
}
.possible {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  padding: 4px 11px;
  border: 1px solid var(--rule-strong);
  border-radius: 999px;
  background: var(--surface);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}
.chip:hover {
  border-color: var(--accent);
  color: var(--accent-ink);
}
.chip.on {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.step-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 6px 22px;
  margin-top: 8px;
}
.step-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}
.step-item strong {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}
</style>
