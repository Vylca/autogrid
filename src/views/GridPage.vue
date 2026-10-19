<script setup>
import { computed, watch } from 'vue';
import { store, navigate, findGrid } from '../lib/store.js';
import { t } from '../lib/i18n.js';
import Icon from '../components/Icon.vue';
import GridEditor from './GridEditor.vue';

const grid = computed(() => findGrid(store.route.id));

watch(
  () => {
    if (!grid.value) return '';
    const { updatedAt, ...rest } = grid.value;
    return JSON.stringify(rest);
  },
  (now, before) => {
    if (grid.value && before !== undefined) grid.value.updatedAt = new Date().toISOString();
  },
);
</script>

<template>
  <div v-if="grid" class="page wide">
    <button class="back" @click="navigate('grids')"><Icon name="back" :size="16" /> {{ t('nav.grids') }}</button>
    <div class="page-head">
      <div class="grow">
        <input v-model="grid.name" class="input title-input" :placeholder="t('common.untitled')" />
        <p class="sub">{{ grid.type === 'paliers' ? t('grids.typePaliersHint') : t('grids.typeCompetencesHint') }}</p>
      </div>
    </div>
    <GridEditor :grid="grid" />
  </div>
  <div v-else class="page"><div class="empty">{{ t('grid.notFound') }}</div></div>
</template>

<style scoped>
.grow {
  flex: 1;
}
</style>
