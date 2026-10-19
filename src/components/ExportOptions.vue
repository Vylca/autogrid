<script setup>
import { t } from '../lib/i18n.js';
import Icon from './Icon.vue';

const props = defineProps({ options: Object, allowPerStudent: Boolean, blank: Boolean });
</script>

<template>
  <div class="export-options">
    <div class="field">
      <span>{{ t('export.layout') }}</span>
      <div class="choices">
        <label class="choice" :class="{ on: props.options.layout === 'perPage' }">
          <input v-model="props.options.layout" type="radio" value="perPage" />
          <div>
            <strong>{{ t('export.perPage') }}</strong>
            <small>{{ props.blank ? t('export.perPageBlankHint') : t('export.perPageHint') }}</small>
          </div>
        </label>
        <label class="choice" :class="{ on: props.options.layout === 'packed' }">
          <input v-model="props.options.layout" type="radio" value="packed" />
          <div>
            <strong>{{ t('export.packed') }}</strong>
            <small>{{ props.blank ? t('export.packedBlankHint') : t('export.packedHint') }}</small>
          </div>
        </label>
        <label v-if="props.allowPerStudent" class="choice" :class="{ on: props.options.layout === 'perStudent' }">
          <input v-model="props.options.layout" type="radio" value="perStudent" />
          <div>
            <strong>{{ t('export.perStudent') }}</strong>
            <small>{{ t('export.perStudentHint') }}</small>
          </div>
        </label>
      </div>
    </div>
    <div class="row2">
      <div class="field">
        <span>{{ t('export.colors') }}</span>
        <div class="segmented">
          <button :class="{ on: props.options.color }" @click="props.options.color = true">{{ t('export.color') }}</button>
          <button :class="{ on: !props.options.color }" @click="props.options.color = false">{{ t('export.bw') }}</button>
        </div>
      </div>
      <div class="field">
        <span>{{ t('export.orientation') }}</span>
        <div class="segmented">
          <button :class="{ on: props.options.orientation === 'portrait' }" @click="props.options.orientation = 'portrait'">{{ t('export.portrait') }}</button>
          <button :class="{ on: props.options.orientation === 'landscape' }" @click="props.options.orientation = 'landscape'">{{ t('export.landscape') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.export-options {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.row2 {
  display: flex;
  gap: 28px;
  flex-wrap: wrap;
}
</style>
