#include <WiFi.h>
#include <WebServer.h>
#include <Wire.h>
#include <RTClib.h>

// Credenciales de tu router doméstico
const char* ssid = "NOMBRE_DE_TU_WIFI";
const char* password = "CONTRASEÑA_DE_TU_WIFI";

WebServer server(80);
RTC_DS1307 rtc; // <-- CAMBIADO para coincidir con el DS1307 del diagrama

// Pines para 5 LEDs y 1 Buzzer según el diagrama
const int ledPins[] = {23, 19, 18, 17, 16};
const int buzzerPin = 12; // <-- CAMBIADO al pin 12 según el diagrama
const int numLeds = 5;

// Almacén de horas programadas (Formato "HH:MM")
String alarmTimes[numLeds] = {"--:--", "--:--", "--:--", "--:--", "--:--"};
bool alarmActive[numLeds] = {false, false, false, false, false};
bool alarmTriggered = false;

// Interfaz HTML optimizada para celulares con campos de hora
const char HTML_PAGE[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Pastillero Inteligente</title>
  <style>
    body { font-family: Arial, sans-serif; text-align: center; background-color: #f4f4f9; margin: 0; padding: 20px; }
    h1 { color: #333; font-size: 22px; }
    .card { background: white; padding: 15px; margin: 10px auto; border-radius: 10px; max-width: 400px; box-shadow: 0px 4px 8px rgba(0,0,0,0.1); }
    .row { margin: 10px 0; display: flex; justify-content: space-between; align-items: center; }
    input[type="time"] { padding: 5px; font-size: 16px; }
    .btn { background-color: #4CAF50; color: white; padding: 8px 15px; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; }
    .btn-off { background-color: #f44336; width: 100%; padding: 12px; font-size: 16px; margin-top: 15px; }
  </style>
</head>
<body>
  <h1>Programador de Pastillero</h1>
  <div class="card">
    <h3>Configurar Horarios</h3>
    <form action="/set" method="GET">
      <div class="row"><span>Pastilla 1:</span> <input type="time" name="t0"></div>
      <div class="row"><span>Pastilla 2:</span> <input type="time" name="t1"></div>
      <div class="row"><span>Pastilla 3:</span> <input type="time" name="t2"></div>
      <div class="row"><span>Pastilla 4:</span> <input type="time" name="t3"></div>
      <div class="row"><span>Pastilla 5:</span> <input type="time" name="t4"></div>
      <br>
      <button type="submit" class="btn" style="width:100%;">Guardar Horarios</button>
    </form>
    <form action="/off" method="GET">
      <button type="submit" class="btn btn-off">Silenciar Alarma / Apagar</button>
    </form>
  </div>
</body>
</html>
)rawliteral";

void handleRoot() {
  server.send(200, "text/html", HTML_PAGE);
}

void handleSet() {
  for (int i = 0; i < numLeds; i++) {
    String argName = "t" + String(i);
    if (server.hasArg(argName)) {
      String val = server.arg(argName);
      if (val.length() == 5) { // Valida formato HH:MM
        alarmTimes[i] = val;
        alarmActive[i] = true;
      }
    }
  }
  server.sendHeader("Location", "/");
  server.send(303);
}

void handleOff() {
  alarmTriggered = false;
  digitalWrite(buzzerPin, LOW);
  for (int i = 0; i < numLeds; i++) {
    digitalWrite(ledPins[i], LOW);
  }
  server.sendHeader("Location", "/");
  server.send(303);
}

void setup() {
  Serial.begin(115200);

  // Inicializar pines
  for (int i = 0; i < numLeds; i++) {
    pinMode(ledPins[i], OUTPUT);
    digitalWrite(ledPins[i], LOW);
  }
  pinMode(buzzerPin, OUTPUT);
  digitalWrite(buzzerPin, LOW);

  // Inicializar RTC (Los pines SDA: 21 y SCL: 22 del diagrama son los por defecto de la librería Wire)
  Wire.begin();
  if (!rtc.begin()) {
    Serial.println("No se encontró el módulo RTC");
  }

  // Opcional: Ajusta la hora del RTC automáticamente con la hora de tu PC al compilar (descomentar la primera vez que lo subas)
  // rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));

  // Configurar ESP32 en modo estación y conectar al router
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  Serial.print("Conectando a la red Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("¡Conectado al router exitosamente!");
  Serial.print("Abre tu navegador e ingresa esta IP: ");
  Serial.println(WiFi.localIP());

  // Rutas web
  server.on("/", handleRoot);
  server.on("/set", handleSet);
  server.on("/off", handleOff);

  server.begin();
}

void loop() {
  server.handleClient();

  // Obtener hora actual del módulo RTC
  DateTime now = rtc.now();
  char currentTime[6];
  sprintf(currentTime, "%02d:%02d", now.hour(), now.minute());

  // Verificar si coincide la hora actual con alguna alarma programada
  for (int i = 0; i < numLeds; i++) {
    if (alarmActive[i] && alarmTimes[i] == String(currentTime)) {
      alarmTriggered = true;
    }
  }

  // Activar salidas si hay alarma activa
  if (alarmTriggered) {
    digitalWrite(buzzerPin, HIGH);
    for (int i = 0; i < numLeds; i++) {
      if (alarmActive[i] && alarmTimes[i] == String(currentTime)) {
        digitalWrite(ledPins[i], HIGH);
      }
    }
  }
}
