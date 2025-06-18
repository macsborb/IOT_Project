#include <WiFiNINA.h>

// Définition des pins
const int touchSensorPin     = 16; // A1
const int soundSensorPin     = 17; // A2
const int IRSensorPin        = 18; // A3
const int ledEffectorPin     = 19; // A4

// États précédents des capteurs
bool lastTouchSensorState = false;
bool lastSoundSensorState = false;
bool lastIRSensorState    = false;

// État global de détection (pour LED)
bool activeDetectionState = false;

// Identifiants Wi-Fi
char ssid[] = "Robbie";            
char pass[] = "projetiot2025";     
int  status = WL_IDLE_STATUS;      

void printWifiStatus() {
  Serial.print("SSID: ");
  Serial.println(WiFi.SSID());

  IPAddress ip = WiFi.localIP();
  Serial.print("IP Address: ");
  Serial.println(ip);

  long rssi = WiFi.RSSI();
  Serial.print("signal strength (RSSI): ");
  Serial.print(rssi);
  Serial.println(" dBm");

  Serial.print("Open a browser at http://");
  Serial.println(ip);
}

void enable_WiFi() {
  if (WiFi.status() == WL_NO_MODULE) {
    Serial.println("Communication with WiFi module failed!");
    while (true);
  }

  String fv = WiFi.firmwareVersion();
  if (fv < "1.0.0") {
    Serial.println("Please upgrade the firmware");
  }
}

void connect_WiFi() {
  while (status != WL_CONNECTED) {
    Serial.print("Attempting to connect to SSID: ");
    Serial.println(ssid);

    status = WiFi.begin(ssid, pass);
    delay(10000);
  }
}

void sendSensorState(String sensorName, bool state) {
  WiFiClient client;
  const char* host = "172.20.10.3";
  const int port = 80;
  String url = "/sensorEvent?sensor=" + sensorName + "&state=" + (state ? "true" : "false");

  if (client.connect(host, port)) {
    client.print(String("GET ") + url + " HTTP/1.1\r\n" +
                 "Host: " + host + "\r\n" +
                 "Connection: close\r\n\r\n");
    delay(10); // Petit délai pour s'assurer que la requête est envoyée
    client.stop();
  } else {
    Serial.print("Échec de connexion au serveur pour ");
    Serial.println(sensorName);
  }
}

void setup() {
  Serial.begin(9600);
  while (!Serial);

  pinMode(touchSensorPin, INPUT);
  pinMode(soundSensorPin, INPUT);
  pinMode(IRSensorPin,    INPUT);
  pinMode(ledEffectorPin, OUTPUT);

  enable_WiFi();
  connect_WiFi();
  printWifiStatus();
}

void loop() {
  // Lecture des capteurs
  bool touchSensorState  = (digitalRead(touchSensorPin) == HIGH);
  int  soundRawValue    = analogRead(soundSensorPin);
  bool isSoundDetected  = (soundRawValue > 50);
  bool IRState          = (digitalRead(IRSensorPin) == HIGH);

  // --- Capteur Touch ---
  if (touchSensorState != lastTouchSensorState) {
    sendSensorState("touch", touchSensorState);
  }
  lastTouchSensorState = touchSensorState;

  // --- Capteur Son ---
  if (isSoundDetected != lastSoundSensorState) {
    sendSensorState("sound", isSoundDetected);
    Serial.print("Sound value: ");
    Serial.println(soundRawValue);
  }
  lastSoundSensorState = isSoundDetected;

  // --- Capteur IR ---
  if (IRState != lastIRSensorState) {
    sendSensorState("ir", IRState);
  }
  lastIRSensorState = IRState;

  // --- Gestion de la LED (si au moins un capteur actif) ---
  bool anySensorActive = touchSensorState || isSoundDetected || IRState;
  if (anySensorActive != activeDetectionState) {
    digitalWrite(ledEffectorPin, anySensorActive ? HIGH : LOW);
    activeDetectionState = anySensorActive;
  }

    // Envoi du heartbeat toutes les 10 secondes
  static unsigned long lastHeartbeat = 0;
  if (millis() - lastHeartbeat >= 10000) {  // 10 secondes
    WiFiClient client;
    const char* host = "172.20.10.3";  // Remplacez par l'IP de votre serveur
    const int port = 80;

    if (client.connect(host, port)) {
      client.print(String("GET /heartbeat HTTP/1.1\r\n") +
                   "Host: " + host + "\r\n" +
                   "Connection: close\r\n\r\n");
      delay(10);
      client.stop();
      lastHeartbeat = millis();
    }
  }
  // Ajout d'un délai pour éviter de surcharger le serveur et le réseau
  delay(100); // Augmenté légèrement pour plus de stabilité
}
