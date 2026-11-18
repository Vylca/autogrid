<script setup>
// Themes of a grid: chips, and a field that suggests the themes already in use.
import { computed, ref } from 'vue';
import { store } from '../lib/store.js';
import { t } from '../lib/i18n.js';
import { allThemes, cleanTheme } from '../lib/organize.js';
import Icon from './Icon.vue';

const props = defineProps({ grid: Object });
const draft = ref('');
const listId = `themes-${Math.random().toString(36).slice(2, 8)}`;

const suggestions = computed(() => {
  const have = new Set((props.grid.themes || []).map((x) => x.toLowerCase()));
  return allThemes(store.data.grids).filter((x) => !have.has(x.toLowerCase()));
});

function add() {
  const g = props.grid;
  if (!Array.isArray(g.themes)) g.themes = [];
  for (const part of draft.value.split(/[,;\n]/)) {
    let name = cleanTheme(part);
    if (!name) continue;
    // Same spelling as a theme already in use.
    name = allThemes(store.data.grids).find((x) => x.toLowerCase() === name.toLowerCase()) || name;
    if (!g.themes.some((x) => x.toLowerCase() === name.toLowerCase())) g.themes.push(name);
  }
  draft.value = '';
}

function remove(i) {
  props.grid.themes.splice(i, 1);
}
</script>

<template>
  <div class="themes">
    <span class="th-label"><Icon name="tag" :size="15" /> {{ t('themes.label') }}</span>
    <span v-for="(th, i) in props.grid.themes || []" :key="th" class="chip">
      {{ th }}
      <button class="chip-x" :title="t('common.delete')" @click="remove(i)"><Icon name="x" :size="13" /></button>
    </span>
    <span class="th-add">
      <input
        v-model="draft"
        class="input small"
        :list="listId"
        :placeholder="t('themes.placeholder')"
        @keydown.enter.prevent="add"
        @change="add"
      />
      <datalist :id="listId">
        <option v-for="s in suggestions" :key="s" :value="s"></option>
      </datalist>
    </span>
  </div>
</template>

<style scoped>
.themes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  margin-top: 8px;
}
.th-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 14px;
  font-weight: 700;
  color: var(--ink-2);
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
.th-add .input {
  width: 230px;
  height: 32px;
  padding: 4px 10px;
  font-size: 14px;
}
</style>
