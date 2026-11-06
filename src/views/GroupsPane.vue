<script setup>
import { computed, ref } from 'vue';
import { t } from '../lib/i18n.js';
import { toast } from '../lib/store.js';
import { sortStudents } from '../lib/model.js';
import {
  rolesOf,
  roleCount,
  groupSize,
  newGroup,
  groupSlots,
  roleMap,
  groupNumbers,
  placeStudent,
  moveStudent,
  addToGroup,
  clearSlot,
  moveGroup,
  fillRandomly,
} from '../lib/groups.js';
import Icon from '../components/Icon.vue';

const props = defineProps({ exam: Object, cls: Object });

if (!Array.isArray(props.exam.groups)) props.exam.groups = [];

const withRoles = computed(() => !!props.exam.grid.useRoles);
const roles = computed(() => rolesOf(props.exam.grid));
const roleName = computed(() => Object.fromEntries(roles.value.map((r) => [r.id, r.name || t('common.untitled')])));
const students = computed(() => sortStudents(props.cls.students));
const byId = computed(() => Object.fromEntries(props.cls.students.map((s) => [s.id, s])));
const placed = computed(() => roleMap(props.exam));
const numbers = computed(() => groupNumbers(props.exam));
const unassigned = computed(() => students.value.filter((s) => !placed.value[s.id]));
const assigned = computed(() => students.value.filter((s) => placed.value[s.id]));
const sizeText = computed(() =>
  withRoles.value ? roles.value.map((r) => `${r.name || t('common.untitled')} × ${roleCount(r)}`).join(', ') : t('groups.sameSheet'),
);

function label(s) {
  return s ? `${s.lastName} ${s.firstName}`.trim() : '';
}

function where(id) {
  const n = numbers.value[id];
  return n ? n.join(', ') : '';
}

// ---- Drag and drop ----------------------------------------------------------------
// What is being dragged: { kind: 'student', studentId, from: slot ref | null } or { kind: 'group', index }.
const dragging = ref(null);
const over = ref(null);

function startStudent(e, studentId, from = null) {
  dragging.value = { kind: 'student', studentId, from };
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', studentId);
}

function startGroup(e, index) {
  dragging.value = { kind: 'group', index };
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', `group-${index}`);
}

function endDrag() {
  dragging.value = null;
  over.value = null;
}

function allow(e, key, kinds) {
  if (!dragging.value || !kinds.includes(dragging.value.kind)) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  over.value = key;
}

function leave(key) {
  if (over.value === key) over.value = null;
}

function report(res, studentId, groupIndex) {
  if (res.ok) return;
  const name = label(byId.value[studentId]);
  if (res.reason === 'role') toast(t('groups.roleConflict', { name, role: roleName.value[res.roleId] || '' }), { kind: 'error' });
  else if (res.reason === 'full') toast(t('groups.full', { n: groupIndex + 1 }), { kind: 'error' });
}

function dropOnSlot(e, group, gi, slot) {
  e.preventDefault();
  e.stopPropagation();
  const d = dragging.value;
  endDrag();
  if (!d || d.kind !== 'student') return;
  const to = { groupId: group.id, roleId: slot.role.id, index: slot.index };
  const res = d.from ? moveStudent(props.exam, d.from, to) : placeStudent(props.exam, group, slot.role.id, slot.index, d.studentId);
  report(res, d.studentId, gi);
}

function dropOnCard(e, group, gi) {
  e.preventDefault();
  const d = dragging.value;
  endDrag();
  if (!d) return;
  if (d.kind === 'group') {
    moveGroup(props.exam, d.index, gi);
    return;
  }
  if (d.from && d.from.groupId === group.id) return;
  if (d.from) clearSlot(props.exam, d.from);
  const res = addToGroup(props.exam, group, d.studentId);
  if (!res.ok && d.from) {
    const back = props.exam.groups.find((g) => g.id === d.from.groupId);
    if (back) placeStudent(props.exam, back, d.from.roleId, d.from.index, d.studentId);
  }
  report(res, d.studentId, gi);
}

function dropOnPool(e) {
  e.preventDefault();
  const d = dragging.value;
  endDrag();
  if (d?.kind === 'student' && d.from) clearSlot(props.exam, d.from);
}

// ---- Buttons and lists -------------------------------------------------------------

