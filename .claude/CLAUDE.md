# Pastillero Santos

Pastillero inteligente: ESP32 DevKit V1 con MicroPython, 4 compartimentos con LED y un buzzer.
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
| Vercel | proyecto `pastillero` (`prj_qhdBTSBrOrv3ACW7wcXQS79EjpaM`), equipo `test11-c4c7` (`team_2wk3OCneKAMa7xByMLzo2oHM`), producción en **https://pastillero-two.vercel.app** | Conector MCP de Vercel (sí tiene acceso, cuenta `901tovarvillamilkevindaniel`) |

- Vercel: enlazado al repo de GitHub con *Root Directory* `web/` y Node 24. **Cada `git push` a `main` despliega a producción solo.** Las variables `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `DEVICE_KEY` (sensitive) y `TIMEZONE` ya están cargadas. **El portal es de acceso libre** (sin clave, decisión del usuario 2026-11-18); solo los endpoints `/api/device/*` piden `x-device-key`. La variable `ADMIN_KEY` se borró de Vercel el 2026-11-23 (ya no existe).
- **Cambiar una variable en Vercel no tiene efecto hasta el siguiente despliegue**: después de cambiarla, subir un commit vacío (`git commit --allow-empty` + `git push`). Si el ESP32 muestra `sync HTTP 401`, la `DEVICE_KEY` de Vercel no coincide con la de `firmware/config.py` (pasó el 2026-11-23 al borrar `ADMIN_KEY`).
- El conector de Vercel a veces queda en la cuenta principal (`tovarvillamilk`), que no ve este proyecto: revisar `get_auth_user` antes de usarlo. Prueba de producción: `node tools/test_prod.mjs https://pastillero-two.vercel.app`.

- El conector MCP de Supabase apunta a otra cuenta (proyecto "VIVAR AI PLATAFORM"). **No usarlo ni tocar ese proyecto.**
- SQL en Supabase: `POST https://api.supabase.com/v1/projects/ylhflnfqmeywktasmdda/database/query` con `{"query": "..."}`.
- Las credenciales están en `web/.env` (fuera de git). Leerlas sin imprimirlas.
- Git push: la cuenta principal `kevinvt610` es **colaboradora** del repo (desde el 2026-11-18), así que `git push` funciona con la credencial que ya tiene Windows. El remoto usa la URL normal, sin usuario.

## Hardware
- LEDs (compartimentos 1 a 4): GPIO 23, 19, 18, 17 (verde, rojo, azul, amarillo). El 5.º (naranja, GPIO 16) se quitó el 2026-11-22: la base solo acepta `slot` 0..3.
- Buzzer: `BUZZER_PIN = 15` en `firmware/config.py` (como el diagrama de Wokwi; el sketch viejo usaba 12). Buzzer **activo**, confirmado con `hw_test.py` el 2026-11-22 (`BUZZER_PASSIVE = False`). Los 4 LEDs también probados y funcionando.
- LED azul de la placa (GPIO 2, "D2"): `STATUS_LED_PIN`, repite lo que hacen los LEDs. Sirve para probar sin nada conectado.
- WiFi de la casa: SSID **"Estrella"** (con mayúscula), en `firmware/config.py`.
- **Sin RTC**: la hora de Bogotá (UTC−5) la manda Vercel en cada `/api/device/sync`.
- Placa actual en **COM6** (chip USB CH340), MicroPython v1.29.0. Para flashear hay que entrar a modo descarga a mano: mantener BOOT, pulsar EN, soltar BOOT.
- No hay sensor de toma: la toma se confirma desde el celular ("Ya se la tomó" → comando `silence`).

## Estructura
- `firmware/` — MicroPython que se sube al ESP32 (`config.py` con WiFi y `DEVICE_KEY`, fuera de git).
- `web/` — proyecto de Vercel: `public/index.html` (portal), `api/` (funciones), `.env` (fuera de git).
- `supabase/migrations/` — esquema: `alarms`, `events`, `commands`, `device_status`, con RLS sin políticas.
- `firmware/hw_test.py` — prueba de conexiones (4 LEDs, buzzer activo/pasivo, LED D2): `python tools/run_on_board.py firmware/hw_test.py`.
- Si la placa no responde al raw REPL (quedó colgada), reiniciarla por RTS (pulso en EN) o con el botón EN.
- **Watchdog** (firmware 0.2.0, `WDT_S = 60` en `config.py`): si el bucle no lo alimenta en 60 s, la placa se reinicia sola (probado el 2026-11-22: se reinició a los 60 s y volvió al WiFi). Al parar `main.py` con Ctrl-C (PyCharm, `run_on_board.py`, `upload_firmware.py`) el watchdog sigue activo: hay ~60 s para trabajar antes de que reinicie. Para sesiones largas de REPL, poner `WDT_S = 0` y subir el config.
- `tools/upload_firmware.py --reset` — copia el firmware a la flash (verifica SHA-1) y reinicia. `tools/monitor.py` — lee la salida serie.
- `tools/test_firmware.py` — prueba la lógica del firmware en el PC (simula machine). `tools/test_api.mjs` / `tools/test_prod.mjs` — prueban la API.
- En Windows, correr los .py con `PYTHONIOENCODING=utf-8` para que se vean los acentos y ✓.

## Reglas
- Nunca subir secretos: `web/.env`, `firmware/config.py` y `firmware_bin/` están en `.gitignore`.
- El token `sbp_` es solo para el PC: nunca va a Vercel.
- La alarma se decide en el ESP32; la nube solo configura, confirma y registra.
