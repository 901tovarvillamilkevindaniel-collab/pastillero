// Prueba rápida de la API ya desplegada en Vercel (no toca nada que no limpie).
// Uso:  node tools/test_prod.mjs [https://pastillero-test11-c4c7.vercel.app]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = {};
for (const line of readFileSync(join(root, 'web', '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const BASE = (process.argv[2] || 'https://pastillero-test11-c4c7.vercel.app').replace(/\/$/, '');

async function req(path, { method = 'GET', key, header = 'x-device-key', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (key) headers[header] = key;
  const r = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch {}
  return { status: r.status, json, text, type: r.headers.get('content-type') || '' };
}
const admin = (p, o = {}) => req(p, o);   // portal: acceso libre, sin clave
const device = (p, o = {}) => req(p, { ...o, key: env.DEVICE_KEY, header: 'x-device-key' });

let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : ' ' + extra}`); };

console.log(`Probando ${BASE}\n`);
let r = await req('/');
check('portal responde HTML', r.status === 200 && r.type.includes('text/html'), `(HTTP ${r.status})`);
check('portal es el completo (tiene el modal)', r.text.includes('id="alarmDialog"'), '(es otra versión)');
check('portal sin pantalla de clave', !r.text.includes('id="login"') && !r.text.includes('x-admin-key'));
r = await req('/api/device/sync');
check('ESP32 sin clave -> 401', r.status === 401, `(HTTP ${r.status} ${r.text.slice(0, 120)})`);
r = await admin('/api/state');
check('GET /api/state -> 200', r.status === 200 && Array.isArray(r.json?.alarms), `(HTTP ${r.status} ${r.text.slice(0, 160)})`);
r = await device('/api/device/sync?ringing=0&fw=prueba-prod');
check('ESP32 sync -> 200', r.status === 200, `(HTTP ${r.status} ${r.text.slice(0, 160)})`);
check('hora de Bogotá -300 min', r.json?.clock?.utc_offset_min === -300, JSON.stringify(r.json?.clock));
r = await admin('/api/alarms', { method: 'POST', body: { slot: 3, time: '23:59', label: 'Prueba producción' } });
check('crear alarma -> 201', r.status === 201, `(HTTP ${r.status} ${r.text.slice(0, 160)})`);
const id = r.json?.alarm?.id;
if (id) {
  r = await admin(`/api/alarms/${id}`, { method: 'PUT', body: { active: false } });
  check('editar alarma -> 200', r.status === 200 && r.json?.alarm?.active === false, `(HTTP ${r.status})`);
  r = await admin(`/api/alarms/${id}`, { method: 'DELETE' });
  check('borrar alarma -> 204', r.status === 204, `(HTTP ${r.status})`);
}
// dejar el estado del pastillero como estaba (sin firmware de prueba)
console.log(`\nResultado: ${pass} bien, ${fail} mal`);
process.exitCode = fail ? 1 : 0;
