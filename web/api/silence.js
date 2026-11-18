// POST /api/silence — botón "Ya se la tomó" del portal.
// El pastillero no tiene sensor: la toma se confirma desde el celular.
// Deja un comando en la cola; el ESP32 lo recoge en su siguiente /api/device/sync.
import { endpoint } from '../lib/http.js';
import { insert } from '../lib/db.js';
import { POLL_RINGING_S } from '../lib/constants.js';

export default endpoint({ methods: ['POST'], auth: 'public' }, async () => {
  const [cmd] = await insert('commands', { command: 'silence' }, 'id,created_at');
  return { status: 201, body: { ok: true, command_id: cmd.id, expected_within_s: POLL_RINGING_S } };
});
