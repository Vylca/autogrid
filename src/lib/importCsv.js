import { decodeBytes, extractStudents } from './csv.js';
import { toast } from './store.js';
import { t } from './i18n.js';

// Opens a file dialog and returns { fileName, students, className } or null.
export async function pickCsv() {
  const file = await window.api.openCsv();
  if (!file) return null;
  const text = decodeBytes(file.bytes);
  const { students, className, error } = extractStudents(text);
  if (error) {
    toast(t('classes.importError', { file: file.name }), { kind: 'error', duration: 9000 });
    return null;
  }
  return { fileName: file.name, students, className };
}
