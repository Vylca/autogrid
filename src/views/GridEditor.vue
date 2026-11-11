<script setup>
import { computed } from 'vue';
import { t, lang } from '../lib/i18n.js';
import { ACQ_LEVELS, newCategory, newRole } from '../lib/model.js';
import { scaleInfo, snapHalf, usesRoles, hasRoles } from '../lib/bareme.js';
import { splitRoleGrids, mergeRoleGrids, roleGridsIdentical } from '../lib/groups.js';
import CountStepper from '../components/CountStepper.vue';
import { formatNumber } from '../lib/scoring.js';
import WeightInput from '../components/WeightInput.vue';
import ColorValues from '../components/ColorValues.vue';
import Icon from '../components/Icon.vue';
import CompetencesEditor from './CompetencesEditor.vue';
import PaliersEditor from './PaliersEditor.vue';

// exam: set when editing the grid of an assessment, so that marks follow a change of role mode.
const props = defineProps({ grid: Object, exam: { type: Object, default: null } });

const info = computed(() => scaleInfo(props.grid));
const isPal = computed(() => props.grid.type === 'paliers');
const locked = computed(() => !!props.grid.legacy);
const fmt = (v) => formatNumber(v, lang.value);
const colors = [...ACQ_LEVELS].reverse();

function setTarget(v) {
  const x = snapHalf(v);
  if (x >= 0.5 && x <= 1000) props.grid.target = x;
}

function setCategories(on) {
  const g = props.grid;
  if (on === g.useCategories) return;
  if (on) {
    g.useCategories = true;
    if (g.categories.length === 0) g.categories.push(newCategory(''));
    g.categories.forEach((c, i) => {
      if (!c.name) c.name = t('grid.categoryN', { n: i + 1 });
    });
    return;
  }
  if (g.categories.length > 1 && !window.confirm(t('grid.confirmMerge', { n: g.categories.length }))) return;
  const first = g.categories[0];
  first.rows = g.categories.flatMap((c) => c.rows);
  first.name = '';
  first.importance = 0;
  g.categories = [first];
  g.useCategories = false;
}

const roles = computed(() => usesRoles(props.grid));
// Roles with the same sheet for everyone: the roles are only names.
const sharedRoles = computed(() => hasRoles(props.grid) && !roles.value);

function setGroupWork(on) {
  const g = props.grid;
  if (on === !!g.groupWork) return;
  g.groupWork = on;
  if (!g.groupSize) g.groupSize = 2;
  if (!on) g.useRoles = false;
}

function ensureRoles(g) {
  if (!Array.isArray(g.roles)) g.roles = [];
  while (g.roles.length < 2) g.roles.push(newRole(t('grid.roleN', { n: g.roles.length + 1 })));
}

// With one grid per role, each category is a role with its own sheet.
function setRoles(on) {
  const g = props.grid;
  if (on === !!g.useRoles) return;
  g.useRoles = on;
  if (!on) return;
  if (!g.roleGrids) {
    ensureRoles(g);
    return;
  }
  g.useCategories = true;
  g.categories.forEach((c, i) => {
    if (!c.name) c.name = t('grid.roleN', { n: i + 1 });
    if (!c.count) c.count = 1;
  });
}

// Same grid for every role, or one grid per role. Marks follow each student's role.
function setRoleGrids(on) {
  const g = props.grid;
  if (on === !!g.roleGrids) return;
  if (on) {
    if (g.useCategories && g.categories.length > 1 && !window.confirm(t('grid.confirmSplitRoles'))) return;
    ensureRoles(g);
    splitRoleGrids(g, props.exam);
    return;
  }
  if (!roleGridsIdentical(g) && !window.confirm(t('grid.confirmMergeRoles', { name: g.categories[0]?.name || t('common.untitled') }))) return;
  mergeRoleGrids(g, props.exam);
}

function addRole() {
  props.grid.roles.push(newRole(t('grid.roleN', { n: props.grid.roles.length + 1 })));
}

