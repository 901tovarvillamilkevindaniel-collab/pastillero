// POST /api/alarms — crear una alarma desde el modal "Nueva alarma"
// GET  /api/alarms — listar alarmas (útil para pruebas)
import { endpoint, readBody, HttpError } from '../../lib/http.js';
import { select, insert } from '../../lib/db.js';
import { ALARM_COLUMNS, MAX_ALARMS } from '../../lib/constants.js';
import { parseAlarm } from '../../lib/validate.js';

export default endpoint({ methods: ['GET', 'POST'], auth: 'admin' }, async (req) => {
  if (req.method === 'GET') {
    return { body: { alarms: await select(`alarms?select=${ALARM_COLUMNS}&order=alarm_time.asc,slot.asc`) } };
  }

  const row = parseAlarm(readBody(req));
  const existing = await select('alarms?select=id');
  if (existing.length >= MAX_ALARMS) {
    throw new HttpError(409, `Ya hay ${MAX_ALARMS} alarmas, que es el máximo. Elimina alguna para crear otra.`);
  }
  const [alarm] = await insert('alarms', row, ALARM_COLUMNS);
  return { status: 201, body: { alarm } };
});
