<script setup>
import { ref } from 'vue';
import { t } from '../lib/i18n.js';
import { CECRL_LEVELS, newRow, newCategory, uid, cloneDeep } from '../lib/model.js';
import {
  setRowPoints,
  rebalanceRows,
  setCategoryPoints,
  syncCategories,
  unpin,
  rebalance,
  resetEven,
} from '../lib/weights.js';
import WeightInput from '../components/WeightInput.vue';
import DescriptorPicker from '../components/DescriptorPicker.vue';
import Icon from '../components/Icon.vue';

const props = defineProps({ grid: Object });

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
  rebalanceRows(props.grid);
  addLevel.value = nextLevel();
}

function removeRow(i) {
  const row = props.grid.rows[i];
  const hasContent = row.categories.some((c) => c.name || c.descriptor);
  if (hasContent && !window.confirm(t('grid.confirmDeleteRow', { level: row.level }))) return;
  props.grid.rows.splice(i, 1);
  rebalanceRows(props.grid);
  addLevel.value = nextLevel();
}

function duplicateRow(i) {
  const copy = cloneDeep(props.grid.rows[i]);
  copy.id = uid();
  copy.pinned = false;
  for (const c of copy.categories) c.id = uid();
  props.grid.rows.splice(i + 1, 0, copy);
  rebalanceRows(props.grid);
}

function moveRow(i, d) {
  const j = i + d;
  const rows = props.grid.rows;
  if (j < 0 || j >= rows.length) return;
  [rows[i], rows[j]] = [rows[j], rows[i]];
}

function unpinRow(i) {
  unpin(props.grid.rows, i, props.grid.maxScore);
  props.grid.rows.forEach(syncCategories);
}

function evenRows() {
  resetEven(props.grid.rows, props.grid.maxScore);
  props.grid.rows.forEach(syncCategories);
}

function addCategory(row) {
  row.categories.push(newCategory(''));
  rebalance(row.categories, row.points);
}

function removeCategory(row, j) {
  const c = row.categories[j];
  if ((c.name || c.descriptor) && !window.confirm(t('grid.confirmDeleteCategory', { name: c.name || t('common.untitled') }))) return;
  row.categories.splice(j, 1);
  rebalance(row.categories, row.points);
}

function moveCategory(row, j, d) {
  const k = j + d;
  if (k < 0 || k >= row.categories.length) return;
  [row.categories[j], row.categories[k]] = [row.categories[k], row.categories[j]];
}

function evenCategories(row) {
  resetEven(row.categories, row.points);
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
        <WeightInput :value="row.points" :pinned="row.pinned" @set="(v) => setRowPoints(props.grid, i, v)" @unpin="unpinRow(i)" />
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
          <WeightInput :value="cat.points" :pinned="cat.pinned" :pinnable="row.categories.length > 1" @set="(v) => setCategoryPoints(row, j, v)" @unpin="unpin(row.categories, j, row.points)" />
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
        <button class="btn small" @click="addCategory(row)"><Icon name="plus" :size="16" /> {{ t('grid.addCategory') }}</button>
        <button v-if="row.categories.length > 1" class="btn small ghost" @click="evenCategories(row)"><Icon name="reset" :size="15" /> {{ t('grid.evenSplit') }}</button>
      </footer>
    </section>

    <div class="add-row">
      <select v-model="addLevel" class="input lvl-select" :aria-label="t('grid.level')">
        <option v-for="l in CECRL_LEVELS" :key="l" :value="l">{{ l }}</option>
      </select>
      <button class="btn" @click="addRow"><Icon name="plus" /> {{ t('grid.addRow') }}</button>
      <span class="spacer"></span>
      <button v-if="props.grid.rows.length > 1" class="btn ghost" @click="evenRows"><Icon name="reset" :size="16" /> {{ t('grid.evenSplitRows') }}</button>
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
  gap: 12px;
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
