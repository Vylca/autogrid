// CSV import for student lists (Pronote exports and simple lists).
// Only the class, last name and first name are kept. Every other column is ignored.

export function decodeBytes(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(u8);
  } catch {
    text = new TextDecoder('windows-1252').decode(u8);
  }
  return text.replace(/^﻿/, '');
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const candidates = [';', ',', '\t'];
  let best = ';';
  let bestCount = -1;
  for (const d of candidates) {
    const count = firstLine.split(d).length - 1;
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

export function parseCsv(text) {
  const d = detectDelimiter(text);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === d) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isUpperToken(tok) {
  const hasLetter = /\p{L}/u.test(tok);
  return hasLetter && tok === tok.toLocaleUpperCase('fr-FR') && tok !== tok.toLocaleLowerCase('fr-FR');
}

// "EJANGUE ESSAKA Darnell" -> { lastName: "EJANGUE ESSAKA", firstName: "Darnell" }
export function splitFullName(full) {
  const tokens = String(full || '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { lastName: '', firstName: '' };
  if (tokens.length === 1) return { lastName: tokens[0], firstName: '' };
  if (isUpperToken(tokens[0])) {
    let k = 0;
    while (k < tokens.length && isUpperToken(tokens[k])) k++;
    if (k === tokens.length) {
      return { lastName: tokens[0], firstName: tokens.slice(1).join(' ') };
    }
    return { lastName: tokens.slice(0, k).join(' '), firstName: tokens.slice(k).join(' ') };
  }
  // "Prénom NOM" order: trailing uppercase tokens are the last name.
  let k = tokens.length;
  while (k > 0 && isUpperToken(tokens[k - 1])) k--;
  if (k > 0 && k < tokens.length) {
    return { lastName: tokens.slice(k).join(' '), firstName: tokens.slice(0, k).join(' ') };
  }
  return { lastName: tokens[0], firstName: tokens.slice(1).join(' ') };
}

const FULL_NAME_HEADERS = ['eleves', 'eleve', 'nom et prenom', 'nom prenom', 'nom prenoms', 'nom complet', 'students', 'student', 'name', 'full name'];
const LAST_NAME_HEADERS = ['nom', 'nom de famille', 'last name', 'lastname', 'surname'];
const FIRST_NAME_HEADERS = ['prenom', 'prenoms', 'first name', 'firstname'];
const CLASS_HEADERS = ['classe de rattachement', 'classe', 'classes', 'division', 'class', 'groupe'];

function findColumn(header, candidates) {
  for (const c of candidates) {
    const idx = header.indexOf(c);
    if (idx !== -1) return idx;
  }
  return -1;
}

// Returns { students: [{lastName, firstName}], className, error }
export function extractStudents(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) return { students: [], className: '', error: 'empty' };
  const header = rows[0].map(norm);
  let fullIdx = findColumn(header, FULL_NAME_HEADERS);
  const lastIdx = findColumn(header, LAST_NAME_HEADERS);
  const firstIdx = findColumn(header, FIRST_NAME_HEADERS);
  const classIdx = findColumn(header, CLASS_HEADERS);
  let body = rows.slice(1);
  if (fullIdx === -1 && (lastIdx === -1 || firstIdx === -1)) {
    if (lastIdx !== -1) {
      fullIdx = lastIdx;
    } else {
      // No recognisable header: assume the first column holds full names.
      fullIdx = 0;
      body = rows;
    }
  }
  const students = [];
  const classCounts = {};
  for (const r of body) {
    let lastName;
    let firstName;
    if (lastIdx !== -1 && firstIdx !== -1 && fullIdx === -1) {
      lastName = (r[lastIdx] || '').trim();
      firstName = (r[firstIdx] || '').trim();
    } else {
      ({ lastName, firstName } = splitFullName(r[fullIdx]));
    }
    if (!lastName && !firstName) continue;
    students.push({ lastName, firstName });
    if (classIdx !== -1) {
      const c = (r[classIdx] || '').trim();
      if (c) classCounts[c] = (classCounts[c] || 0) + 1;
    }
  }
  const className = Object.entries(classCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  return { students, className, error: students.length ? null : 'noStudents' };
}

export function sameStudent(a, b) {
  return norm(a.lastName) === norm(b.lastName) && norm(a.firstName) === norm(b.firstName);
}
