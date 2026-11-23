"""Prueba la lógica del firmware en el PC, simulando machine y el tiempo del ESP32.

Uso (desde la raíz del repo):  python tools/test_firmware.py
"""
import importlib
import sys
import time as _time
import types
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "firmware"))

# ---------- simulación de MicroPython ----------
fake = {"ms": 0}
_time.ticks_ms = lambda: fake["ms"]
_time.ticks_diff = lambda a, b: a - b
_time.sleep_ms = lambda ms: None


class Pin:
    OUT = 1
    def __init__(self, n, mode=None, value=0):
        self.n, self.v = n, value
    def value(self, v=None):
        if v is None:
            return self.v
        self.v = v


class PWM:
    def __init__(self, pin, freq=0, duty_u16=0):
        self.duty = duty_u16
    def duty_u16(self, d):
        self.duty = d


class RTC:
    last = None
    def datetime(self, t=None):
        RTC.last = t


machine = types.ModuleType("machine")
machine.Pin, machine.PWM, machine.RTC = Pin, PWM, RTC
sys.modules["machine"] = machine

config = types.ModuleType("config")
config.LED_PINS = (23, 19, 18, 17)
config.BUZZER_PIN = 15
config.BUZZER_PASSIVE = False
config.BUZZER_FREQ = 2000
config.BEEP_MS = 500
config.STATUS_LED_PIN = 2
config.ALARM_TIMEOUT_S = 600
config.CLOCK_TOLERANCE_S = 2
sys.modules["config"] = config

alarms_mod = importlib.import_module("alarms")
clock = importlib.import_module("clock")

# ---------- mini framework ----------
ok = bad = 0
def check(name, cond, extra=""):
    global ok, bad
    if cond:
        ok += 1; print("  ✓", name)
    else:
        bad += 1; print("  ✗", name, extra)

# localtime falso: (año, mes, día, h, min, s, día_semana 0=lunes, día_año)
def lt(h, m, wd=2, yd=322):
    return (2026, 11, 18, h, m, 0, wd, yd)

events = []
A = alarms_mod.Alarms(lambda aid, slot, kind: events.append((aid, slot, kind)))
A.set_alarms([
    {"id": 1, "slot": 0, "time": "07:00", "days": [1, 2, 3, 4, 5, 6, 7]},
    {"id": 2, "slot": 3, "time": "09:00", "days": [7]},           # solo domingos
    {"id": 3, "slot": 9, "time": "10:00", "days": [1]},           # compartimento inválido
    {"id": 4, "slot": 1, "time": "mal"},                          # hora inválida
])

print("\nConfiguración")
check("descarta alarmas inválidas", [a["id"] for a in A.alarms] == [1, 2], str(A.alarms))

print("\nDisparo")
A.check(lt(6, 59)); check("06:59 no suena", not events)
A.check(lt(7, 0)); check("07:00 suena el compartimento 1", events == [(1, 0, "triggered")], str(events))
A.check(lt(7, 0)); check("no se repite en el mismo minuto", len(events) == 1)
A.check(lt(9, 0, wd=2)); check("alarma de domingo no suena un miércoles", len(events) == 1)

print("\nSalidas mientras suena")
fake["ms"] = 0; A.update(True)
check("LED 1 encendido en la fase 'sí'", A.leds[0].value() == 1)
check("buzzer encendido", A._pin.value() == 1)
check("LED de la placa (D2) encendido", A.status_led.value() == 1)
check("los demás LEDs apagados", all(l.value() == 0 for l in A.leds[1:]))
fake["ms"] = 600; A.update(True)
check("intermitente: en la fase 'no' se apagan", A.leds[0].value() == 0 and A._pin.value() == 0 and A.status_led.value() == 0)
check("pide consultas rápidas (5 s)", A.needs_fast_poll and A.is_ringing)

print("\nSilenciar desde el celular")
A.silence()
check("evento 'silenced'", events[-1] == (1, 0, "silenced"), str(events))
fake["ms"] = 1000; A.update(True)
check("todo apagado", not A.is_ringing and A._pin.value() == 0 and A.leds[0].value() == 0 and A.status_led.value() == 0)
A.silence(); check("silenciar sin nada sonando no crea eventos", len(events) == 2)

print("\nSin confirmar (10 min)")
events.clear()
A.check(lt(7, 0, wd=3, yd=323))
check("al día siguiente vuelve a sonar", events == [(1, 0, "triggered")], str(events))
fake["ms"] = 1000 + 600 * 1000; A.update(True)
check("a los 10 min: 'missed'", events[-1] == (1, 0, "missed"), str(events))
check("el buzzer se calla", A._pin.value() == 0 and not A.is_ringing)
check("el LED queda fijo y D2 también", A.leds[0].value() == 1 and A.status_led.value() == 1)
A.silence(); A.update(True)
check("confirmar tarde registra 'silenced' y apaga", events[-1] == (1, 0, "silenced") and A.leds[0].value() == 0)

print("\nSin hora válida")
fake["ms"] = 2000 * 10 + 50; A.update(False)
check("destello corto en los LEDs y D2", A.leds[0].value() == 1 and A.status_led.value() == 1)
fake["ms"] = 2000 * 10 + 500; A.update(False)
check("y luego apagados", A.leds[0].value() == 0 and A.status_led.value() == 0)

print("\nBuzzer pasivo (PWM)")
config.BUZZER_PASSIVE = True
P = alarms_mod.Alarms(lambda *a: None)
P.set_alarms([{"id": 9, "slot": 2, "time": "08:00", "days": [3]}])
P.check(lt(8, 0, wd=2)); fake["ms"] = 0; P.update(True)
check("suena con PWM al 50%", P._pwm.duty == 32768)
config.BUZZER_PASSIVE = False

print("\nReloj")
clock._valid = False
changed = clock.apply({"epoch": 1795006800, "utc_offset_min": -300})   # 2026-11-18 08:00 Bogotá
check("pone en hora con la hora de Bogotá", changed and RTC.last[:3] == (2026, 11, 18) and RTC.last[4:6] == (8, 0), str(RTC.last))
check("día de la semana: miércoles = 2", RTC.last[3] == 2, str(RTC.last))
check("datos inválidos no cambian nada", clock.apply({"epoch": "x"}) is False)

print("\nResultado: %d bien, %d mal" % (ok, bad))
sys.exit(1 if bad else 0)
