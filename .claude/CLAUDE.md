# Pastillero Santos

Pastillero inteligente: ESP32 DevKit V1 con MicroPython, 5 compartimentos con LED y un buzzer.
Las alarmas se crean desde un portal web en Vercel y se guardan en Supabase.
Plan completo: `docs/plan-backend.html` (y `docs/plan-backend.pdf`).

## Idioma
Todo en español: respuestas, mensajes de commit, comentarios y textos del portal.

## Cuentas (importante)
Supabase y GitHub de este proyecto son de una **cuenta aparte**: no es la cuenta principal ni la de VIVAR AI.
Los conectores (MCP de Supabase, GitHub) **no tienen acceso** a estos recursos.

| Servicio | Recurso | Cómo se accede |
|---|---|---|
| GitHub | `https://github.com/901tovarvillamilkevindaniel-collab/pastillero.git`, rama `main` | CLI de `git` |
| Supabase | proyecto `ylhflnfqmeywktasmdda` (us-west-2) | Management API con `SUPABASE_ACCESS_TOKEN`, REST con `SUPABASE_SECRET_KEY` |

- El conector MCP de Supabase apunta a otra cuenta (proyecto "VIVAR AI PLATAFORM"). **No usarlo ni tocar ese proyecto.**
- SQL en Supabase: `POST https://api.supabase.com/v1/projects/ylhflnfqmeywktasmdda/database/query` con `{"query": "..."}`.
- Las credenciales están en `web/.env` (fuera de git). Leerlas sin imprimirlas.
- Git push: Windows tiene guardada la cuenta principal (`kevinvt610`), que da 403 en este repo. Por eso el remoto lleva el usuario en la URL (`https://901tovarvillamilkevindaniel-collab@github.com/...`) y `credential.useHttpPath=true`, para que el Git Credential Manager pida y guarde la cuenta collab solo para este repo.

## Hardware
- LEDs (compartimentos 1 a 5): GPIO 23, 19, 18, 17, 16 (verde, rojo, azul, amarillo, naranja).
- Buzzer: GPIO 12 en el código; en el diagrama de Wokwi aparece en GPIO 15. Confirmar antes del firmware final.
- **Sin RTC**: la hora de Bogotá (UTC−5) la manda Vercel en cada `/api/device/sync`.
- Placa actual en **COM6** (chip USB CH340), MicroPython v1.29.0. Para flashear hay que entrar a modo descarga a mano: mantener BOOT, pulsar EN, soltar BOOT.
- No hay sensor de toma: la toma se confirma desde el celular ("Ya se la tomó" → comando `silence`).

## Estructura
- `firmware/` — MicroPython que se sube al ESP32 (`config.py` con WiFi y `DEVICE_KEY`, fuera de git).
- `web/` — proyecto de Vercel: `public/index.html` (portal), `api/` (funciones), `.env` (fuera de git).
- `supabase/migrations/` — esquema: `alarms`, `events`, `commands`, `device_status`, con RLS sin políticas.
- `tools/run_on_board.py` — corre un script en la placa sin guardarlo: `python tools/run_on_board.py firmware/hw_test.py`.

## Reglas
- Nunca subir secretos: `web/.env`, `firmware/config.py` y `firmware_bin/` están en `.gitignore`.
- El token `sbp_` es solo para el PC: nunca va a Vercel.
- La alarma se decide en el ESP32; la nube solo configura, confirma y registra.
