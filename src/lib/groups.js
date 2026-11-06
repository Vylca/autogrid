// Group work: roles live in the grid (its categories), groups live in the exam.
// exam.groups = [{ id, slots: { [roleId]: [studentId | null, ...] } }]
import { uid } from './model.js';
import { scoreStudent, noRoleScore } from './scoring.js';
import { scaleInfo, usesRoles } from './bareme.js';

// Group work without roles: every member has the same sheet. The group then
// has a single kind of slot, repeated groupSize times.
export const MEMBER_ROLE = 'member';

export function rolesOf(grid) {
  if (!grid.groupWork) return [];
  if (grid.useRoles) return grid.categories || [];
  return [{ id: MEMBER_ROLE, name: '', count: grid.groupSize || 2 }];
}

export function roleCount(role) {
  const n = Math.round(Number(role?.count));
  return n >= 1 ? Math.min(n, 8) : 1;
}

export function groupSize(grid) {
  return rolesOf(grid).reduce((n, r) => n + roleCount(r), 0);
}

export function newGroup(grid) {
  const slots = {};
  for (const r of rolesOf(grid)) slots[r.id] = Array(roleCount(r)).fill(null);
  return { id: uid(), slots };
}

// Slots of a group in role order, padded to each role's student count.
export function groupSlots(grid, group) {
  const out = [];
  for (const role of rolesOf(grid)) {
    const arr = group.slots?.[role.id] || [];
    const n = Math.max(roleCount(role), arr.length);
    for (let i = 0; i < n; i++) out.push({ role, index: i, studentId: arr[i] || null });
  }
  return out;
}

export function groupMembers(grid, group) {
  return groupSlots(grid, group).filter((s) => s.studentId);
}

// studentId -> { roleId, groupId, groupIndex } of their first group.
// A student can be in several groups but always keeps the same role and sheet.
export function roleMap(exam) {
  const map = {};
  const roles = new Set(rolesOf(exam.grid).map((r) => r.id));
  (exam.groups || []).forEach((g, gi) => {
    for (const [roleId, ids] of Object.entries(g.slots || {})) {
      if (!roles.has(roleId)) continue;
      for (const id of ids) if (id && !map[id]) map[id] = { roleId, groupId: g.id, groupIndex: gi };
    }
  });
  return map;
}

// studentId -> [group numbers starting at 1], in group order.
export function groupNumbers(exam) {
  const out = {};
  (exam.groups || []).forEach((g, gi) => {
    for (const ids of Object.values(g.slots || {})) {
      for (const id of ids) {
        if (!id) continue;
        if (!out[id]) out[id] = [];
        if (!out[id].includes(gi + 1)) out[id].push(gi + 1);
      }
    }
  });
  return out;
}

export function studentRole(exam, studentId) {
  return roleMap(exam)[studentId]?.roleId || null;
}

export function examScore(exam, studentId, map = null) {
  const result = exam.results?.[studentId];
  if (!exam.grid.groupWork) return scoreStudent(exam.grid, result);
  const placed = (map || roleMap(exam))[studentId];
  if (!placed) return noRoleScore(scaleInfo(exam.grid));
  return usesRoles(exam.grid) ? scoreStudent(exam.grid, result, placed.roleId) : scoreStudent(exam.grid, result);
}

