<script setup>
import { computed } from 'vue';
import { t } from '../lib/i18n.js';
import { sortStudents } from '../lib/model.js';
import { rolesOf, roleCount, groupSize, newGroup, groupSlots, roleMap, assignStudent, fillRandomly } from '../lib/groups.js';
import Icon from '../components/Icon.vue';

const props = defineProps({ exam: Object, cls: Object });

if (!Array.isArray(props.exam.groups)) props.exam.groups = [];

const roles = computed(() => rolesOf(props.exam.grid));
const students = computed(() => sortStudents(props.cls.students));
const byId = computed(() => Object.fromEntries(props.cls.students.map((s) => [s.id, s])));
const placed = computed(() => roleMap(props.exam));
const unassigned = computed(() => students.value.filter((s) => !placed.value[s.id]));
const sizeText = computed(() => roles.value.map((r) => `${r.name || t('common.untitled')} × ${roleCount(r)}`).join(', '));

function label(s) {
  return `${s.lastName} ${s.firstName}`.trim();
}

function options(current) {
  const list = unassigned.value.slice();
  if (current && byId.value[current]) list.unshift(byId.value[current]);
  return list;
}

function addGroup() {
  props.exam.groups.push(newGroup(props.exam.grid));
}

function removeGroup(i) {
  const g = props.exam.groups[i];
  const filled = groupSlots(props.exam.grid, g).some((s) => s.studentId);
  if (filled && !window.confirm(t('groups.confirmDelete', { n: i + 1 }))) return;
  props.exam.groups.splice(i, 1);
}

function setSlot(group, slot, studentId) {
  assignStudent(props.exam, group, slot.role.id, slot.index, studentId || null);
}

function randomFill() {
  fillRandomly(props.exam, students.value.map((s) => s.id));
}

function clearAll() {
  if (!window.confirm(t('groups.confirmClear'))) return;
  props.exam.groups.splice(0);
}
</script>

<template>
  <div class="groups">
    <div class="g-top">
      <p class="hint">{{ t('groups.size', { n: groupSize(props.exam.grid), roles: sizeText }) }}</p>
      <div class="row-actions">
        <button class="btn" @click="addGroup"><Icon name="plus" /> {{ t('groups.add') }}</button>
        <button class="btn" :disabled="!unassigned.length" @click="randomFill"><Icon name="users" /> {{ t('groups.random') }}</button>
        <button v-if="props.exam.groups.length" class="btn ghost danger" @click="clearAll">{{ t('groups.clear') }}</button>
      </div>
    </div>

    <div v-if="!props.exam.groups.length" class="empty">
      <h2>{{ t('groups.emptyTitle') }}</h2>
      <p>{{ t('groups.emptyText') }}</p>
      <div class="actions">
        <button class="btn primary" @click="randomFill"><Icon name="users" /> {{ t('groups.random') }}</button>
        <button class="btn" @click="addGroup"><Icon name="plus" /> {{ t('groups.add') }}</button>
      </div>
    </div>

    <div v-else class="g-grid">
      <section v-for="(g, gi) in props.exam.groups" :key="g.id" class="g-card">
        <header>
          <h3>{{ t('groups.name', { n: gi + 1 }) }}</h3>
          <button class="icon-btn danger" :title="t('common.delete')" @click="removeGroup(gi)"><Icon name="trash" :size="16" /></button>
        </header>
        <label v-for="slot in groupSlots(props.exam.grid, g)" :key="slot.role.id + slot.index" class="slot">
          <span class="slot-role">{{ slot.role.name || t('common.untitled') }}</span>
          <select class="input" :value="slot.studentId || ''" @change="setSlot(g, slot, $event.target.value)">
            <option value="">{{ t('groups.pick') }}</option>
            <option v-for="s in options(slot.studentId)" :key="s.id" :value="s.id">{{ label(s) }}</option>
          </select>
        </label>
      </section>
    </div>

    <section v-if="props.exam.groups.length" class="unassigned">
      <h3>{{ t('groups.unassigned', { n: unassigned.length }) }}</h3>
      <p v-if="!unassigned.length" class="hint">{{ t('groups.allPlaced') }}</p>
      <div v-else class="names">
        <span v-for="s in unassigned" :key="s.id" class="tag">{{ label(s) }}</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.g-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.g-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}
.g-card {
  padding: 12px 14px 14px;
  border: 1px solid var(--rule);
  border-top: 3px solid var(--accent);
  border-radius: var(--radius);
  background: var(--surface);
}
.g-card header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.slot {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}
.slot-role {
  font-size: 13px;
  font-weight: 700;
  color: var(--accent-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.slot .input {
  padding: 5px 8px;
}
.unassigned {
  margin-top: 22px;
}
.unassigned h3 {
  margin-bottom: 8px;
}
.names {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.names .tag {
  font-size: 13px;
  font-weight: 600;
  padding: 3px 8px;
}
</style>
