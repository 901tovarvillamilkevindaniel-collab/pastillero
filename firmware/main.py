# Pastillero Santos: bucle principal.
# La alarma se decide aquí, con el reloj interno. La nube (Vercel) manda la hora
# de Bogotá, las alarmas y la orden de silenciar; aquí se reporta lo que pasó.
import time
import json
import machine
import config
import net
import clock
import cloud
from alarms import Alarms

CACHE = "alarms.json"     # alarmas guardadas en la flash: sirven sin internet
MAX_QUEUE = 50            # eventos guardados mientras no hay red

queue = []


def report(alarm_id, slot, kind):
    queue.append({
        "alarm_id": alarm_id,
        "slot": slot,
        "type": kind,
        "device_time": clock.stamp() if clock.valid() else None,
    })
    while len(queue) > MAX_QUEUE:
        queue.pop(0)


def load_cache():
    try:
        with open(CACHE) as f:
            return json.load(f)
    except (OSError, ValueError):
        return []


def save_cache(items):
    try:
        with open(CACHE, "w") as f:
            json.dump(items, f)
    except OSError as e:
        print("Flash: no pude guardar las alarmas:", e)


def poll(alarms, state):
    """Envía eventos pendientes y sincroniza. Devuelve el poll_s que pide el servidor."""
    if queue:
        batch = queue[:]
        if cloud.send_events(batch):
            del queue[:len(batch)]
            print("Nube: %d evento(s) enviados" % len(batch))
    data = cloud.sync(alarms.is_ringing)
    if not data:
        return None
    if clock.apply(data.get("clock") or {}):
        print("Reloj: hora de Bogotá", clock.stamp())
    items = data.get("alarms") or []
    if items != state["cache"]:
        alarms.set_alarms(items)
        save_cache(items)
        state["cache"] = items
        print("Alarmas: %d activas -> %s" % (len(items), ", ".join(
            "C%d %s" % (a["slot"] + 1, a["time"]) for a in items) or "ninguna"))
    if "silence" in (data.get("commands") or []):
        alarms.silence()
    return data.get("poll_s")


def main():
    print("Pastillero Santos", config.FW_VERSION)
    alarms = Alarms(report)
    try:
        cache = load_cache()
        alarms.set_alarms(cache)
        state = {"cache": cache}
        print("Alarmas guardadas en la flash:", len(cache))
        net.connect(config.WIFI_TIMEOUT_S)

        poll_s = config.POLL_S
        last_poll = None
        last_check = None
        while True:
            now = time.ticks_ms()
            if clock.valid() and (last_check is None or time.ticks_diff(now, last_check) >= 1000):
                last_check = now
                alarms.check(time.localtime())
            alarms.update(clock.valid())

            interval = config.POLL_RINGING_S if alarms.needs_fast_poll else poll_s
            if last_poll is None or time.ticks_diff(now, last_poll) >= interval * 1000:
                last_poll = now
                if net.ensure():
                    got = poll(alarms, state)
                    if got:
                        poll_s = got
            time.sleep_ms(50)
    finally:
        alarms.off()


try:
    main()
except KeyboardInterrupt:
    print("Detenido con Ctrl-C")
except Exception as e:
    import sys
    sys.print_exception(e)
    print("Reiniciando en 10 s...")
    time.sleep(10)
    machine.reset()
