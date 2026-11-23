// Reglas del pastillero. Si cambias algo aquí, revisa también firmware/config.py.

export const SLOTS = 4;                       // compartimentos 0..3 (LED GPIO 23, 19, 18, 17)
export const MAX_ALARMS = 20;
export const MAX_LABEL = 40;
export const MAX_EVENTS_PER_POST = 50;        // cola del ESP32 tras un corte de WiFi
export const HISTORY_LIMIT = 30;              // eventos que muestra el portal
export const COMMAND_TTL_MS = 2 * 60 * 1000;  // un "silenciar" viejo se descarta
export const POLL_S = 30;                     // el ESP32 consulta cada 30 s...
export const POLL_RINGING_S = 5;              // ...o cada 5 s mientras suena
export const TIMEZONE = process.env.TIMEZONE || 'America/Bogota';

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const EVENT_TYPES = ['triggered', 'silenced', 'missed'];
export const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7]; // ISO: 1 = lunes ... 7 = domingo

// Columnas que se devuelven de una alarma (alarm_time sale como "time")
export const ALARM_COLUMNS = 'id,slot,time:alarm_time,label,days,active,updated_at';
