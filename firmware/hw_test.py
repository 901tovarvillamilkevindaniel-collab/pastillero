"""Prueba de hardware del Pastillero Santos (sin red).

Enciende cada LED por turno, prueba el buzzer en modo digital y en modo PWM
para saber si es activo o pasivo, y deja todo apagado al terminar.

Se corre sin guardarlo en la placa:
    python tools/run_on_board.py firmware/hw_test.py
o desde PyCharm con "Run" sobre el dispositivo.
"""
import time
from machine import Pin, PWM

LED_PINS = (23, 19, 18, 17, 16)
BUZZER_PIN = 12

leds = [Pin(p, Pin.OUT, value=0) for p in LED_PINS]
buzzer = Pin(BUZZER_PIN, Pin.OUT, value=0)
pwm = None


def paso(texto):
    print()
    print(">>", texto)


try:
    print("Mira la placa. Empieza en 5 s...")
    time.sleep(5)

    paso("1/4  LEDs uno por uno, 1 s cada uno")
    for i, led in enumerate(leds):
        print("     Pastilla %d -> GPIO %d" % (i + 1, LED_PINS[i]))
        led.value(1)
        time.sleep(1)
        led.value(0)
        time.sleep_ms(250)

    paso("2/4  Los 5 LEDs juntos, 2 s")
    for led in leds:
        led.value(1)
    time.sleep(2)
    for led in leds:
        led.value(0)
    time.sleep(1)

    paso("3/4  Buzzer en modo DIGITAL: 3 pitidos de medio segundo")
    print("     Activo: pitido claro.  Pasivo: solo un clic o nada.")
    for _ in range(3):
        buzzer.value(1)
        time.sleep_ms(500)
        buzzer.value(0)
        time.sleep_ms(400)
    time.sleep(1)

    paso("4/4  Buzzer en modo PWM: 1000 Hz y luego 2000 Hz, 1 s cada uno")
    print("     Pasivo: dos tonos distintos.  Activo: suena igual o raro.")
    pwm = PWM(Pin(BUZZER_PIN), freq=1000, duty_u16=32768)
    time.sleep(1)
    pwm.freq(2000)
    time.sleep(1)
finally:
    if pwm is not None:
        pwm.deinit()
    for led in leds:
        led.value(0)
    Pin(BUZZER_PIN, Pin.OUT, value=0)
    print()
    print("Prueba terminada. Todo apagado.")
