"""Prueba de conexiones del Pastillero Santos: 4 LEDs y buzzer.

Se corre sin guardarlo en la placa (desde la raíz del repo):
    python tools/run_on_board.py firmware/hw_test.py

Toma los pines de config.py si ya está en la placa; si no, usa los de abajo.
"""
import sys
import time
from machine import Pin, PWM

sys.modules.pop("config", None)           # leer el config.py actual, no una copia vieja en memoria
try:
    import config
    LED_PINS = config.LED_PINS
    BUZZER_PIN = config.BUZZER_PIN
except ImportError:
    LED_PINS = (23, 19, 18, 17)
    BUZZER_PIN = 15

NOMBRES = ("verde", "rojo", "azul", "amarillo")

leds = [Pin(p, Pin.OUT, value=0) for p in LED_PINS]
placa = Pin(2, Pin.OUT, value=0)          # LED azul de la placa (D2)


def apagar_todo():
    for led in leds:
        led.value(0)
    placa.value(0)
    Pin(BUZZER_PIN, Pin.OUT, value=0)


try:
    print("Prueba de conexiones. Mira la placa: empieza en 3 s...")
    time.sleep(3)

    print("\n1) Un LED a la vez (2 s cada uno)")
    for i, led in enumerate(leds):
        nombre = NOMBRES[i] if i < len(NOMBRES) else "?"
        print("   Compartimento %d, LED %s, GPIO %d" % (i + 1, nombre, LED_PINS[i]))
        led.value(1)
        time.sleep(2)
        led.value(0)
        time.sleep(0.3)

    print("\n2) Los %d LEDs juntos (2 s)" % len(leds))
    for led in leds:
        led.value(1)
    time.sleep(2)
    for led in leds:
        led.value(0)

    print("\n3) Buzzer en GPIO %d, modo ACTIVO: 3 pitidos" % BUZZER_PIN)
    buzzer = Pin(BUZZER_PIN, Pin.OUT, value=0)
    for _ in range(3):
        buzzer.value(1)
        time.sleep(0.4)
        buzzer.value(0)
        time.sleep(0.3)
    time.sleep(1)

    print("\n4) Buzzer modo PASIVO: tono grave y luego agudo")
    pwm = PWM(Pin(BUZZER_PIN), freq=1000, duty_u16=32768)
    time.sleep(1)
    pwm.freq(2500)
    time.sleep(1)
    pwm.deinit()

    print("\n5) LED azul de la placa (D2): 3 parpadeos")
    for _ in range(3):
        placa.value(1)
        time.sleep(0.3)
        placa.value(0)
        time.sleep(0.3)
finally:
    apagar_todo()

print("""
Prueba terminada, todo apagado.
- Un LED no prendió: dale la vuelta (la pata larga va hacia la resistencia),
  revisa la resistencia y que su pata corta llegue a GND.
- Buzzer: si pitó claro en el paso 3 es ACTIVO; si solo sonó en el paso 4 es
  PASIVO (en config.py pon BUZZER_PASSIVE = True).
""")
