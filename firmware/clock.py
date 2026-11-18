# Reloj del pastillero: no hay RTC externo. La hora de Bogotá llega de Vercel
# en cada /api/device/sync y se guarda en el reloj interno del ESP32.
import time
import machine
import config

_EPOCH_2000 = 946684800                       # segundos entre 1970 y 2000
_UNIX_OFFSET = _EPOCH_2000 if time.gmtime(0)[0] == 2000 else 0
_rtc = machine.RTC()

# Tras un reinicio suave el reloj interno conserva la hora; tras quitar la corriente, no.
_valid = time.localtime()[0] >= 2025


def valid():
    return _valid


def apply(clock):
    """Pone en hora el reloj con {"epoch", "utc_offset_min"} del servidor.
    Devuelve True si lo cambió (solo si estaba sin hora o desviado más de CLOCK_TOLERANCE_S)."""
    global _valid
    try:
        epoch = int(clock["epoch"])
        offset_min = int(clock["utc_offset_min"])
    except (KeyError, TypeError, ValueError):
        return False
    local = epoch + offset_min * 60 - _UNIX_OFFSET
    if _valid and abs(local - time.time()) <= config.CLOCK_TOLERANCE_S:
        return False
    t = time.gmtime(local)                    # (año, mes, día, h, min, s, día_semana 0=lunes, día_año)
    _rtc.datetime((t[0], t[1], t[2], t[6], t[3], t[4], t[5], 0))
    _valid = True
    return True


def stamp():
    t = time.localtime()
    return "%04d-%02d-%02d %02d:%02d:%02d" % (t[0], t[1], t[2], t[3], t[4], t[5])
