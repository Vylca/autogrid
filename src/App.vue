<script setup>
import { computed, onMounted } from 'vue';
import { store, navigate } from './lib/store.js';
import { t, lang } from './lib/i18n.js';
import { ACQ_LEVELS } from './lib/model.js';
import Icon from './components/Icon.vue';
import Toasts from './components/Toasts.vue';
import ExamsList from './views/ExamsList.vue';
import ExamPage from './views/ExamPage.vue';
import GridsList from './views/GridsList.vue';
import GridPage from './views/GridPage.vue';
import ClassesList from './views/ClassesList.vue';
import ClassPage from './views/ClassPage.vue';
import { runSelftest } from './lib/selftest.js';

const views = {
  exams: ExamsList,
  exam: ExamPage,
  grids: GridsList,
  grid: GridPage,
  classes: ClassesList,
  class: ClassPage,
};
const view = computed(() => views[store.route.name] || ExamsList);
const section = computed(
  () => ({ exams: 'exams', exam: 'exams', grids: 'grids', grid: 'grids', classes: 'classes', class: 'classes' })[store.route.name],
);
const strip = [...ACQ_LEVELS].reverse();

function setLang(l) {
  store.data.settings.lang = l;
  document.documentElement.lang = l;
}

onMounted(async () => {
  document.documentElement.lang = lang.value;
  const info = await window.api.selftestInfo?.();
  if (info) runSelftest(info);
});
</script>

<template>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-name">AutoGrid</div>
        <div class="brand-strip" aria-hidden="true">
          <span v-for="l in strip" :key="l.code" :style="{ background: l.color }"></span>
        </div>
      </div>
      <nav class="nav">
        <button :class="{ active: section === 'exams' }" @click="navigate('exams')">
          <Icon name="exam" /> {{ t('nav.exams') }}
        </button>
        <button :class="{ active: section === 'grids' }" @click="navigate('grids')">
          <Icon name="grid" /> {{ t('nav.grids') }}
        </button>
        <button :class="{ active: section === 'classes' }" @click="navigate('classes')">
          <Icon name="users" /> {{ t('nav.classes') }}
        </button>
      </nav>
      <div class="sidebar-foot">
        <div class="segmented" role="group" :aria-label="t('nav.language')">
          <button :class="{ on: lang === 'fr' }" @click="setLang('fr')">Français</button>
          <button :class="{ on: lang === 'en' }" @click="setLang('en')">English</button>
        </div>
      </div>
    </aside>
    <main class="main">
      <div v-if="store.loadError" class="banner danger">{{ t('app.loadError') }}</div>
      <component :is="view" :key="store.route.name + (store.route.id || '')" />
    </main>
    <Toasts />
  </div>
</template>
