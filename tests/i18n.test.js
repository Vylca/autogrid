import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { dictionaries } from '../src/lib/i18n.js';
import { ACQ_LEVELS, SPECIAL_MARKS, PLACEMENT_PRESETS } from '../src/lib/model.js';
import { ACTIVITIES } from '../src/lib/descriptors.js';

function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(vue|js)$/.test(f) ? [p] : [];
  });
}

test('every translation key used in the code exists in French and English', () => {
  const used = new Set();
  for (const f of files('src')) {
    const src = readFileSync(f, 'utf-8');
    for (const m of src.matchAll(/\bt(?:For)?\((?:[a-zA-Z.]+, )?'([a-zA-Z0-9_.]+)'/g)) {
      if (!m[1].endsWith('.')) used.add(m[1]);
    }
  }
  for (const l of ACQ_LEVELS) used.add(`acq.${l.key}`);
  for (const s of SPECIAL_MARKS) used.add(`acq.${s.key}`);
  for (const p of PLACEMENT_PRESETS) used.add(`preset.${p.id}`);
  for (const a of ACTIVITIES) used.add(`activity.${a}`);
  for (const s of ['empty', 'partial', 'complete', 'absent', 'exempt']) used.add(`status.${s}`);
  const missing = [];
  for (const key of used) {
    for (const [lang, dict] of Object.entries(dictionaries)) if (!(key in dict)) missing.push(`${lang}:${key}`);
  }
  assert.deepEqual(missing, []);
  assert.deepEqual(Object.keys(dictionaries.fr).sort(), Object.keys(dictionaries.en).sort());
});
