<script setup>
import { ref } from 'vue';
import { t, lang } from '../lib/i18n.js';
import { CECRL_LEVELS, newLevel, newCriterion } from '../lib/model.js';
import {
  weightOf,
  criterionMax,
  cellPoints,
  setCellPoints,
  resetCellPoints,
  ensureCell,
  isTopLevel,
  isCellPinned,
} from '../lib/bareme.js';
import { formatNumber } from '../lib/scoring.js';
import WeightStepper from '../components/WeightStepper.vue';
import WeightInput from '../components/WeightInput.vue';
import DescriptorPicker from '../components/DescriptorPicker.vue';
import Icon from '../components/Icon.vue';

const props = defineProps({ grid: Object, info: Object });

const pts = (v) => t('common.points', { n: v, v: formatNumber(v, lang.value) });

function suggestLevel() {
  const used = new Set(props.grid.levels.map((l) => l.level));
  const lowest = props.grid.levels[props.grid.levels.length - 1];
  const i = lowest ? CECRL_LEVELS.indexOf(lowest.level) - 1 : 4;
  if (i >= 0 && !used.has(CECRL_LEVELS[i])) return CECRL_LEVELS[i];
  return CECRL_LEVELS.find((l) => !used.has(l)) || 'A1';
}
const addLevelValue = ref(suggestLevel());

function addLevel() {
  const lvl = newLevel(addLevelValue.value);
  // Keep levels sorted from the highest to the lowest.
  const rank = CECRL_LEVELS.indexOf(lvl.level);
  let pos = props.grid.levels.findIndex((l) => CECRL_LEVELS.indexOf(l.level) < rank);
  if (pos === -1) pos = props.grid.levels.length;
  props.grid.levels.splice(pos, 0, lvl);
  addLevelValue.value = suggestLevel();
}

function removeLevel(i) {
  const lvl = props.grid.levels[i];
  const hasText = Object.values(props.grid.cells[lvl.id] || {}).some((c) => c.descriptor);
  if (hasText && !window.confirm(t('grid.confirmDeleteLevel', { level: lvl.level }))) return;
  props.grid.levels.splice(i, 1);
  delete props.grid.cells[lvl.id];
  addLevelValue.value = suggestLevel();
}

function moveLevel(i, d) {
  const j = i + d;
  const levels = props.grid.levels;
  if (j < 0 || j >= levels.length) return;
  [levels[i], levels[j]] = [levels[j], levels[i]];
}

function addCriterion() {
  props.grid.criteria.push(newCriterion(''));
}

function removeCriterion(i) {
  const c = props.grid.criteria[i];
  const hasText = props.grid.levels.some((l) => props.grid.cells[l.id]?.[c.id]?.descriptor);
  if ((c.name || hasText) && !window.confirm(t('grid.confirmDeleteCriterion', { name: c.name || t('common.untitled') }))) return;
  props.grid.criteria.splice(i, 1);
  for (const row of Object.values(props.grid.cells)) delete row[c.id];
}

function moveCriterion(i, d) {
  const j = i + d;
  const list = props.grid.criteria;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
}

function cellText(levelId, critId) {
  return props.grid.cells?.[levelId]?.[critId]?.descriptor || '';
}

function setCellText(levelId, critId, value) {
  ensureCell(props.grid, levelId, critId).descriptor = value;
}

function insertDescriptor(levelId, critId, text) {
  const cur = cellText(levelId, critId);
  setCellText(levelId, critId, cur ? `${cur}\n${text}` : text);
}
</script>

