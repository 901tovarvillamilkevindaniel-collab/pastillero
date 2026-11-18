# WiFi: conexión al arrancar y reconexión sin bloquear el bucle principal.
import time
import network
import config

_wlan = network.WLAN(network.STA_IF)
_last_try = None


def connect(timeout_s):
    """Conecta y espera hasta timeout_s. Devuelve True si quedó conectado."""
    global _last_try
    _wlan.active(True)
    if _wlan.isconnected():
        return True
    print("WiFi: conectando a", config.WIFI_SSID)
    try:
        _wlan.connect(config.WIFI_SSID, config.WIFI_PASSWORD)
    except OSError as e:
        print("WiFi:", e)
    _last_try = time.ticks_ms()
    while not _wlan.isconnected() and time.ticks_diff(time.ticks_ms(), _last_try) < timeout_s * 1000:
        time.sleep_ms(200)
    if _wlan.isconnected():
        print("WiFi: conectado, IP", _wlan.ifconfig()[0])
        return True
    print("WiFi: no se pudo conectar (estado %s). Sigo con las alarmas guardadas." % _wlan.status())
    return False


def ensure():
    """True si hay WiFi. Si no, lanza un reintento cada WIFI_RETRY_S sin esperar."""
    global _last_try
    if _wlan.isconnected():
        return True
    now = time.ticks_ms()
    if _last_try is None or time.ticks_diff(now, _last_try) > config.WIFI_RETRY_S * 1000:
        _last_try = now
        print("WiFi: reintentando")
        try:
            _wlan.disconnect()
        except OSError:
            pass
        try:
            _wlan.connect(config.WIFI_SSID, config.WIFI_PASSWORD)
        except OSError as e:
            print("WiFi:", e)
    return False