function removeRole(i) {
  props.grid.roles.splice(i, 1);
}

function warningText(w) {
  const n = w.ids.length;
  if (w.type === 'zero') return t(isPal.value ? 'grid.warnZeroCrit' : 'grid.warnZero', { n });
  if (w.type === 'merged') return t(isPal.value ? 'grid.warnMergedCrit' : 'grid.warnMerged', { n });
  if (w.type === 'emptyRole') return t('grid.warnEmptyRole', { n });
  return t('grid.warnEmptyCategory', { n });
}

function leaveLegacy() {
  if (!window.confirm(t('grid.legacyConfirm'))) return;
  const g = props.grid;
  g.legacy = false;
  for (const c of g.categories || []) for (const r of c.rows) delete r.fixedPoints;
  for (const c of g.criteria || []) delete c.fixedPoints;
}
</script>

<template>
  <div class="grid-editor">
    <div v-if="locked" class="legacy">
      <Icon name="lock" :size="18" />
      <div class="l-body">
        <p><strong>{{ t('grid.legacyTitle') }}</strong></p>
        <p>{{ t('grid.legacyText') }}</p>
        <button class="btn small" @click="leaveLegacy">{{ t('grid.legacyLeave') }}</button>
      </div>
    </div>

    <section class="panel scale-panel">
      <div class="scale-top">
        <div class="field">
          <span>{{ t('grid.target') }}</span>
          <WeightInput :value="props.grid.target" :pinnable="false" unit="" @set="setTarget" />
        </div>
        <div class="field">
          <span>{{ roles ? t('grid.totalPerRole') : t('grid.total') }}</span>
          <strong class="total" :class="{ warn: info.total !== info.target }">{{ fmt(info.total) }} / {{ fmt(info.target) }}</strong>
        </div>
        <div v-if="!isPal" class="field">
          <span>{{ t('grid.groupWork') }}</span>
          <div class="segmented">
            <button :class="{ on: !props.grid.groupWork }" :disabled="locked" @click="setGroupWork(false)">{{ t('common.no') }}</button>
            <button :class="{ on: props.grid.groupWork }" :disabled="locked" @click="setGroupWork(true)">{{ t('common.yes') }}</button>
          </div>
        </div>
        <div v-if="!isPal && props.grid.groupWork" class="field">
          <span>{{ t('grid.withRoles') }}</span>
          <div class="segmented">
            <button :class="{ on: !props.grid.useRoles }" :disabled="locked" @click="setRoles(false)">{{ t('common.no') }}</button>
            <button :class="{ on: props.grid.useRoles }" :disabled="locked" @click="setRoles(true)">{{ t('common.yes') }}</button>
          </div>
        </div>
        <div v-if="!isPal && props.grid.groupWork && props.grid.useRoles" class="field">
          <span>{{ t('grid.roleGrids') }}</span>
          <div class="segmented">
            <button :class="{ on: !props.grid.roleGrids }" :disabled="locked" @click="setRoleGrids(false)">{{ t('common.no') }}</button>
            <button :class="{ on: props.grid.roleGrids }" :disabled="locked" @click="setRoleGrids(true)">{{ t('common.yes') }}</button>
          </div>
        </div>
        <div v-if="!isPal && props.grid.groupWork && !props.grid.useRoles" class="field">
          <span>{{ t('grid.groupSize') }}</span>
          <CountStepper v-model="props.grid.groupSize" :min="2" :max="8" />
        </div>
        <div v-if="!isPal && !roles" class="field">
          <span>{{ t('grid.useCategories') }}</span>
          <div class="segmented">
            <button :class="{ on: !props.grid.useCategories }" :disabled="locked" @click="setCategories(false)">{{ t('common.no') }}</button>
            <button :class="{ on: props.grid.useCategories }" :disabled="locked" @click="setCategories(true)">{{ t('common.yes') }}</button>
          </div>
        </div>
      </div>

      <div v-if="sharedRoles" class="roles-box">
        <span class="label">{{ t('grids.roleNames') }}</span>
        <p class="hint">{{ t('grids.sharedGridHint') }}</p>
        <div class="role-list">
          <div v-for="(r, i) in props.grid.roles" :key="r.id" class="role-item">
            <input v-model="r.name" class="input" :placeholder="t('grid.roleName')" />
            <CountStepper v-model="r.count" :label="t('grid.studentsPerRole')" />
            <button class="icon-btn danger" :disabled="props.grid.roles.length <= 1" :title="t('grid.deleteRole')" @click="removeRole(i)"><Icon name="trash" /></button>
          </div>
        </div>
        <button class="btn small" @click="addRole"><Icon name="plus" :size="15" /> {{ t('grid.addRole') }}</button>
      </div>

      <div v-if="info.warnings.length" class="warnings">
        <p v-for="w in info.warnings" :key="w.type"><Icon name="alert" :size="16" /> {{ warningText(w) }}</p>
      </div>

      <details class="advanced">
        <summary>{{ t('grid.advancedTitle') }}</summary>
        <div class="adv-list">
          <label v-if="!isPal" class="checkbox">
            <input v-model="props.grid.rowImportance" type="checkbox" :disabled="locked" />
            <span>{{ t('grid.rowImportance') }}</span>
          </label>
          <label v-if="isPal" class="checkbox">
            <input v-model="props.grid.cellOverride" type="checkbox" />
            <span>{{ t('grid.cellOverride') }}</span>
          </label>
          <label class="checkbox">
            <input v-model="props.grid.categoryComments" type="checkbox" />
            <span>{{ isPal ? t('grid.criterionComments') : roles || props.grid.groupWork ? t('grid.rowComments') : props.grid.useCategories ? t('grid.categoryComments') : t('grid.rowComments') }}</span>
          </label>
        </div>
      </details>

      <div v-if="!isPal" class="steps">
        <span class="label">{{ t('grid.stepsTitle') }}</span>
        <p class="hint">{{ t('grid.stepsHint') }}</p>
        <div class="legend">
          <span v-for="l in colors" :key="l.code" class="legend-item">
            <span class="acq-swatch" :style="{ background: l.color }"></span>{{ t('acq.' + l.key) }}
          </span>
        </div>
        <div class="example"><span class="hint">{{ t('grid.stepsExample') }}</span> <ColorValues :max="5" /></div>
      </div>
    </section>

    <CompetencesEditor v-if="!isPal" :grid="props.grid" :info="info" :locked="locked" />
    <PaliersEditor v-else :grid="props.grid" :info="info" :locked="locked" />
  </div>
</template>

<style scoped>
.grid-editor {
  max-width: 1100px;
}
.legacy {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px 14px;
  border-left: 3px solid var(--accent);
  background: var(--accent-soft);
  color: var(--accent-ink);
}
.l-body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  color: var(--ink);
}
.scale-top {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 18px 36px;
}
.total {
  display: inline-block;
  padding: 5px 0;
  font-size: 17px;
  font-variant-numeric: tabular-nums;
}
.total.warn {
  color: var(--accent-ink);
}
.roles-box {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--rule);
}
.role-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin: 8px 0 10px;
}
.role-item {
  display: flex;
  align-items: center;
  gap: 6px;
}
.role-item .input {
  width: 190px;
}
.warnings {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 14px;
  padding: 10px 12px;
  border-left: 3px solid #c77700;
  background: #fff6e5;
  font-size: 14px;
}
.warnings p {
  display: flex;
  align-items: center;
  gap: 8px;
}
.advanced {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--rule);
}
.advanced summary {
  font-size: 13px;
  font-weight: 700;
  color: var(--ink-2);
  cursor: pointer;
}
.adv-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
  font-size: 14px;
}
.steps {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--rule);
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  margin: 8px 0;
  font-size: 14px;
}
.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}
.example {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
