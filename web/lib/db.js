// Cliente mínimo de la REST API de Supabase (PostgREST), sin dependencias.
// Usa la secret key: solo corre en el servidor (funciones de Vercel).

export class DbError extends Error {
  constructor(status, body) {
    super(body?.message || `Supabase respondió ${status}`);
    this.status = status;
    this.code = body?.code;      // código de Postgres, p. ej. 23505 = único repetido
    this.details = body?.details;
  }
}

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Faltan SUPABASE_URL o SUPABASE_SECRET_KEY en las variables de entorno.');
  return { url: url.replace(/\/$/, ''), key };
}

/**
 * Llama a /rest/v1/<path>.
 * @param {string} path  tabla + query, p. ej. "alarms?select=id&order=id"
 * @param {{method?: string, body?: unknown, prefer?: string}} opts
 */
export async function rest(path, { method = 'GET', body, prefer } = {}) {
  const { url, key } = config();
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;

  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new DbError(res.status, data);
  return data;
}

// Atajos
export const select = (path) => rest(path);
export const insert = (table, rows, columns = '*') =>
  rest(`${table}?select=${columns}`, { method: 'POST', body: rows, prefer: 'return=representation' });
export const update = (filter, patch, columns = '*') =>
  rest(`${filter}&select=${columns}`, { method: 'PATCH', body: patch, prefer: 'return=representation' });
export const remove = (filter, columns = 'id') =>
  rest(`${filter}&select=${columns}`, { method: 'DELETE', prefer: 'return=representation' });