<template>
  <div class="pal-editor">
    <div class="two">
      <section class="panel">
        <div class="panel-head">
          <div>
            <h3>{{ t('grid.levelsTitle') }}</h3>
            <p class="hint">{{ t('grid.levelsHint') }}</p>
          </div>
        </div>
        <div class="lvl-list">
          <div v-for="(l, i) in props.grid.levels" :key="l.id" class="lvl-item">
            <select v-model="l.level" class="input lvl-select">
              <option v-for="x in CECRL_LEVELS" :key="x" :value="x">{{ x }}</option>
            </select>
            <span class="lvl-steps">{{ t('grid.steps', { n: props.grid.levels.length - i }) }}</span>
            <div class="row-actions">
              <button class="icon-btn" :disabled="i === 0" :title="t('common.moveUp')" @click="moveLevel(i, -1)"><Icon name="up" :size="16" /></button>
              <button class="icon-btn" :disabled="i === props.grid.levels.length - 1" :title="t('common.moveDown')" @click="moveLevel(i, 1)"><Icon name="down" :size="16" /></button>
              <button class="icon-btn danger" :title="t('grid.deleteLevel')" @click="removeLevel(i)"><Icon name="trash" :size="16" /></button>
            </div>
          </div>
        </div>
        <div class="add-inline">
          <select v-model="addLevelValue" class="input lvl-select">
            <option v-for="x in CECRL_LEVELS" :key="x" :value="x">{{ x }}</option>
          </select>
          <button class="btn small" @click="addLevel"><Icon name="plus" :size="16" /> {{ t('grid.addLevel') }}</button>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <div>
            <h3>{{ t('grid.criteriaTitle') }}</h3>
            <p class="hint">{{ t('grid.criteriaHint') }}</p>
          </div>
        </div>
        <div class="crit-list">
          <div v-for="(c, i) in props.grid.criteria" :key="c.id" class="crit-item">
            <input v-model="c.name" class="input crit-name" :placeholder="t('grid.criterionName')" />
            <input v-model="c.group" class="input crit-group" :placeholder="t('grid.group')" :title="t('grid.groupHint')" />
            <WeightStepper :value="weightOf(c)" @set="(w) => (c.weight = w)" />
            <span class="crit-pts">{{ pts(criterionMax(props.grid, c.id, props.info)) }}</span>
            <div class="row-actions">
              <button class="icon-btn" :disabled="i === 0" :title="t('common.moveUp')" @click="moveCriterion(i, -1)"><Icon name="up" :size="16" /></button>
              <button class="icon-btn" :disabled="i === props.grid.criteria.length - 1" :title="t('common.moveDown')" @click="moveCriterion(i, 1)"><Icon name="down" :size="16" /></button>
              <button class="icon-btn danger" :title="t('grid.deleteCriterion')" @click="removeCriterion(i)"><Icon name="trash" :size="16" /></button>
            </div>
          </div>
        </div>
        <div class="add-inline">
          <button class="btn small" @click="addCriterion"><Icon name="plus" :size="16" /> {{ t('grid.addCriterion') }}</button>
        </div>
      </section>
    </div>

    <section class="panel matrix-panel">
      <div class="panel-head">
        <div>
          <h3>{{ t('grid.cellsTitle') }}</h3>
          <p class="hint">{{ t('grid.cellsHint') }}</p>
        </div>
      </div>
      <div v-if="!props.grid.levels.length || !props.grid.criteria.length" class="hint">{{ t('grid.cellsEmpty') }}</div>
      <div v-else class="matrix-scroll">
        <table class="medit">
          <thead>
            <tr>
              <th class="lh"></th>
              <th v-for="c in props.grid.criteria" :key="c.id">
                <span v-if="c.group" class="grp">{{ c.group }}</span>
                {{ c.name || t('common.untitled') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="l in props.grid.levels" :key="l.id">
              <th class="lh"><span class="lvl">{{ l.level }}</span></th>
              <td v-for="c in props.grid.criteria" :key="c.id">
                <textarea
                  class="input"
                  rows="4"
                  :value="cellText(l.id, c.id)"
                  :placeholder="t('grid.descriptor')"
                  @input="setCellText(l.id, c.id, $event.target.value)"
                ></textarea>
                <div class="cell-foot">
                  <DescriptorPicker compact :level="l.level" @insert="(txt) => insertDescriptor(l.id, c.id, txt)" />
                  <span v-if="isTopLevel(props.grid, l.id)" class="top-pts" :title="t('grid.topLocked')">
                    <Icon name="lock" :size="13" /> {{ pts(cellPoints(props.grid, l.id, c.id, props.info)) }}
                  </span>
                  <WeightInput
                    v-else
                    :value="cellPoints(props.grid, l.id, c.id, props.info)"
                    :pinned="isCellPinned(props.grid, l.id, c.id)"
                    @set="(v) => setCellPoints(props.grid, l.id, c.id, v)"
                    @unpin="resetCellPoints(props.grid, l.id, c.id)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.pal-editor {
  margin-top: 16px;
}
.two {
  display: grid;
  grid-template-columns: minmax(250px, 320px) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}
.two .panel + .panel {
  margin-top: 0;
}
.lvl-list,
.crit-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.lvl-item {
  display: flex;
  align-items: center;
  gap: 10px;
}
.lvl-steps {
  flex: 1;
  font-size: 13px;
  color: var(--ink-2);
}
.lvl-select {
  width: 84px;
  font-weight: 800;
  color: var(--accent-ink);
}
.crit-item {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) auto 58px auto;
  gap: 8px;
  align-items: center;
}
.crit-name {
  font-weight: 700;
}
.crit-pts {
  text-align: right;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.add-inline {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
.matrix-panel {
  margin-top: 16px;
}
.matrix-scroll {
  overflow-x: auto;
}
.medit {
  width: 100%;
  min-width: 640px;
  border-collapse: collapse;
  table-layout: fixed;
}
.medit th,
.medit td {
  padding: 8px;
  border: 1px solid var(--rule);
  vertical-align: top;
  text-align: left;
}
.medit thead th {
  background: var(--paper);
  font-size: 14px;
}
.grp {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-3);
}
.lh {
  width: 70px;
  text-align: center !important;
  background: var(--accent-soft);
}
.lvl {
  font-size: 18px;
  font-weight: 800;
  color: var(--accent-ink);
}
.medit textarea {
  font-size: 13.5px;
  resize: vertical;
}
.cell-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  margin-top: 6px;
}
.cell-foot :deep(.weight input) {
  width: 38px;
}
.top-pts {
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--ink-2);
}
</style>
