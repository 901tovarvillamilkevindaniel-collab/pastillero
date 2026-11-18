# Comunicación con la API en Vercel por HTTPS.
# MicroPython no verifica el certificado (equivale a setInsecure() en Arduino):
# el tráfico va cifrado, aceptable para un pastillero en casa.
import gc
import config

try:
    import requests
except ImportError:
    import urequests as requests

_HEADERS = {"x-device-key": config.DEVICE_KEY}


def _url(path):
    return config.API_URL.rstrip("/") + path


def sync(ringing):
    """GET /api/device/sync. Devuelve el JSON o None si falló."""
    gc.collect()
    r = None
    try:
        path = "/api/device/sync?ringing=%d&fw=%s" % (1 if ringing else 0, config.FW_VERSION)
        r = requests.get(_url(path), headers=_HEADERS, timeout=config.HTTP_TIMEOUT_S)
        if r.status_code != 200:
            print("Nube: sync HTTP", r.status_code, r.text[:120])
            return None
        return r.json()
    except Exception as e:
        print("Nube: sync falló:", e)
        return None
    finally:
        if r:
            r.close()
        gc.collect()


def send_events(events):
    """POST /api/device/events. Devuelve True si el servidor los guardó."""
    gc.collect()
    r = None
    try:
        r = requests.post(_url("/api/device/events"), headers=_HEADERS,
                          json={"events": events}, timeout=config.HTTP_TIMEOUT_S)
        if r.status_code != 201:
            print("Nube: eventos HTTP", r.status_code, r.text[:120])
            return r.status_code == 400   # datos inválidos: no reintentar para siempre
        return True
    except Exception as e:
        print("Nube: eventos fallaron:", e)
        return False
    finally:
        if r:
            r.close()
        gc.collect()
