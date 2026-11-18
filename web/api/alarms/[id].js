// PUT    /api/alarms/:id — editar (acepta cambios parciales, p. ej. solo { active })
// DELETE /api/alarms/:id — eliminar (el historial se conserva con alarm_id = null)
import { endpoint, readBody, HttpError } from '../../lib/http.js';
import { update, remove } from '../../lib/db.js';
import { ALARM_COLUMNS } from '../../lib/constants.js';
import { parseAlarm, parseId } from '../../lib/validate.js';

const notFound = () => new HttpError(404, 'Esa alarma no existe. Puede que ya se haya eliminado.');

export default endpoint({ methods: ['PUT', 'DELETE'], auth: 'public' }, async (req) => {
  const id = parseId(req.query.id);

  if (req.method === 'DELETE') {
    const gone = await remove(`alarms?id=eq.${id}`);
    if (!gone.length) throw notFound();
    return { status: 204 };
  }

  const patch = parseAlarm(readBody(req), { partial: true });
  const [alarm] = await update(`alarms?id=eq.${id}`, patch, ALARM_COLUMNS);
  if (!alarm) throw notFound();
  return { body: { alarm } };
});
