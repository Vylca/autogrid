<script setup>
import { ref } from 'vue';
import { t, lang } from '../lib/i18n.js';
import { CECRL_LEVELS, newRow, newCategory, uid, cloneDeep } from '../lib/model.js';
import { categoryMax, rowMax, weightOf } from '../lib/bareme.js';
import { formatNumber } from '../lib/scoring.js';
import WeightStepper from '../components/WeightStepper.vue';
import DescriptorPicker from '../components/DescriptorPicker.vue';
import Icon from '../components/Icon.vue';

const props = defineProps({ grid: Object, info: Object });

const pts = (v) => t('common.points', { n: v, v: formatNumber(v, lang.value) });

function nextLevel() {
  const last = props.grid.rows[props.grid.rows.length - 1];
  const i = last ? CECRL_LEVELS.indexOf(last.level) : -1;
  return CECRL_LEVELS[Math.min(i + 1, CECRL_LEVELS.length - 1)] || 'A1';
}
const addLevel = ref(nextLevel());

function addRow() {
  const row = newRow(addLevel.value);
  row.categories.push(newCategory(''));
  props.grid.rows.push(row);
  addLevel.value = nextLevel();
}

function removeRow(i) {
  const row = props.grid.rows[i];
  const hasContent = row.categories.some((c) => c.name || c.descriptor);
  if (hasContent && !window.confirm(t('grid.confirmDeleteRow', { level: row.level }))) return;
  props.grid.rows.splice(i, 1);
  addLevel.value = nextLevel();
}

function duplicateRow(i) {
  const copy = cloneDeep(props.grid.rows[i]);
  copy.id = uid();
  for (const c of copy.categories) c.id = uid();
  props.grid.rows.splice(i + 1, 0, copy);
}

function moveRow(i, d) {
  const j = i + d;
  const rows = props.grid.rows;
  if (j < 0 || j >= rows.length) return;
  [rows[i], rows[j]] = [rows[j], rows[i]];
}

function removeCategory(row, j) {
  const c = row.categories[j];
  if ((c.name || c.descriptor) && !window.confirm(t('grid.confirmDeleteCategory', { name: c.name || t('common.untitled') }))) return;
  row.categories.splice(j, 1);
}

function moveCategory(row, j, d) {
  const k = j + d;
  if (k < 0 || k >= row.categories.length) return;
  [row.categories[j], row.categories[k]] = [row.categories[k], row.categories[j]];
}

function insertDescriptor(cat, text) {
  cat.descriptor = cat.descriptor ? `${cat.descriptor}\n${text}` : text;
}
</script>

<template>
  <div class="comp-editor">
    <section v-for="(row, i) in props.grid.rows" :key="row.id" class="row-card">
      <header class="row-head">
        <select v-model="row.level" class="input lvl-select" :aria-label="t('grid.level')">
          <option v-for="l in CECRL_LEVELS" :key="l" :value="l">{{ l }}</option>
        </select>
        <span class="row-total">{{ pts(rowMax(props.grid, row, props.info)) }}</span>
        <span class="spacer"></span>
        <div class="row-actions">
          <button class="icon-btn" :disabled="i === 0" :title="t('common.moveUp')" @click="moveRow(i, -1)"><Icon name="up" /></button>
          <button class="icon-btn" :disabled="i === props.grid.rows.length - 1" :title="t('common.moveDown')" @click="moveRow(i, 1)"><Icon name="down" /></button>
          <button class="icon-btn" :title="t('common.duplicate')" @click="duplicateRow(i)"><Icon name="copy" /></button>
          <button class="icon-btn danger" :title="t('grid.deleteRow')" @click="removeRow(i)"><Icon name="trash" /></button>
        </div>
      </header>

      <div v-for="(cat, j) in row.categories" :key="cat.id" class="cat-edit">
        <div class="cat-main">
          <input v-model="cat.name" class="input cat-name" :placeholder="t('grid.categoryName')" />
          <textarea v-model="cat.descriptor" class="input" rows="2" :placeholder="t('grid.descriptor')"></textarea>
        </div>
        <div class="cat-ctrl">
          <div class="weight-line">
            <WeightStepper :value="weightOf(cat)" @set="(w) => (cat.weight = w)" />
            <span class="cat-pts">{{ pts(categoryMax(props.grid, cat, props.info)) }}</span>
          </div>
          <div class="row-actions">
            <DescriptorPicker :level="row.level" @insert="(txt) => insertDescriptor(cat, txt)" />
            <button class="icon-btn" :disabled="j === 0" :title="t('common.moveUp')" @click="moveCategory(row, j, -1)"><Icon name="up" :size="16" /></button>
            <button class="icon-btn" :disabled="j === row.categories.length - 1" :title="t('common.moveDown')" @click="moveCategory(row, j, 1)"><Icon name="down" :size="16" /></button>
            <button class="icon-btn danger" :title="t('grid.deleteCategory')" @click="removeCategory(row, j)"><Icon name="trash" :size="16" /></button>
          </div>
        </div>
      </div>
      <p v-if="!row.categories.length" class="hint no-cat">{{ t('grid.noCategory') }}</p>

      <footer class="row-foot">
        <button class="btn small" @click="row.categories.push(newCategory(''))"><Icon name="plus" :size="16" /> {{ t('grid.addCategory') }}</button>
      </footer>
    </section>

    <div class="add-row">
      <select v-model="addLevel" class="input lvl-select" :aria-label="t('grid.level')">
        <option v-for="l in CECRL_LEVELS" :key="l" :value="l">{{ l }}</option>
      </select>
      <button class="btn" @click="addRow"><Icon name="plus" /> {{ t('grid.addRow') }}</button>
    </div>
  </div>
</template>

<style scoped>
.comp-editor {
  margin-top: 16px;
}
.row-card {
  margin-bottom: 14px;
  border: 1px solid var(--rule);
  border-left: 4px solid var(--accent);
  border-radius: var(--radius);
  background: var(--surface);
}
.row-head {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 12px;
  background: var(--accent-soft);
  border-bottom: 1px solid var(--rule);
}
.lvl-select {
  width: 84px;
  font-weight: 800;
  font-size: 16px;
  color: var(--accent-ink);
}
.row-total {
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--accent-ink);
}
.spacer {
  flex: 1;
}
.cat-edit {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 14px;
  padding: 12px 12px 12px 16px;
  border-bottom: 1px solid var(--rule);
}
.cat-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cat-name {
  font-weight: 700;
}
.cat-ctrl {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}
.weight-line {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cat-pts {
  min-width: 58px;
  text-align: right;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.no-cat {
  padding: 12px 16px;
}
.row-foot {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
}
.add-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border: 1px dashed var(--rule-strong);
  border-radius: var(--radius);
}
</style>
