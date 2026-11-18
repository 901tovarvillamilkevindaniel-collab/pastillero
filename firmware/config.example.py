# Configuración del Pastillero Santos (MicroPython, ESP32 DevKit V1)
# Copia este archivo como config.py y llena WiFi y DEVICE_KEY.
# config.py está en .gitignore: nunca se sube a GitHub.

FW_VERSION = "0.1.0"

# --- WiFi (solo redes de 2,4 GHz) ---
WIFI_SSID = "NOMBRE_DE_TU_WIFI"
WIFI_PASSWORD = "CONTRASEÑA_DE_TU_WIFI"
WIFI_TIMEOUT_S = 20      # espera al arrancar
WIFI_RETRY_S = 30        # reintento si se cae

# --- Nube (Vercel) ---
API_URL = "https://pastillero-two.vercel.app"
DEVICE_KEY = "PEGA_AQUI_LA_DEVICE_KEY_DE_web/.env"
HTTP_TIMEOUT_S = 10
POLL_S = 30              # consulta normal
POLL_RINGING_S = 5       # mientras suena o hay una toma sin confirmar

# --- Hardware ---
LED_PINS = (23, 19, 18, 17, 16)   # compartimentos 1..5: verde, rojo, azul, amarillo, naranja
BUZZER_PIN = 15                   # en el diagrama de Wokwi va al GPIO 15
BUZZER_PASSIVE = False            # True si el buzzer es pasivo (necesita PWM)
BUZZER_FREQ = 2000                # tono del buzzer pasivo, en Hz
BEEP_MS = 500                     # pitido intermitente: 500 ms sí, 500 ms no
STATUS_LED_PIN = 2                # LED azul de la placa (D2): repite lo que hacen los 5 LEDs. None para apagarlo

# --- Alarmas ---
ALARM_TIMEOUT_S = 600             # 10 min sin confirmar -> "missed" y se calla el buzzer
CLOCK_TOLERANCE_S = 2             # solo se corrige el reloj si se desvía más que esto
