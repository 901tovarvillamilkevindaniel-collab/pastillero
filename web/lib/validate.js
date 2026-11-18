import { HttpError } from './http.js';
import { SLOTS, MAX_LABEL, TIME_RE } from './constants.js';

const bad = (msg) => new HttpError(400, msg);

/**
 * Valida una alarma que viene del portal.
 * @param {object} input
 * @param {{partial?: boolean}} opts  partial = PUT con solo algunos campos
 * @returns {object} fila lista para la tabla alarms
 */
export function parseAlarm(input, { partial = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw bad('Envía la alarma como un objeto JSON.');
  const row = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(input, k);

  if (has('slot') || !partial) {
    const s = input.slot;
    if (!Number.isInteger(s) || s < 0 || s >= SLOTS) throw bad(`El compartimento debe ser un número de 0 a ${SLOTS - 1}.`);
    row.slot = s;
  }
  if (has('time') || !partial) {
    if (typeof input.time !== 'string' || !TIME_RE.test(input.time)) throw bad('La hora debe tener formato HH:MM (00:00 a 23:59).');
    row.alarm_time = input.time;
  }
  if (has('label')) {
    if (input.label !== null && typeof input.label !== 'string') throw bad('El nombre del medicamento debe ser texto.');
    const label = (input.label || '').trim();
    if (label.length > MAX_LABEL) throw bad(`El nombre del medicamento admite hasta ${MAX_LABEL} caracteres.`);
    row.label = label;
  } else if (!partial) {
    row.label = '';
  }
  if (has('days') || !partial) {
    const d = input.days ?? [1, 2, 3, 4, 5, 6, 7];
    if (!Array.isArray(d) || !d.every((x) => Number.isInteger(x) && x >= 1 && x <= 7)) {
      throw bad('Los días deben ser números del 1 (lunes) al 7 (domingo).');
    }
    const days = [...new Set(d)].sort((a, b) => a - b);
    if (!days.length) throw bad('Elige al menos un día.');
    row.days = days;
  }
  if (has('active') || !partial) {
    const a = input.active ?? true;
    if (typeof a !== 'boolean') throw bad('"active" debe ser true o false.');
    row.active = a;
  }
  if (partial && !Object.keys(row).length) throw bad('No hay nada que cambiar.');
  return row;
}

// Id de la ruta /api/alarms/[id]
export function parseId(raw) {
  const id = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isSafeInteger(id) || id <= 0) throw bad('El id de la alarma no es válido.');
  return id;
}