export function examAverage(exam, studentIds) {
  const map = exam.grid.groupWork ? roleMap(exam) : null;
  const scores = [];
  for (const id of studentIds) {
    const s = examScore(exam, id, map);
    if (s.status === 'complete' && s.score !== null) scores.push(s.score);
  }
  if (!scores.length) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function findGroup(exam, groupId) {
  return (exam.groups || []).find((g) => g.id === groupId) || null;
}

function slotArray(group, roleId) {
  if (!group.slots[roleId]) group.slots[roleId] = [];
  return group.slots[roleId];
}

function setSlot(group, roleId, index, studentId) {
  const arr = slotArray(group, roleId);
  while (arr.length <= index) arr.push(null);
  arr[index] = studentId || null;
}

export function slotStudent(exam, ref) {
  const g = findGroup(exam, ref.groupId);
  return g?.slots?.[ref.roleId]?.[ref.index] || null;
}

// With roles, the role a student already has elsewhere (ignoring one slot), or null.
export function roleElsewhere(exam, studentId, ignore = null) {
  if (!usesRoles(exam.grid)) return null;
  const roles = new Set(rolesOf(exam.grid).map((r) => r.id));
  for (const g of exam.groups || []) {
    for (const [roleId, ids] of Object.entries(g.slots || {})) {
      if (!roles.has(roleId)) continue;
      for (let i = 0; i < ids.length; i++) {
        if (ids[i] !== studentId) continue;
        if (ignore && ignore.groupId === g.id && ignore.roleId === roleId && ignore.index === i) continue;
        return roleId;
      }
    }
  }
  return null;
}

// Puts a student in a slot. They stay in their other groups (same sheet), but
// appear only once per group, and keep the same role everywhere.
// Returns { ok: true } or { ok: false, reason: 'role', roleId }.
export function placeStudent(exam, group, roleId, index, studentId) {
  if (!studentId) {
    setSlot(group, roleId, index, null);
    return { ok: true };
  }
  const other = roleElsewhere(exam, studentId, { groupId: group.id, roleId, index });
  if (other && other !== roleId) return { ok: false, reason: 'role', roleId: other };
  for (const [rid, ids] of Object.entries(group.slots || {})) {
    ids.forEach((id, i) => {
      if (id === studentId && !(rid === roleId && i === index)) ids[i] = null;
    });
  }
  setSlot(group, roleId, index, studentId);
  return { ok: true };
}

// Kept for older callers: places the student and removes them from every other group.
export function assignStudent(exam, group, roleId, index, studentId) {
  for (const g of exam.groups || []) {
    for (const ids of Object.values(g.slots || {})) {
      for (let i = 0; i < ids.length; i++) if (studentId && ids[i] === studentId) ids[i] = null;
    }
  }
  setSlot(group, roleId, index, studentId);
}

export function clearSlot(exam, ref) {
  const g = findGroup(exam, ref.groupId);
  if (g) setSlot(g, ref.roleId, ref.index, null);
}

// Drag from one slot to another. An occupied target swaps places when roles allow.
export function moveStudent(exam, from, to) {
  if (from.groupId === to.groupId && from.roleId === to.roleId && from.index === to.index) return { ok: true };
  const gFrom = findGroup(exam, from.groupId);
  const gTo = findGroup(exam, to.groupId);
  const moving = slotStudent(exam, from);
  if (!gFrom || !gTo || !moving) return { ok: false, reason: 'missing' };
  const target = slotStudent(exam, to);
  const snapshot = JSON.stringify([gFrom.slots, gTo.slots]);
  setSlot(gFrom, from.roleId, from.index, null);
  setSlot(gTo, to.roleId, to.index, null);
  let res = placeStudent(exam, gTo, to.roleId, to.index, moving);
  if (res.ok && target) res = placeStudent(exam, gFrom, from.roleId, from.index, target);
  if (!res.ok) {
    const [a, b] = JSON.parse(snapshot);
    gFrom.slots = a;
    if (gTo !== gFrom) gTo.slots = b;
  }
  return res;
}

// Drop on a group card: first free slot the student can take.
export function addToGroup(exam, group, studentId) {
  const role = roleElsewhere(exam, studentId, null);
  const slots = groupSlots(exam.grid, group);
  if (slots.some((s) => s.studentId === studentId)) return { ok: true };
  const free = slots.find((s) => !s.studentId && (!role || s.role.id === role));
  if (!free) return { ok: false, reason: role ? 'role' : 'full', roleId: role };
  return placeStudent(exam, group, free.role.id, free.index, studentId);
}

export function moveGroup(exam, fromIndex, toIndex) {
  const list = exam.groups || [];
  if (fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex >= list.length) return;
  const [g] = list.splice(fromIndex, 1);
  list.splice(toIndex, 0, g);
}

function shuffle(list, rng) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Fills empty slots, then new groups, with the students not yet in a group, at random.
export function fillRandomly(exam, studentIds, rng = Math.random) {
  if (!exam.groups) exam.groups = [];
  const placed = roleMap(exam);
  const queue = shuffle(studentIds.filter((id) => !placed[id]), rng);
  const fillGroup = (g) => {
    for (const slot of groupSlots(exam.grid, g)) {
      if (!queue.length) return;
      if (!slot.studentId) placeStudent(exam, g, slot.role.id, slot.index, queue.shift());
    }
  };
  exam.groups.forEach(fillGroup);
  while (queue.length && groupSize(exam.grid) > 0) {
    const g = newGroup(exam.grid);
    exam.groups.push(g);
    fillGroup(g);
  }
  return exam.groups;
}
