// Prueba los 7 endpoints de web/api contra el Supabase real, sin Vercel.
// Carga web/.env, llama cada handler con peticiones simuladas y al final
// borra todo lo que creó.
//
// Uso (desde la raíz del repo):  node tools/test_api.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const web = join(root, 'web');

// ---- cargar web/.env sin imprimir valores ----
for (const line of readFileSync(join(web, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}
const DEVICE = process.env.DEVICE_KEY;   // el portal es de acceso libre; solo el ESP32 usa clave

const load = async (p) => (await import(pathToFileURL(join(web, p)).href)).default;
const api = {
  state: await load('api/state.js'),
  alarms: await load('api/alarms/index.js'),
  alarm: await load('api/alarms/[id].js'),
  silence: await load('api/silence.js'),
  sync: await load('api/device/sync.js'),
  events: await load('api/device/events.js'),
};
const db = await import(pathToFileURL(join(web, 'lib/db.js')).href);

// ---- petición simulada ----
async function call(handler, { method = 'GET', key, keyHeader = 'x-device-key', body, query = {} } = {}) {
  const req = { method, query, body, headers: key ? { [keyHeader]: key } : {} };
  const res = {
    statusCode: 200, body: undefined, headers: {},
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    setHeader(k, v) { this.headers[k] = v; },
    end() { return this; },
  };
  await handler(req, res);
  return res;
}
const admin = (h, o = {}) => call(h, o);   // portal: sin clave
const device = (h, o = {}) => call(h, { ...o, key: DEVICE, keyHeader: 'x-device-key' });

// ---- mini framework ----
let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${extra}`); }
}
const show = (r) => `(HTTP ${r.statusCode} ${JSON.stringify(r.body)})`;

const start = new Date(Date.now() - 1000).toISOString();
const created = [];

try {
  console.log('\nAcceso');
  let r = await call(api.state);
  check('portal sin clave -> 200 (acceso libre)', r.statusCode === 200, show(r));
  r = await call(api.sync);
  check('ESP32 sin clave -> 401', r.statusCode === 401, show(r));
  r = await call(api.sync, { key: 'clave-falsa', keyHeader: 'x-device-key' });
  check('ESP32 con clave falsa -> 401', r.statusCode === 401, show(r));
  r = await call(api.events, { method: 'POST', body: { events: [{ slot: 0, type: 'missed' }] } });
  check('eventos sin clave del ESP32 -> 401', r.statusCode === 401, show(r));
  r = await admin(api.state, { method: 'POST' });
  check('método incorrecto -> 405', r.statusCode === 405 && r.headers.Allow === 'GET', show(r));

  console.log('\nGET /api/state');
  r = await admin(api.state);
  check('responde 200', r.statusCode === 200, show(r));
  check('trae alarms, events, device y clock', Array.isArray(r.body.alarms) && Array.isArray(r.body.events) && r.body.device && r.body.clock);
  const before = r.body.alarms.length;

  console.log('\nPOST /api/alarms');
  r = await admin(api.alarms, { method: 'POST', body: { slot: 0, time: '07:00', label: '  Prueba Losartán  ', days: [3, 1, 1, 7] } });
  check('crea alarma -> 201', r.statusCode === 201, show(r));
  const a1 = r.body.alarm; if (a1) created.push(a1.id);
  check('limpia el nombre y ordena/deduplica días', a1 && a1.label === 'Prueba Losartán' && JSON.stringify(a1.days) === '[1,3,7]', show(r));
  check('devuelve "time", no "alarm_time"', a1 && a1.time === '07:00' && !('alarm_time' in a1));
  r = await admin(api.alarms, { method: 'POST', body: { slot: 2, time: '21:00' } });
  const a2 = r.body.alarm; if (a2) created.push(a2.id);
  check('días y activa por defecto', a2 && JSON.stringify(a2.days) === '[1,2,3,4,5,6,7]' && a2.active === true, show(r));
  r = await admin(api.alarms, { method: 'POST', body: { slot: 4, time: '07:00' } });
  check('compartimento 5 (slot 4) ya no existe -> 400', r.statusCode === 400, show(r));
  r = await admin(api.alarms, { method: 'POST', body: { slot: 1, time: '7:00' } });
  check('hora "7:00" -> 400', r.statusCode === 400, show(r));
  r = await admin(api.alarms, { method: 'POST', body: { slot: 1, time: '08:00', days: [] } });
  check('sin días -> 400', r.statusCode === 400, show(r));
  r = await admin(api.alarms, { method: 'POST', body: { slot: 1, time: '08:00', label: 'x'.repeat(41) } });
  check('nombre de 41 letras -> 400', r.statusCode === 400, show(r));
  r = await admin(api.alarms, { method: 'POST', body: { slot: 0, time: '07:00' } });
  check('mismo compartimento y hora -> 409', r.statusCode === 409, show(r));

  console.log('\nPUT /api/alarms/:id');
  r = await admin(api.alarm, { method: 'PUT', query: { id: String(a1.id) }, body: { active: false } });
  check('solo { active:false } -> 200', r.statusCode === 200 && r.body.alarm.active === false && r.body.alarm.time === '07:00', show(r));
  r = await admin(api.alarm, { method: 'PUT', query: { id: String(a1.id) }, body: {} });
  check('sin cambios -> 400', r.statusCode === 400, show(r));
  r = await admin(api.alarm, { method: 'PUT', query: { id: '999999999' }, body: { active: true } });
  check('id que no existe -> 404', r.statusCode === 404, show(r));
  r = await admin(api.alarm, { method: 'PUT', query: { id: 'abc' }, body: { active: true } });
  check('id inválido -> 400', r.statusCode === 400, show(r));
  r = await admin(api.alarm, { method: 'PUT', query: { id: String(a2.id) }, body: { slot: 0, time: '07:00' } });
  check('mover a hora ocupada -> 409', r.statusCode === 409, show(r));

  console.log('\nGET /api/device/sync');
  r = await device(api.sync, { query: { ringing: '0', fw: 'prueba-1.0' } });
  check('responde 200', r.statusCode === 200, show(r));
  check('hora de Bogotá: desfase -300 min', r.body.clock?.utc_offset_min === -300 && r.body.clock.local.endsWith('-05:00'), JSON.stringify(r.body.clock));
  check('epoch cerca de la hora real', Math.abs(r.body.clock.epoch - Date.now() / 1000) < 10);
  check('solo manda alarmas activas', r.body.alarms.some((a) => a.id === a2.id) && !r.body.alarms.some((a) => a.id === a1.id), JSON.stringify(r.body.alarms));
  check('alarma del ESP32 sin label (ahorra memoria)', r.body.alarms.every((a) => !('label' in a)));
  check('poll normal 30 s', r.body.poll_s === 30);
  check('sin comandos', JSON.stringify(r.body.commands) === '[]', JSON.stringify(r.body.commands));

  console.log('\nPOST /api/silence + sync');
  r = await admin(api.silence, { method: 'POST' });
  check('silenciar -> 201', r.statusCode === 201, show(r));
  r = await device(api.sync, { query: { ringing: '1' } });
  check('el ESP32 recibe "silence"', JSON.stringify(r.body.commands) === '["silence"]', show(r));
  check('poll rápido 5 s mientras suena', r.body.poll_s === 5);
  r = await device(api.sync, { query: { ringing: '0' } });
  check('el comando no se repite', JSON.stringify(r.body.commands) === '[]', show(r));
  await db.insert('commands', { command: 'silence', created_at: new Date(Date.now() - 5 * 60000).toISOString() }, 'id');
  r = await device(api.sync, { query: { ringing: '0' } });
  check('comando de hace 5 min se descarta', JSON.stringify(r.body.commands) === '[]', show(r));

  console.log('\nPOST /api/device/events');
  r = await device(api.events, { method: 'POST', body: { events: [
    { alarm_id: a2.id, slot: 2, type: 'triggered', device_time: '2026-11-18 21:00:00' },
    { alarm_id: a2.id, slot: 2, type: 'silenced', device_time: '2026-11-18 21:00:40' },
    { alarm_id: 999999999, slot: 3, type: 'missed', device_time: '2026-11-18 21:10:00' },
  ] } });
  check('guarda 3 eventos -> 201', r.statusCode === 201 && r.body.saved === 3, show(r));
  r = await device(api.events, { method: 'POST', body: { events: [{ slot: 0, type: 'olvido' }] } });
  check('tipo desconocido -> 400', r.statusCode === 400, show(r));
  r = await device(api.events, { method: 'POST', body: { events: Array.from({ length: 51 }, () => ({ slot: 0, type: 'missed' })) } });
  check('51 eventos -> 400', r.statusCode === 400, show(r));
  r = await device(api.events, { method: 'POST', body: {} });
  check('sin lista -> 400', r.statusCode === 400, show(r));

  console.log('\nGET /api/state después');
  r = await admin(api.state);
  const evs = r.body.events.filter((e) => e.created_at >= start);
  check('historial con los 3 eventos, el más nuevo primero', evs.length === 3 && evs[0].type === 'missed', JSON.stringify(evs.map((e) => e.type)));
  check('alarma borrada queda con alarm_id null', evs[0].alarm_id === null);
  check('pastillero en línea con firmware', r.body.device.last_seen_at && Date.now() - Date.parse(r.body.device.last_seen_at) < 60000 && r.body.device.firmware === 'prueba-1.0', JSON.stringify(r.body.device));
  check('hay 2 alarmas más que al inicio', r.body.alarms.length === before + 2);

  console.log('\nDELETE /api/alarms/:id');
  r = await admin(api.alarm, { method: 'DELETE', query: { id: String(a2.id) } });
  check('eliminar -> 204', r.statusCode === 204, show(r));
  r = await admin(api.alarm, { method: 'DELETE', query: { id: String(a2.id) } });
  check('eliminar otra vez -> 404', r.statusCode === 404, show(r));
  const kept = await db.select(`events?select=alarm_id&created_at=gte.${encodeURIComponent(start)}&type=eq.triggered`);
  check('su historial se conserva (alarm_id null)', kept.length === 1 && kept[0].alarm_id === null, JSON.stringify(kept));
} catch (err) {
  fail++;
  console.error('\nError inesperado:', err);
} finally {
  // ---- limpieza ----
  const since = encodeURIComponent(start);
  for (const id of created) await db.remove(`alarms?id=eq.${id}`).catch(() => {});
  await db.remove(`events?created_at=gte.${since}`).catch(() => {});
  await db.remove(`commands?created_at=gte.${encodeURIComponent(new Date(Date.now() - 6 * 60000).toISOString())}`).catch(() => {});
  await db.update('device_status?id=eq.1', { last_seen_at: null, ringing: false, firmware: null }, 'id').catch(() => {});
  const left = await db.select('alarms?select=id');
  console.log(`\nLimpieza: quedan ${left.length} alarmas en la base.`);
  console.log(`\nResultado: ${pass} bien, ${fail} mal`);
  process.exitCode = fail ? 1 : 0;
}
