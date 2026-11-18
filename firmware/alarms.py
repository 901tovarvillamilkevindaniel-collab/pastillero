# Alarmas: decide cuándo suena cada compartimento y maneja LEDs y buzzer.
#
# Estados de un compartimento:
#   sonando    -> LED y buzzer intermitentes (hasta silenciar o ALARM_TIMEOUT_S)
#   pendiente  -> LED fijo: sonó y nadie confirmó la toma todavía
#   apagado
# Sin hora válida (sin internet tras quitar la corriente) los LEDs dan un destello cada 2 s.
import time
from machine import Pin, PWM
import config


class Alarms:
    def __init__(self, report):
        self._report = report                     # report(alarm_id, slot, tipo)
        self.leds = [Pin(p, Pin.OUT, value=0) for p in config.LED_PINS]
        sp = getattr(config, "STATUS_LED_PIN", None)
        self.status_led = Pin(sp, Pin.OUT, value=0) if sp is not None else None
        self._pwm = None
        self._pin = None
        if config.BUZZER_PASSIVE:
            self._pwm = PWM(Pin(config.BUZZER_PIN), freq=config.BUZZER_FREQ, duty_u16=0)
        else:
            self._pin = Pin(config.BUZZER_PIN, Pin.OUT, value=0)
        self._buzzer_on = False
        self.alarms = []        # [{"id", "slot", "time", "days"}]
        self.ringing = {}       # slot -> (alarm_id, ticks de inicio)
        self.pending = {}       # slot -> alarm_id
        self._fired = {}        # alarm_id -> (día del año, hora, minuto) del último disparo

    # ---------- configuración ----------
    def set_alarms(self, items):
        ok = []
        for a in items or []:
            try:
                slot = int(a["slot"])
                t = a["time"]
                days = [int(d) for d in a.get("days") or (1, 2, 3, 4, 5, 6, 7)]
                if 0 <= slot < len(self.leds) and len(t) == 5 and t[2] == ":":
                    ok.append({"id": int(a["id"]), "slot": slot, "time": t, "days": days})
            except (KeyError, TypeError, ValueError):
                pass
        self.alarms = ok

    # ---------- disparo ----------
    def check(self, t):
        """t = time.localtime(). Llamar al menos una vez por minuto."""
        hhmm = "%02d:%02d" % (t[3], t[4])
        weekday = t[6] + 1                        # ISO: 1 = lunes ... 7 = domingo
        key = (t[7], t[3], t[4])
        for a in self.alarms:
            if a["time"] == hhmm and weekday in a["days"] and self._fired.get(a["id"]) != key:
                self._fired[a["id"]] = key
                self._start(a)

    def _start(self, a):
        slot = a["slot"]
        print("ALARMA: compartimento %d, alarma %d, %s" % (slot + 1, a["id"], a["time"]))
        self.ringing[slot] = (a["id"], time.ticks_ms())
        self.pending[slot] = a["id"]
        self._report(a["id"], slot, "triggered")

    def silence(self):
        """Orden 'silence' del portal: la toma se confirmó desde el celular."""
        if not self.pending:
            return
        for slot, alarm_id in list(self.pending.items()):
            print("Tomada: compartimento %d" % (slot + 1))
            self._report(alarm_id, slot, "silenced")
        self.pending.clear()
        self.ringing.clear()
        self._buzz(False)

    @property
    def is_ringing(self):
        return bool(self.ringing)

    @property
    def needs_fast_poll(self):
        return bool(self.pending)

    # ---------- salidas ----------
    def _buzz(self, on):
        if on == self._buzzer_on:
            return
        self._buzzer_on = on
        if self._pwm is not None:
            self._pwm.duty_u16(32768 if on else 0)
        else:
            self._pin.value(1 if on else 0)

    def update(self, clock_ok):
        now = time.ticks_ms()
        for slot, (alarm_id, start) in list(self.ringing.items()):
            if time.ticks_diff(now, start) >= config.ALARM_TIMEOUT_S * 1000:
                print("Sin confirmar: compartimento %d" % (slot + 1))
                del self.ringing[slot]
                self._report(alarm_id, slot, "missed")   # el LED queda fijo (pendiente)

        phase = (now // config.BEEP_MS) % 2 == 0
        self._buzz(bool(self.ringing) and phase)

        any_on = False
        for i, led in enumerate(self.leds):
            if i in self.ringing:
                on = phase
            elif i in self.pending:
                on = True
            elif not clock_ok and not self.pending:
                on = (now % 2000) < 150
            else:
                on = False
            led.value(1 if on else 0)
            any_on = any_on or on
        if self.status_led is not None:
            self.status_led.value(1 if any_on else 0)

    def off(self):
        for led in self.leds:
            led.value(0)
        if self.status_led is not None:
            self.status_led.value(0)
        self._buzz(False)
