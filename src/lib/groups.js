// Group work: roles live in the grid (its categories), groups live in the exam.
// exam.groups = [{ id, slots: { [roleId]: [studentId | null, ...] } }]
import { uid } from './model.js';
import { scoreStudent } from './scoring.js';

export function rolesOf(grid) {
  return grid.groupWork ? grid.categories || [] : [];
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

// studentId -> { roleId, groupId, groupIndex }
export function roleMap(exam) {
  const map = {};
  const roles = new Set(rolesOf(exam.grid).map((r) => r.id));
  (exam.groups || []).forEach((g, gi) => {
    for (const [roleId, ids] of Object.entries(g.slots || {})) {
      if (!roles.has(roleId)) continue;
      for (const id of ids) if (id) map[id] = { roleId, groupId: g.id, groupIndex: gi };
    }
  });
  return map;
}

export function studentRole(exam, studentId) {
  return roleMap(exam)[studentId]?.roleId || null;
}

export function examScore(exam, studentId, map = null) {
  const result = exam.results?.[studentId];
  if (!exam.grid.groupWork) return scoreStudent(exam.grid, result);
  const roleId = (map || roleMap(exam))[studentId]?.roleId;
  return scoreStudent(exam.grid, result, roleId);
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

// Puts a student in a slot, removing them from wherever they were before.
export function assignStudent(exam, group, roleId, index, studentId) {
  for (const g of exam.groups || []) {
    for (const ids of Object.values(g.slots || {})) {
      for (let i = 0; i < ids.length; i++) if (studentId && ids[i] === studentId) ids[i] = null;
    }
  }
  if (!group.slots[roleId]) group.slots[roleId] = [];
  while (group.slots[roleId].length <= index) group.slots[roleId].push(null);
  group.slots[roleId][index] = studentId || null;
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
      if (!slot.studentId) assignStudent(exam, g, slot.role.id, slot.index, queue.shift());
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
