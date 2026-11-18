import { TIMEZONE } from './constants.js';

// Desfase de la zona en minutos para un instante dado (Bogotá = -300)
export function utcOffsetMinutes(date = new Date(), timeZone = TIMEZONE) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(date).find((p) => p.type === 'timeZoneName').value; // "GMT-05:00" o "GMT"
  const m = name.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3] || 0));
}

// Lo que necesita el ESP32 para poner en hora su reloj interno
export function deviceClock(date = new Date()) {
  const offset = utcOffsetMinutes(date);
  const epoch = Math.floor(date.getTime() / 1000);
  const local = new Date((epoch + offset * 60) * 1000).toISOString().slice(0, 19);
  const sign = offset < 0 ? '-' : '+';
  const abs = Math.abs(offset);
  const tz = `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
  return { epoch, utc_offset_min: offset, local: local + tz, timezone: TIMEZONE };
}
