// GET /api/device/sync?ringing=0|1&fw=<versión> — el "latido" del ESP32.
// Devuelve la hora de Bogotá, las alarmas activas y los comandos pendientes,
// y anota que el pastillero sigue en línea.
import { endpoint } from '../../lib/http.js';
import { select, update } from '../../lib/db.js';
import { COMMAND_TTL_MS, POLL_S, POLL_RINGING_S } from '../../lib/constants.js';
import { deviceClock } from '../../lib/clock.js';

export default endpoint({ methods: ['GET'], auth: 'device' }, async (req) => {
  const now = new Date();
  const ringing = req.query.ringing === '1';
  const fw = typeof req.query.fw === 'string' ? req.query.fw.slice(0, 40) : undefined;

  // Consumir TODOS los comandos pendientes en una sola operación (atómica en Postgres).
  // Los que tienen más de 2 minutos se marcan como consumidos pero no se ejecutan.
  const [alarms, consumed] = await Promise.all([
    select('alarms?select=id,slot,time:alarm_time,days&active=is.true&order=alarm_time.asc,slot.asc'),
    update('commands?consumed_at=is.null', { consumed_at: now.toISOString() }, 'command,created_at'),
  ]);
  const fresh = consumed.filter((c) => now - Date.parse(c.created_at) <= COMMAND_TTL_MS);
  const commands = [...new Set(fresh.map((c) => c.command))];

  const status = { last_seen_at: now.toISOString(), ringing };
  if (fw) status.firmware = fw;
  await update('device_status?id=eq.1', status, 'id');

  return {
    body: {
      clock: deviceClock(now),
      alarms,
      commands,
      poll_s: ringing ? POLL_RINGING_S : POLL_S,
    },
  };
});