function pick(group, gi, slot, studentId) {
  report(placeStudent(props.exam, group, slot.role.id, slot.index, studentId || null), studentId, gi);
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

function randomFill() {
  fillRandomly(props.exam, students.value.map((s) => s.id));
}

function clearAll() {
  if (!window.confirm(t('groups.confirmClear'))) return;
  props.exam.groups.splice(0);
}

function slotKey(g, slot) {
  return `${g.id}:${slot.role.id}:${slot.index}`;
}
</script>

<template>
  <div class="groups" :class="{ dragging: !!dragging }">
    <div class="g-top">
      <p class="hint">{{ t('groups.size', { n: groupSize(props.exam.grid), roles: sizeText }) }} {{ t('groups.dragHint') }}</p>
      <div class="row-actions">
        <button class="btn" @click="addGroup"><Icon name="plus" /> {{ t('groups.add') }}</button>
        <button class="btn" :disabled="!unassigned.length" @click="randomFill"><Icon name="users" /> {{ t('groups.random') }}</button>
        <button v-if="props.exam.groups.length" class="btn ghost danger" @click="clearAll">{{ t('groups.clear') }}</button>
      </div>
    </div>

    <div class="layout">
      <div class="g-main">
        <div v-if="!props.exam.groups.length" class="empty">
          <h2>{{ t('groups.emptyTitle') }}</h2>
          <p>{{ t('groups.emptyText') }}</p>
          <div class="actions">
            <button class="btn primary" @click="randomFill"><Icon name="users" /> {{ t('groups.random') }}</button>
            <button class="btn" @click="addGroup"><Icon name="plus" /> {{ t('groups.add') }}</button>
          </div>
        </div>

        <div v-else class="g-grid">
          <section
            v-for="(g, gi) in props.exam.groups"
            :key="g.id"
            class="g-card"
            :class="{ over: over === 'card:' + g.id, lifted: dragging?.kind === 'group' && dragging.index === gi }"
            @dragover="allow($event, 'card:' + g.id, ['student', 'group'])"
            @dragleave="leave('card:' + g.id)"
            @drop="dropOnCard($event, g, gi)"
          >
            <header draggable="true" :title="t('groups.dragGroup')" @dragstart="startGroup($event, gi)" @dragend="endDrag">
              <span class="grip"><Icon name="grip" :size="16" /></span>
              <h3>{{ t('groups.name', { n: gi + 1 }) }}</h3>
              <span class="spacer"></span>
              <button class="icon-btn" :disabled="gi === 0" :title="t('groups.moveEarlier')" @click="moveGroup(props.exam, gi, gi - 1)"><Icon name="left" :size="16" /></button>
              <button class="icon-btn" :disabled="gi === props.exam.groups.length - 1" :title="t('groups.moveLater')" @click="moveGroup(props.exam, gi, gi + 1)"><Icon name="right" :size="16" /></button>
              <button class="icon-btn danger" :title="t('common.delete')" @click="removeGroup(gi)"><Icon name="trash" :size="16" /></button>
            </header>
            <div v-for="slot in groupSlots(props.exam.grid, g)" :key="slot.role.id + slot.index" class="slot">
              <span class="slot-role">{{ withRoles ? slot.role.name || t('common.untitled') : t('groups.member', { n: slot.index + 1 }) }}</span>
              <div
                class="drop"
                :class="{ over: over === 'slot:' + slotKey(g, slot), filled: !!slot.studentId }"
                @dragover.stop="allow($event, 'slot:' + slotKey(g, slot), ['student'])"
                @dragleave="leave('slot:' + slotKey(g, slot))"
                @drop="dropOnSlot($event, g, gi, slot)"
              >
                <span
                  v-if="slot.studentId"
                  class="chip"
                  draggable="true"
                  @dragstart.stop="startStudent($event, slot.studentId, { groupId: g.id, roleId: slot.role.id, index: slot.index })"
                  @dragend="endDrag"
                >
                  <span class="chip-name">{{ label(byId[slot.studentId]) || '?' }}</span>
                  <span v-if="numbers[slot.studentId]?.length > 1" class="also" :title="t('groups.alsoIn', { list: where(slot.studentId), n: numbers[slot.studentId].length })">×{{ numbers[slot.studentId].length }}</span>
                  <button class="chip-x" :title="t('groups.removeFromGroup')" @click="clearSlot(props.exam, { groupId: g.id, roleId: slot.role.id, index: slot.index })"><Icon name="x" :size="13" /></button>
                </span>
                <select v-else class="slot-select" :value="''" :aria-label="t('groups.pick')" @change="pick(g, gi, slot, $event.target.value)">
                  <option value="">{{ t('groups.dropHere') }}</option>
                  <option v-for="s in unassigned" :key="s.id" :value="s.id">{{ label(s) }}</option>
                  <optgroup v-if="assigned.length" :label="t('groups.alreadyPlaced')">
                    <option v-for="s in assigned" :key="s.id" :value="s.id">{{ label(s) }} ({{ t('groups.inGroups', { list: where(s.id), n: numbers[s.id].length }) }})</option>
                  </optgroup>
                </select>
              </div>
            </div>
          </section>
        </div>
      </div>

      <aside
        class="pool"
        :class="{ over: over === 'pool' }"
        @dragover="allow($event, 'pool', ['student'])"
        @dragleave="leave('pool')"
        @drop="dropOnPool"
      >
        <h3>{{ t('groups.unassigned', { n: unassigned.length }) }}</h3>
        <p v-if="!unassigned.length" class="hint">{{ t('groups.allPlaced') }}</p>
        <div class="names">
          <span v-for="s in unassigned" :key="s.id" class="chip" draggable="true" @dragstart="startStudent($event, s.id)" @dragend="endDrag">
            <span class="chip-name">{{ label(s) }}</span>
          </span>
        </div>
        <template v-if="assigned.length">
          <h3 class="second">{{ t('groups.alreadyPlaced') }}</h3>
          <p class="hint">{{ t('groups.duplicateHint') }}</p>
          <div class="names">
            <span v-for="s in assigned" :key="s.id" class="chip placed" draggable="true" @dragstart="startStudent($event, s.id)" @dragend="endDrag">
              <span class="chip-name">{{ label(s) }}</span>
              <span class="also">{{ where(s.id) }}</span>
            </span>
          </div>
        </template>
      </aside>
    </div>
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
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 18px;
  align-items: start;
}
.g-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
  gap: 14px;
}
.g-card {
  padding: 0 12px 12px;
  border: 1px solid var(--rule);
  border-top: 3px solid var(--accent);
  border-radius: var(--radius);
  background: var(--surface);
  transition: box-shadow 0.1s ease;
}
.g-card.over {
  box-shadow: 0 0 0 3px var(--accent-soft), 0 0 0 4px var(--accent);
}
.g-card.lifted {
  opacity: 0.45;
}
.g-card header {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0 -12px 6px;
  padding: 8px 6px 8px 8px;
  cursor: grab;
}
.g-card header:active {
  cursor: grabbing;
}
.grip {
  display: inline-flex;
  color: var(--ink-3);
}
.spacer {
  flex: 1;
}
.slot {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
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
.drop {
  display: flex;
  align-items: center;
  min-height: 36px;
  border: 1.5px dashed var(--rule-strong);
  border-radius: var(--radius);
  background: var(--paper);
}
.drop.filled {
  border-style: solid;
  border-color: transparent;
  background: none;
}
.groups.dragging .drop {
  border-color: var(--accent);
}
.drop.over {
  border-style: solid;
  border-color: var(--accent);
  background: var(--accent-soft);
}
.slot-select {
  width: 100%;
  height: 34px;
  padding: 0 8px;
  border: 0;
  background: none;
  color: var(--ink-3);
  font-size: 13px;
  cursor: pointer;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 5px 6px 5px 10px;
  border: 1px solid var(--rule-strong);
  border-radius: 999px;
  background: var(--surface);
  font-size: 13px;
  font-weight: 600;
  cursor: grab;
  user-select: none;
}
.drop .chip {
  width: 100%;
  border-radius: var(--radius);
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-ink);
}
.chip:active {
  cursor: grabbing;
}
.chip-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.also {
  flex: none;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--paper);
  font-size: 11px;
  font-weight: 800;
  color: var(--ink-2);
}
.chip-x {
  display: inline-flex;
  padding: 2px;
  border: 0;
  border-radius: 50%;
  background: none;
  color: inherit;
  cursor: pointer;
}
.chip-x:hover {
  background: rgba(39, 71, 176, 0.15);
}
.pool {
  position: sticky;
  top: 12px;
  max-height: calc(100vh - 220px);
  overflow: auto;
  padding: 12px 14px 14px;
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--surface);
}
.pool.over {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.pool h3 {
  margin-bottom: 8px;
}
.pool h3.second {
  margin-top: 16px;
  margin-bottom: 2px;
}
.pool .hint {
  margin-bottom: 8px;
}
.names {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip.placed {
  color: var(--ink-2);
  background: var(--paper);
}
@media (max-width: 900px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .pool {
    position: static;
    order: -1;
    max-height: none;
  }
}
</style>
