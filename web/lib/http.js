import { createHash, timingSafeEqual } from 'node:crypto';
import { DbError } from './db.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const KEYS = {
  admin: { header: 'x-admin-key', env: 'ADMIN_KEY' },   // portal
  device: { header: 'x-device-key', env: 'DEVICE_KEY' }, // ESP32
};

// Compara claves en tiempo constante (se comparan sus hash para igualar longitudes)
function sameKey(a, b) {
  const ha = createHash('sha256').update(String(a)).digest();
  const hb = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(ha, hb);
}

function authorized(req, who) {
  const { header, env } = KEYS[who];
  const expected = process.env[env];
  if (!expected) {
    console.error(`Falta la variable de entorno ${env}: se rechazan todas las peticiones.`);
    return false;
  }
  const got = req.headers[header];
  return typeof got === 'string' && got.length > 0 && sameKey(got, expected);
}

// Traduce errores de Postgres a mensajes para el portal
function fromDb(err) {
  if (err.code === '23505') return new HttpError(409, 'Ese compartimento ya tiene una alarma a esa hora.');
  if (err.code === '23514' || err.code === '22P02') return new HttpError(400, 'Algún dato no es válido.');
  if (err.code === '23503') return new HttpError(400, 'La alarma indicada no existe.');
  return null;
}

/**
 * Envuelve un handler con método permitido, clave y manejo de errores.
 * @param {{methods: string[], auth: 'admin'|'device'}} opts
 * @param {(req, res) => Promise<{status?: number, body?: unknown}|void>} fn
 */
export function endpoint({ methods, auth }, fn) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (!methods.includes(req.method)) {
      res.setHeader('Allow', methods.join(', '));
      return res.status(405).json({ error: `Método no permitido. Usa ${methods.join(' o ')}.` });
    }
    if (!authorized(req, auth)) {
      return res.status(401).json({ error: 'Clave incorrecta o ausente.' });
    }
    try {
      const out = (await fn(req, res)) || {};
      if (out.status === 204) return res.status(204).end();
      return res.status(out.status || 200).json(out.body ?? { ok: true });
    } catch (err) {
      const known = err instanceof HttpError ? err : err instanceof DbError ? fromDb(err) : null;
      if (known) return res.status(known.status).json({ error: known.message });
      console.error(err);
      return res.status(500).json({ error: 'Error interno. Revisa los logs de Vercel.' });
    }
  };
}

// Vercel ya convierte el JSON en objeto; esto cubre texto o vacío
export function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) {
    try { return JSON.parse(req.body); } catch { throw new HttpError(400, 'El cuerpo no es JSON válido.'); }
  }
  return {};
}
