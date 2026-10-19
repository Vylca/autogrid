<script setup>
import { ref, watch } from 'vue';
import Icon from './Icon.vue';
import { t, lang } from '../lib/i18n.js';
import { formatNumber } from '../lib/scoring.js';

const props = defineProps({
  value: Number,
  pinned: Boolean,
  pinnable: { type: Boolean, default: true },
  unit: { type: String, default: 'pts' },
});
const emit = defineEmits(['set', 'unpin']);

const text = ref('');
const sync = () => (text.value = formatNumber(props.value, lang.value, 2));
watch(() => [props.value, lang.value], sync, { immediate: true });

function commit() {
  const v = parseFloat(String(text.value).replace(',', '.').replace(/\s/g, ''));
  if (Number.isFinite(v) && Math.abs(v - props.value) > 1e-9) emit('set', v);
  sync();
}
</script>

<template>
  <span class="weight" :class="{ pinned: props.pinned && props.pinnable }">
    <input
      v-model="text"
      inputmode="decimal"
      @change="commit"
      @keydown.enter.prevent="$event.target.blur()"
      @focus="$event.target.select()"
    />
    <span class="unit">{{ props.unit }}</span>
    <button
      v-if="props.pinnable"
      class="pin"
      :class="{ off: !props.pinned }"
      :title="props.pinned ? t('weight.unpin') : t('weight.auto')"
      :tabindex="props.pinned ? 0 : -1"
      @click="props.pinned && emit('unpin')"
    >
      <Icon name="pin" :size="14" />
    </button>
  </span>
</template>
