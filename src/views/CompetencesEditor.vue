<script setup>
import { computed, ref, watch, nextTick } from 'vue';
import { t, lang } from '../lib/i18n.js';
import { CECRL_LEVELS, newRow, newCategory, presetLevels } from '../lib/model.js';
import { formatNumber } from '../lib/scoring.js';
import ImportanceStepper from '../components/ImportanceStepper.vue';
import ColorValues from '../components/ColorValues.vue';
import DescriptorPicker from '../components/DescriptorPicker.vue';
import Icon from '../components/Icon.vue';

const props = defineProps({ grid: Object, info: Object, locked: Boolean });

const pts = (v) => t('common.points', { n: v, v: formatNumber(v, lang.value) });
const cats = computed(() => props.grid.categories);
const activeId = ref(cats.value[0]?.id || null);
const active = computed(() => cats.value.find((c) => c.id === activeId.value) || cats.value[0] || null);
const activeIndex = computed(() => cats.value.indexOf(active.value));

watch(
  () => cats.value.map((c) => c.id).join(),
  () => {
    if (!cats.value.some((c) => c.id === activeId.value)) activeId.value = cats.value[0]?.id || null;
  },
);

function nextLevel(cat) {
  const last = cat.rows[cat.rows.length - 1];
  const i = last ? CECRL_LEVELS.indexOf(last.level) : -1;
  return CECRL_LEVELS[Math.min(i + 1, CECRL_LEVELS.length - 1)] || 'A1';
}
const addLevel = ref('A1');
watch(
  () => [active.value?.id, active.value?.rows.length],
  () => active.value && (addLevel.value = nextLevel(active.value)),
  { immediate: true },
);

const nameInput = ref(null);

function addCategory() {
  const cat = newCategory(t('grid.categoryN', { n: cats.value.length + 1 }));
  cat.rows = presetLevels(props.grid.presetId).map((l) => newRow(l));
  cats.value.push(cat);
  activeId.value = cat.id;
  nextTick(() => nameInput.value?.select());
}

function removeCategory() {
  const cat = active.value;
  if (cats.value.length <= 1) return;
  const hasText = cat.rows.some((r) => r.descriptor);
  if (!window.confirm(t(hasText ? 'grid.confirmDeleteCategoryRows' : 'grid.confirmDeleteCategory', { name: cat.name || t('common.untitled') }))) return;
  const i = cats.value.indexOf(cat);
  cats.value.splice(i, 1);
  activeId.value = cats.value[Math.max(0, i - 1)]?.id;
}

function moveCategory(d) {
  const i = activeIndex.value;
  const j = i + d;
  if (j < 0 || j >= cats.value.length) return;
  const list = cats.value;
  [list[i], list[j]] = [list[j], list[i]];
}

function addRow() {
  active.value.rows.push(newRow(addLevel.value));
}

function removeRow(j) {
  const row = active.value.rows[j];
  if (row.descriptor && !window.confirm(t('grid.confirmDeleteRow', { level: row.level }))) return;
  active.value.rows.splice(j, 1);
}

function moveRow(j, d) {
  const rows = active.value.rows;
  const k = j + d;
  if (k < 0 || k >= rows.length) return;
  [rows[j], rows[k]] = [rows[k], rows[j]];
}

function insertDescriptor(row, text) {
  row.descriptor = row.descriptor ? `${row.descriptor}\n${text}` : text;
}
</script>

