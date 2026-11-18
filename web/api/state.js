// GET /api/state — todo lo que muestra el portal
import { endpoint } from '../lib/http.js';
import { select } from '../lib/db.js';
import { ALARM_COLUMNS, HISTORY_LIMIT } from '../lib/constants.js';
import { deviceClock } from '../lib/clock.js';

export default endpoint({ methods: ['GET'], auth: 'public' }, async () => {
  const [alarms, status, events] = await Promise.all([
    select(`alarms?select=${ALARM_COLUMNS}&order=alarm_time.asc,slot.asc`),
    select('device_status?select=last_seen_at,ringing,firmware&id=eq.1'),
    select(`events?select=id,alarm_id,slot,type,device_time,created_at&order=created_at.desc,id.desc&limit=${HISTORY_LIMIT}`),
  ]);
  return {
    body: {
      server_time: new Date().toISOString(),
      clock: deviceClock(),
      device: status[0] || { last_seen_at: null, ringing: false, firmware: null },
      alarms,
      events,
    },
  };
});
