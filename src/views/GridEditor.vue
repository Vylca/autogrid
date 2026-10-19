<script setup>
import { computed } from 'vue';
import { t, lang } from '../lib/i18n.js';
import { ACQ_LEVELS, DEFAULT_SCALE, ROUNDING_OPTIONS } from '../lib/model.js';
import { setMaxScore, criterionMax } from '../lib/weights.js';
import { formatNumber } from '../lib/scoring.js';
import WeightInput from '../components/WeightInput.vue';
import Icon from '../components/Icon.vue';
import CompetencesEditor from './CompetencesEditor.vue';
import PaliersEditor from './PaliersEditor.vue';

const props = defineProps({ grid: Object });

const total = computed(() => {
  const g = props.grid;
  if (g.type === 'paliers') return g.criteria.reduce((s, c) => s + criterionMax(g, c.id), 0);
  return g.rows.reduce((s, r) => s + r.categories.reduce((a, c) => a + c.points, 0), 0);
});
const totalOk = computed(() => Math.abs(total.value - props.grid.maxScore) < 0.01);

function roundingLabel(r) {
  return r === 0.01 ? t('grid.roundingNone') : t('grid.roundingStep', { n: formatNumber(r, lang.value) });
}

function setPct(code, value) {
  const v = parseFloat(String(value).replace(',', '.'));
  if (Number.isFinite(v)) props.grid.scale[code] = Math.max(0, Math.min(100, v));
}

function resetScale() {
  props.grid.scale = { ...DEFAULT_SCALE };
}
</script>

<template>
  <div class="grid-editor">
    <section class="panel settings">
      <div class="settings-row">
        <div class="field">
          <span>{{ t('grid.maxScore') }}</span>
          <WeightInput :value="props.grid.maxScore" :pinnable="false" unit="" @set="(v) => setMaxScore(props.grid, v)" />
        </div>
        <label class="field">
          <span>{{ t('grid.rounding') }}</span>
          <select v-model.number="props.grid.rounding" class="input">
            <option v-for="r in ROUNDING_OPTIONS" :key="r" :value="r">{{ roundingLabel(r) }}</option>
          </select>
        </label>
        <div class="field total">
          <span>{{ t('grid.total') }}</span>
          <span class="total-check" :class="{ bad: !totalOk }">
            {{ formatNumber(total, lang) }} / {{ formatNumber(props.grid.maxScore, lang) }}
          </span>
        </div>
        <label class="checkbox advanced">
          <input v-model="props.grid.categoryComments" type="checkbox" />
          <span>{{ props.grid.type === 'paliers' ? t('grid.criterionComments') : t('grid.categoryComments') }} <span class="tag">{{ t('grid.advanced') }}</span></span>
        </label>
      </div>
      <p class="hint weights-hint"><Icon name="pin" :size="14" /> {{ t('grid.weightsHint') }}</p>

      <div v-if="props.grid.type === 'competences'" class="scale">
        <div class="scale-head">
          <span class="label">{{ t('grid.scale') }}</span>
          <button class="btn small ghost" @click="resetScale"><Icon name="reset" :size="15" /> {{ t('grid.scaleReset') }}</button>
        </div>
        <div class="scale-list">
          <label v-for="l in ACQ_LEVELS" :key="l.code" class="scale-item">
            <span class="acq-swatch" :style="{ background: l.color }"></span>
            <span class="scale-name">{{ t('acq.' + l.key) }}</span>
            <span class="weight">
              <input :value="formatNumber(props.grid.scale[l.code], lang)" inputmode="decimal" @change="setPct(l.code, $event.target.value)" />
              <span class="unit">%</span>
            </span>
          </label>
        </div>
      </div>
    </section>

    <CompetencesEditor v-if="props.grid.type === 'competences'" :grid="props.grid" />
    <PaliersEditor v-else :grid="props.grid" />
  </div>
</template>

<style scoped>
.grid-editor {
  max-width: 1100px;
}
.settings-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 18px 28px;
}
.settings-row select {
  width: auto;
}
.total-check {
  display: inline-block;
  padding: 5px 0;
  font-size: 16px;
}
.advanced {
  margin-left: auto;
  padding-bottom: 6px;
  font-size: 14px;
}
.weights-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
}
.scale {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--rule);
}
.scale-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.scale-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 8px 22px;
}
.scale-item {
  display: flex;
  align-items: center;
  gap: 10px;
}
.scale-name {
  flex: 1;
  font-size: 14px;
}
.scale-item .weight input {
  width: 48px;
}
</style>