<template>
  <div class="comp-editor">
    <div v-if="props.grid.useCategories" class="cat-tabs" role="tablist">
      <button
        v-for="c in cats"
        :key="c.id"
        class="cat-tab"
        :class="{ on: c.id === active?.id }"
        role="tab"
        :aria-selected="c.id === active?.id"
        @click="activeId = c.id"
      >
        <span class="tab-name">{{ c.name || t('common.untitled') }}</span>
        <span class="tab-pts">{{ pts(props.info.catMax[c.id] || 0) }}</span>
      </button>
      <button v-if="!props.locked" class="cat-tab add" @click="addCategory"><Icon name="plus" :size="16" /> {{ t('grid.addCategory') }}</button>
    </div>

    <section v-if="active" class="cat-panel" :class="{ tabbed: props.grid.useCategories }">
      <header v-if="props.grid.useCategories" class="cat-head">
        <input ref="nameInput" v-model="active.name" class="input cat-name" :placeholder="t('grid.categoryName')" />
        <ImportanceStepper v-model="active.importance" :disabled="props.locked" />
        <strong class="cat-pts">{{ pts(props.info.catMax[active.id] || 0) }}</strong>
        <span class="spacer"></span>
        <div v-if="!props.locked" class="row-actions">
          <button class="icon-btn" :disabled="activeIndex === 0" :title="t('grid.moveLeft')" @click="moveCategory(-1)"><Icon name="left" /></button>
          <button class="icon-btn" :disabled="activeIndex === cats.length - 1" :title="t('grid.moveRight')" @click="moveCategory(1)"><Icon name="right" /></button>
          <button class="icon-btn danger" :disabled="cats.length <= 1" :title="t('grid.deleteCategory')" @click="removeCategory"><Icon name="trash" /></button>
        </div>
      </header>

      <div v-for="(row, j) in active.rows" :key="row.id" class="row-edit" :class="{ flagged: props.info.flagged.has(row.id) }">
        <select v-model="row.level" class="input lvl-select" :aria-label="t('grid.level')">
          <option v-for="l in CECRL_LEVELS" :key="l" :value="l">{{ l }}</option>
        </select>
        <textarea v-model="row.descriptor" class="input" rows="2" :placeholder="t('grid.descriptor')"></textarea>
        <div class="row-side">
          <div class="row-line">
            <ImportanceStepper v-if="props.grid.rowImportance && !props.locked" v-model="row.importance" />
            <span class="row-pts">
              <Icon v-if="props.info.flagged.has(row.id)" name="alert" :size="15" class="flag" />
              {{ pts(props.info.rowMax[row.id] || 0) }}
            </span>
          </div>
          <ColorValues :max="props.info.rowMax[row.id] || 0" />
          <div class="row-actions">
            <DescriptorPicker compact :level="row.level" @insert="(txt) => insertDescriptor(row, txt)" />
            <template v-if="!props.locked">
              <button class="icon-btn" :disabled="j === 0" :title="t('common.moveUp')" @click="moveRow(j, -1)"><Icon name="up" :size="16" /></button>
              <button class="icon-btn" :disabled="j === active.rows.length - 1" :title="t('common.moveDown')" @click="moveRow(j, 1)"><Icon name="down" :size="16" /></button>
              <button class="icon-btn danger" :title="t('grid.deleteRow')" @click="removeRow(j)"><Icon name="trash" :size="16" /></button>
            </template>
          </div>
        </div>
      </div>
      <p v-if="!active.rows.length" class="hint no-rows">{{ t('grid.noRows') }}</p>

      <footer v-if="!props.locked" class="add-row">
        <select v-model="addLevel" class="input lvl-select" :aria-label="t('grid.level')">
          <option v-for="l in CECRL_LEVELS" :key="l" :value="l">{{ l }}</option>
        </select>
        <button class="btn small" @click="addRow"><Icon name="plus" :size="16" /> {{ t('grid.addRow') }}</button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.comp-editor {
  margin-top: 16px;
}
.cat-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 0 4px;
}
.cat-tab {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  min-width: 120px;
  padding: 8px 14px 7px;
  border: 1px solid var(--rule);
  border-bottom: 0;
  border-radius: var(--radius) var(--radius) 0 0;
  background: var(--paper);
  color: var(--ink-2);
  text-align: left;
  cursor: pointer;
  position: relative;
  top: 1px;
}
.cat-tab:hover {
  color: var(--ink);
  background: var(--surface);
}
.cat-tab.on {
  background: var(--surface);
  color: var(--accent-ink);
  border-color: var(--rule-strong);
  border-top: 3px solid var(--accent);
  padding-top: 6px;
  z-index: 1;
}
.tab-name {
  font-weight: 700;
  font-size: 15px;
}
.tab-pts {
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--ink-3);
}
.cat-tab.add {
  flex-direction: row;
  align-items: center;
  gap: 6px;
  min-width: 0;
  border-style: dashed;
  font-weight: 600;
  font-size: 14px;
}
.cat-panel {
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--surface);
}
.cat-panel.tabbed {
  border-color: var(--rule-strong);
  border-top-left-radius: 0;
}
.cat-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--rule);
  background: var(--accent-soft);
}
.cat-name {
  width: 260px;
  font-weight: 800;
  font-size: 16px;
}
.cat-pts {
  font-size: 16px;
  font-variant-numeric: tabular-nums;
  color: var(--accent-ink);
}
.spacer {
  flex: 1;
}
.row-edit {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
  padding: 12px 14px;
  border-bottom: 1px solid var(--rule);
  border-left: 3px solid transparent;
}
.row-edit.flagged {
  border-left-color: #c77700;
}
.lvl-select {
  font-weight: 800;
  font-size: 15px;
  color: var(--accent-ink);
}
.row-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}
.row-line {
  display: flex;
  align-items: center;
  gap: 10px;
}
.row-pts {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 60px;
  justify-content: flex-end;
  font-weight: 800;
  font-size: 15px;
  font-variant-numeric: tabular-nums;
}
.flag {
  color: #c77700;
}
.no-rows {
  padding: 14px;
}
.add-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
}
.add-row .lvl-select {
  width: 84px;
}
</style>
