<script setup>
import { computed, onMounted, ref, watch, nextTick } from 'vue';
import { store, navigate, flushSave, toast } from './lib/store.js';
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
const mainEl = ref(null);
watch(
  () => [store.route.name, store.route.id],
  () => nextTick(() => mainEl.value && (mainEl.value.scrollTop = 0)),
);

const version = ref('');
const installing = ref(false);

async function runUpdate() {
  if (!window.confirm(t('update.confirm', { v: store.update.latest }))) return;
  flushSave();
  installing.value = true;
  const res = await window.api.installUpdate();
  if (!res?.ok) {
    installing.value = false;
    toast(t('update.failed'), { kind: 'error' });
  }
}

function setLang(l) {
  store.data.settings.lang = l;
  document.documentElement.lang = l;
}

onMounted(async () => {
  document.documentElement.lang = lang.value;
  version.value = (await window.api.appInfo?.())?.version || '';
  const info = await window.api.selftestInfo?.();
  if (info) runSelftest(info);
  else {
    setTimeout(async () => {
      const res = await window.api.checkUpdate?.();
      if (res && !res.error) store.update = res;
    }, 2500);
  }
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
        <button :class="{ active: section === 'exams' }" :title="t('nav.exams')" @click="navigate('exams')">
          <Icon name="exam" /> <span class="nav-label">{{ t('nav.exams') }}</span>
        </button>
        <button :class="{ active: section === 'grids' }" :title="t('nav.grids')" @click="navigate('grids')">
          <Icon name="grid" /> <span class="nav-label">{{ t('nav.grids') }}</span>
        </button>
        <button :class="{ active: section === 'classes' }" :title="t('nav.classes')" @click="navigate('classes')">
          <Icon name="users" /> <span class="nav-label">{{ t('nav.classes') }}</span>
        </button>
      </nav>
      <div class="sidebar-foot">
        <div v-if="store.update?.available" class="update">
          <strong class="update-text">{{ t('update.available', { v: store.update.latest }) }}</strong>
          <button v-if="store.update.canInstall" class="btn small primary" :disabled="installing" :title="t('update.button')" @click="runUpdate">
            <Icon name="download" :size="15" /> <span class="update-label">{{ installing ? t('update.installing') : t('update.button') }}</span>
          </button>
          <p v-else class="hint update-text">{{ t('update.manual') }}</p>
        </div>
        <div class="segmented" role="group" :aria-label="t('nav.language')">
          <button :class="{ on: lang === 'fr' }" title="Français" @click="setLang('fr')"><span class="long">Français</span><span class="short">FR</span></button>
          <button :class="{ on: lang === 'en' }" title="English" @click="setLang('en')"><span class="long">English</span><span class="short">EN</span></button>
        </div>
        <span v-if="version" class="version">v{{ version }}</span>
      </div>
    </aside>
    <main ref="mainEl" class="main">
      <div v-if="store.loadError" class="banner danger">{{ t('app.loadError') }}</div>
      <component :is="view" :key="store.route.name + (store.route.id || '')" />
    </main>
    <Toasts />
  </div>
</template>
