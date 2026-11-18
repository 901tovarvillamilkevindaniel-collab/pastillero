// POST /api/device/events — el ESP32 reporta lo que pasó.
// Cuerpo: { "events": [ { "alarm_id": 1, "slot": 0, "type": "triggered", "device_time": "2026-11-18 07:00:00" } ] }
// Acepta hasta 50 de una vez para vaciar la cola después de un corte de WiFi.
import { endpoint, readBody, HttpError } from '../../lib/http.js';
import { select, insert } from '../../lib/db.js';
import { SLOTS, EVENT_TYPES, MAX_EVENTS_PER_POST } from '../../lib/constants.js';

export default endpoint({ methods: ['POST'], auth: 'device' }, async (req) => {
  const { events } = readBody(req);
  if (!Array.isArray(events) || !events.length) throw new HttpError(400, 'Envía "events" como una lista con al menos un evento.');
  if (events.length > MAX_EVENTS_PER_POST) throw new HttpError(400, `Máximo ${MAX_EVENTS_PER_POST} eventos por envío.`);

  const rows = events.map((e, i) => {
    if (!e || typeof e !== 'object') throw new HttpError(400, `El evento ${i} no es un objeto.`);
    if (!Number.isInteger(e.slot) || e.slot < 0 || e.slot >= SLOTS) throw new HttpError(400, `El evento ${i} tiene un compartimento inválido.`);
    if (!EVENT_TYPES.includes(e.type)) throw new HttpError(400, `El evento ${i} tiene un tipo desconocido. Usa ${EVENT_TYPES.join(', ')}.`);
    const alarmId = Number.isSafeInteger(e.alarm_id) && e.alarm_id > 0 ? e.alarm_id : null;
    const deviceTime = typeof e.device_time === 'string' ? e.device_time.slice(0, 32) : null;
    return { alarm_id: alarmId, slot: e.slot, type: e.type, device_time: deviceTime };
  });

  // Si la alarma se borró mientras el ESP32 estaba sin red, se guarda el evento sin alarm_id
  const ids = [...new Set(rows.map((r) => r.alarm_id).filter(Boolean))];
  if (ids.length) {
    const known = new Set((await select(`alarms?select=id&id=in.(${ids.join(',')})`)).map((a) => a.id));
    rows.forEach((r) => { if (r.alarm_id && !known.has(r.alarm_id)) r.alarm_id = null; });
  }

  const saved = await insert('events', rows, 'id');
  return { status: 201, body: { ok: true, saved: saved.length } };
});
