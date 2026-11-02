<script setup>
import { computed, ref } from 'vue';
import { store, navigate } from '../lib/store.js';
import { t, lang } from '../lib/i18n.js';
import { newGrid, duplicateGrid, PLACEMENT_PRESETS, CECRL_LEVELS } from '../lib/model.js';
import { formatNumber } from '../lib/scoring.js';
import { scaleInfo } from '../lib/bareme.js';
import { exportBlankGrid } from '../lib/exporter.js';
import Icon from '../components/Icon.vue';
import Modal from '../components/Modal.vue';
import ExportOptions from '../components/ExportOptions.vue';

const grids = computed(() => [...store.data.grids].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')));

function levelsOf(g) {
  if (g.type === 'paliers') return g.levels.map((l) => l.level);
  const all = g.categories.flatMap((c) => c.rows.map((r) => r.level));
  return CECRL_LEVELS.filter((l) => all.includes(l));
}
function counts(g) {
  if (g.type === 'paliers') return [t('grids.nCriteria', { n: g.criteria.length })];
  const rows = g.categories.reduce((n, c) => n + c.rows.length, 0);
  const out = [];
  if (g.useCategories) out.push(t('grids.nCategories', { n: g.categories.length }));
  out.push(t('grids.nRows', { n: rows }));
  return out;
}
function usedBy(g) {
  return store.data.exams.filter((e) => e.sourceGridId === g.id).length;
}

// New grid
const showNew = ref(false);
const form = ref({ name: '', type: 'competences', presetId: '5e', useCategories: false, categories: [], draft: '' });
function openNew() {
  form.value = { name: '', type: 'competences', presetId: '5e', useCategories: false, categories: [], draft: '' };
  showNew.value = true;
}
function addDraft() {
  const parts = form.value.draft.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
  for (const p of parts) if (!form.value.categories.includes(p)) form.value.categories.push(p);
  form.value.draft = '';
}
function create() {
  if (!form.value.name.trim()) return;
  addDraft();
  const f = form.value;
  const names = f.type === 'competences' && f.useCategories ? (f.categories.length ? f.categories : [t('grid.categoryN', { n: 1 })]) : null;
  const g = newGrid({ name: f.name.trim(), type: f.type, presetId: f.presetId, categoryNames: names });
  store.data.grids.push(g);
  showNew.value = false;
  navigate('grid', g.id);
}

function duplicate(g) {
  const copy = duplicateGrid(g, ` (${t('grids.copySuffix')})`);
  store.data.grids.push(copy);
}

function remove(g) {
  const msg = usedBy(g) ? t('grids.confirmDeleteUsed', { name: g.name, n: usedBy(g) }) : t('grids.confirmDelete', { name: g.name });
  if (!window.confirm(msg)) return;
  const i = store.data.grids.findIndex((x) => x.id === g.id);
  store.data.grids.splice(i, 1);
}

// Blank export
const exportFor = ref(null);
const exportOptions = ref({ layout: 'perPage', color: true, orientation: 'portrait' });
const busy = ref(false);
function openExport(g) {
  exportOptions.value = { layout: 'perPage', color: true, orientation: g.type === 'paliers' && g.criteria.length > 3 ? 'landscape' : 'portrait' };
  exportFor.value = g;
}
async function runExport() {
  busy.value = true;
  try {
    const res = await exportBlankGrid(exportFor.value, exportOptions.value);
    if (res && !res.canceled) exportFor.value = null;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>{{ t('grids.title') }}</h1>
        <p class="sub">{{ t('grids.subtitle') }}</p>
      </div>
      <button class="btn primary" @click="openNew"><Icon name="plus" /> {{ t('grids.new') }}</button>
    </div>

    <div v-if="!grids.length" class="empty">
      <h2>{{ t('grids.emptyTitle') }}</h2>
      <p>{{ t('grids.emptyText') }}</p>
      <div class="actions">
        <button class="btn primary" @click="openNew"><Icon name="plus" /> {{ t('grids.new') }}</button>
      </div>
    </div>

    <div v-else class="list">
      <div v-for="g in grids" :key="g.id" class="list-item clickable" @click="navigate('grid', g.id)">
        <div class="grow">
          <div class="title">{{ g.name || t('common.untitled') }}</div>
          <div class="meta">
            <span>{{ g.type === 'paliers' ? t('grids.typePaliers') : t('grids.typeCompetences') }}</span>
            <span v-for="c in counts(g)" :key="c">{{ c }}</span>
            <span>/ {{ formatNumber(g.target, lang) }}</span>
            <span v-if="scaleInfo(g).warnings.length" class="tag warn">{{ t('grids.hasWarnings') }}</span>
          </div>
          <div class="levels">
            <span v-for="(l, i) in levelsOf(g)" :key="i" class="tag level">{{ l }}</span>
          </div>
        </div>
        <div class="row-actions" @click.stop>
          <button class="btn small" @click="openExport(g)"><Icon name="print" :size="16" /> {{ t('grids.exportBlank') }}</button>
          <button class="icon-btn" :title="t('common.duplicate')" @click="duplicate(g)"><Icon name="copy" /></button>
          <button class="icon-btn danger" :title="t('common.delete')" @click="remove(g)"><Icon name="trash" /></button>
        </div>
      </div>
    </div>

    <Modal v-if="showNew" :title="t('grids.new')" @close="showNew = false">
      <label class="field">
        <span>{{ t('grids.name') }}</span>
        <input v-model="form.name" class="input" :placeholder="t('grids.namePlaceholder')" autofocus @keydown.enter="create" />
      </label>
      <div class="field">
        <span>{{ t('grids.type') }}</span>
        <div class="choices">
          <label class="choice" :class="{ on: form.type === 'competences' }">
            <input v-model="form.type" type="radio" value="competences" />
            <div>
              <strong>{{ t('grids.typeCompetences') }}</strong>
              <small>{{ t('grids.typeCompetencesHint') }}</small>
            </div>
          </label>
          <label class="choice" :class="{ on: form.type === 'paliers' }">
            <input v-model="form.type" type="radio" value="paliers" />
            <div>
              <strong>{{ t('grids.typePaliers') }}</strong>
              <small>{{ t('grids.typePaliersHint') }}</small>
            </div>
          </label>
        </div>
      </div>
      <div v-if="form.type === 'competences'" class="field">
        <span>{{ t('grid.useCategories') }}</span>
        <div class="segmented">
          <button :class="{ on: !form.useCategories }" @click="form.useCategories = false">{{ t('common.no') }}</button>
          <button :class="{ on: form.useCategories }" @click="form.useCategories = true">{{ t('common.yes') }}</button>
        </div>
        <span class="hint">{{ t('grids.categoriesHint') }}</span>
      </div>
      <div v-if="form.type === 'competences' && form.useCategories" class="field">
        <span>{{ t('grids.categoryNames') }}</span>
        <div class="chips">
          <span v-for="(c, i) in form.categories" :key="c" class="chip">
            {{ c }}
            <button class="chip-x" :title="t('common.delete')" @click="form.categories.splice(i, 1)"><Icon name="x" :size="13" /></button>
          </span>
        </div>
        <div class="draft">
          <input v-model="form.draft" class="input" :placeholder="t('grids.categoryPlaceholder')" @keydown.enter.prevent="addDraft" />
          <button class="btn small" :disabled="!form.draft.trim()" @click="addDraft"><Icon name="plus" :size="15" /> {{ t('grids.addCategoryName') }}</button>
        </div>
      </div>
      <label class="field">
        <span>{{ t('grids.preset') }}</span>
        <select v-model="form.presetId" class="input">
          <option v-for="p in PLACEMENT_PRESETS" :key="p.id" :value="p.id">
            {{ t('preset.' + p.id) }}{{ p.levels.length ? ' : ' + p.levels.join(', ') : '' }}
          </option>
        </select>
      </label>
      <template #footer>
        <button class="btn" @click="showNew = false">{{ t('common.cancel') }}</button>
        <button class="btn primary" :disabled="!form.name.trim()" @click="create">{{ t('grids.create') }}</button>
      </template>
    </Modal>

    <Modal v-if="exportFor" :title="t('grids.exportBlankTitle', { name: exportFor.name })" @close="exportFor = null">
      <ExportOptions :options="exportOptions" blank />
      <template #footer>
        <button class="btn" @click="exportFor = null">{{ t('common.cancel') }}</button>
        <button class="btn primary" :disabled="busy" @click="runExport"><Icon name="download" /> {{ busy ? t('export.working') : t('export.run') }}</button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chips:empty {
  display: none;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 4px 3px 10px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-ink);
  font-weight: 700;
  font-size: 14px;
}
.chip-x {
  display: inline-flex;
  padding: 2px;
  border: 0;
  border-radius: 50%;
  background: none;
  color: var(--accent-ink);
  cursor: pointer;
}
.chip-x:hover {
  background: rgba(39, 71, 176, 0.15);
}
.draft {
  display: flex;
  gap: 8px;
}
.tag.warn {
  border-color: #c77700;
  color: #a35f00;
}
.levels {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}
</style>
