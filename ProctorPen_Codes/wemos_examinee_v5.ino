// ============================================================
//  PROCTOPEN — Examinee Unit (Wemos D1 Mini)
//  v5 — Smart WiFi with credential handoff + AP fallback
//
//  Fix: removed lastMillis = now from connection stage blocks
//       so the exam countdown is not affected by connection logic
// ============================================================

#include <ESP8266WiFi.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>
#include <EEPROM.h>

// ── Proctopen AP credentials (never change) ──────────────────
const char* AP_SSID = "Proctopen";
const char* AP_PASS = "proctopen123";

// ── Server discovery ─────────────────────────────────────────
const char* MDNS_HOST   = "proctopen.local";
const int   SERVER_PORT = 8080;

WiFiClient client;

// ── OLED ─────────────────────────────────────────────────────
#define SCREEN_WIDTH  128
#define SCREEN_HEIGHT  64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// ── Motor / LED pins ─────────────────────────────────────────
const int enablePin  = D5;
const int motorIn1   = D6;
const int motorIn2   = D7;
const int warningLED = D8;

// ── EEPROM layout ────────────────────────────────────────────
#define EEPROM_SIZE       98
#define EEPROM_MAGIC      0xAB
#define EEPROM_ADDR_MAGIC 0
#define EEPROM_ADDR_SSID  1
#define EEPROM_ADDR_PASS  34

// ── Connection stages ────────────────────────────────────────
enum ConnStage {
  CONN_STA_WIFI,
  CONN_STA_MDNS,
  CONN_STA_TCP,
  CONN_AP_WIFI,
  CONN_AP_MDNS,
  CONN_AP_TCP,
};

// ── System states ────────────────────────────────────────────
enum SystemState {
  WAITING_CONN,
  CONNECTED_IDLE,
  READY_TO_START,
  RUNNING,
  PAUSED,
  ENDED_TIMEUP,
  ENDED_PROCTOR
};

SystemState currentState = WAITING_CONN;
ConnStage   connStage;

// ── Saved STA credentials ────────────────────────────────────
char saved_ssid[33] = "";
char saved_pass[64] = "";
bool hasStaCreds    = false;

// ── Connection state ─────────────────────────────────────────
IPAddress serverIP;
bool      serverIPResolved = false;
bool      usingStaNetwork  = false;

// ── Timeouts ─────────────────────────────────────────────────
#define STA_WIFI_TIMEOUT_MS 12000
#define MDNS_RETRY_MS        3000
#define TCP_RETRY_MS         2000

unsigned long connStageStart  = 0;
unsigned long lastMdnsAttempt = 0;
unsigned long lastTcpAttempt  = 0;
unsigned long lastPingSent = 0;

// ── Timer ─────────────────────────────────────────────────────
long          remainingTime_ms = 0;
unsigned long lastMillis       = 0;

// ── Warning ───────────────────────────────────────────────────
bool          isWarningActive = false;
unsigned long warningEndTime  = 0;
bool          ledFlashState   = false;
unsigned long lastLedFlash    = 0;

// ── Disable / Punishment ──────────────────────────────────────
bool          isDisabled     = false;
bool          hasPunishTimer = false;
unsigned long punishEndTime  = 0;

// ── Deduction tracking ────────────────────────────────────────
long totalDeductedSeconds = 0;

// ── Motor (non-blocking) ──────────────────────────────────────
bool          isPenCurrentlyEnabled = false;
bool          motorRunning          = false;
unsigned long motorStopTime         = 0;

// ── TCP read buffer ───────────────────────────────────────────
String inputBuffer = "";

// ── Display refresh ───────────────────────────────────────────
unsigned long lastDisplayUpdate = 0;

// ── Forward declarations ──────────────────────────────────────
void processCommand(String json);
void updateDisplay();
void printFormattedTime(long ms);
void setPenState(bool enable);
void loadCredentials();
void saveCredentials(String ssid, String pass);
void clearCredentials();
void startConnection();
bool resolveMDNS(IPAddress &result);

// ============================================================
void setup() {
  Serial.begin(115200);

  pinMode(enablePin,  OUTPUT);
  pinMode(motorIn1,   OUTPUT);
  pinMode(motorIn2,   OUTPUT);
  pinMode(warningLED, OUTPUT);
  digitalWrite(enablePin,  LOW);
  digitalWrite(warningLED, LOW);

  EEPROM.begin(EEPROM_SIZE);
  loadCredentials();

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("OLED failed"));
    for (;;);
  }

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(20, 20);
  display.println("PROCTOPEN v3.0");
  display.setCursor(25, 40);
  display.println("SYSTEM BOOT...");
  display.display();
  delay(1500);

  lastMillis = millis();
  startConnection();
}

// ============================================================
//  mDNS resolution
// ============================================================
bool resolveMDNS(IPAddress &result) {
  int ret = WiFi.hostByName(MDNS_HOST, result);
  return (ret == 1 && result != IPAddress(0, 0, 0, 0));
}

// ============================================================
void loop() {
  unsigned long now = millis();

  // ── Connection state machine ─────────────────────────────
  // NOTE: lastMillis is NOT touched here — only the exam
  // countdown section at the bottom manages lastMillis.

  if (connStage == CONN_STA_WIFI) {
    if (WiFi.status() == WL_CONNECTED) {
      Serial.print("STA connected: "); Serial.println(WiFi.localIP());
      usingStaNetwork = true;
      connStage       = CONN_STA_MDNS;
      lastMdnsAttempt = 0;
    } else if (now - connStageStart >= STA_WIFI_TIMEOUT_MS) {
      Serial.println("STA timeout — falling back to AP");
      WiFi.disconnect(true);
      WiFi.mode(WIFI_OFF);
      delay(100);
      WiFi.mode(WIFI_STA);
      WiFi.begin(AP_SSID, AP_PASS);
      connStage       = CONN_AP_WIFI;
      connStageStart  = now;
      usingStaNetwork = false;
    }
  }

  else if (connStage == CONN_STA_MDNS) {
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("STA WiFi lost — falling back to AP");
      WiFi.mode(WIFI_STA);
      WiFi.begin(AP_SSID, AP_PASS);
      connStage      = CONN_AP_WIFI;
      connStageStart = now;
    } else if (now - lastMdnsAttempt >= MDNS_RETRY_MS) {
      lastMdnsAttempt = now;
      IPAddress resolved;
      if (resolveMDNS(resolved)) {
        serverIP         = resolved;
        serverIPResolved = true;
        connStage        = CONN_STA_TCP;
        lastTcpAttempt   = 0;
        Serial.print("mDNS resolved: "); Serial.println(serverIP);
      } else {
        Serial.println("mDNS not found, retrying...");
      }
    }
  }

  else if (connStage == CONN_STA_TCP) {
    if (!client.connected()) {
      if (WiFi.status() != WL_CONNECTED) {
        Serial.println("STA WiFi lost — falling back to AP");
        WiFi.mode(WIFI_STA);
        WiFi.begin(AP_SSID, AP_PASS);
        connStage      = CONN_AP_WIFI;
        connStageStart = now;
      } else if (now - lastTcpAttempt >= TCP_RETRY_MS) {
        lastTcpAttempt = now;
        if (client.connect(serverIP, SERVER_PORT)) {
          currentState = CONNECTED_IDLE;
          lastMillis   = millis();  // sync timer base on connect
          Serial.println("TCP connected via STA");
        } else {
          Serial.println("TCP failed — re-resolving mDNS");
          serverIPResolved = false;
          connStage        = CONN_STA_MDNS;
          lastMdnsAttempt  = 0;
        }
      }
    }
  }

  else if (connStage == CONN_AP_WIFI) {
    if (WiFi.status() == WL_CONNECTED) {
      Serial.print("AP connected: "); Serial.println(WiFi.localIP());
      usingStaNetwork = false;
      connStage       = CONN_AP_MDNS;
      lastMdnsAttempt = 0;
    }
  }

  else if (connStage == CONN_AP_MDNS) {
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("AP WiFi lost — reconnecting");
      WiFi.begin(AP_SSID, AP_PASS);
      connStage      = CONN_AP_WIFI;
      connStageStart = now;
    } else if (now - lastMdnsAttempt >= MDNS_RETRY_MS) {
      lastMdnsAttempt = now;
      IPAddress resolved;
      if (resolveMDNS(resolved)) {
        serverIP         = resolved;
        serverIPResolved = true;
        connStage        = CONN_AP_TCP;
        lastTcpAttempt   = 0;
        Serial.print("mDNS resolved: "); Serial.println(serverIP);
      } else {
        Serial.println("mDNS not found, retrying...");
      }
    }
  }

  else if (connStage == CONN_AP_TCP) {
    if (!client.connected()) {
      if (WiFi.status() != WL_CONNECTED) {
        Serial.println("AP WiFi lost — reconnecting");
        WiFi.begin(AP_SSID, AP_PASS);
        connStage      = CONN_AP_WIFI;
        connStageStart = now;
      } else if (now - lastTcpAttempt >= TCP_RETRY_MS) {
        lastTcpAttempt = now;
        if (client.connect(serverIP, SERVER_PORT)) {
          currentState = CONNECTED_IDLE;
          lastMillis   = millis();  // sync timer base on connect
          Serial.println("TCP connected via AP");
        } else {
          Serial.println("TCP failed — re-resolving mDNS");
          serverIPResolved = false;
          connStage        = CONN_AP_MDNS;
          lastMdnsAttempt  = 0;
        }
      }
    }
  }

  // ── TCP disconnect mid-session ───────────────────────────
  if ((connStage == CONN_STA_TCP || connStage == CONN_AP_TCP)
      && currentState != WAITING_CONN
      && !client.connected()) {
    Serial.println("TCP lost — reconnecting");
    if (currentState == RUNNING || currentState == PAUSED)
      setPenState(false);
    currentState     = WAITING_CONN;
    serverIPResolved = false;
    inputBuffer      = "";
    connStage        = usingStaNetwork ? CONN_STA_MDNS : CONN_AP_MDNS;
    lastMdnsAttempt  = 0;
  }

  // ── Read incoming TCP commands ───────────────────────────
  while (client.connected() && client.available()) {
    char c = client.read();
    if (c == '\n') {
      inputBuffer.trim();
      if (inputBuffer.length() > 0) {
        processCommand(inputBuffer);
        inputBuffer = "";
      }
    } else {
      inputBuffer += c;
    }
  }

  // ── Serial passthrough ───────────────────────────────────
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') {
      inputBuffer.trim();
      if (inputBuffer.length() > 0) {
        processCommand(inputBuffer);
        inputBuffer = "";
      }
    } else {
      inputBuffer += c;
    }
  }

  // ── Motor auto-stop ──────────────────────────────────────
  if (motorRunning && now >= motorStopTime) {
    motorRunning = false;
    digitalWrite(enablePin, LOW);
    digitalWrite(motorIn1,  LOW);
    digitalWrite(motorIn2,  LOW);
  }

  // ── Exam countdown ───────────────────────────────────────
  // lastMillis is ONLY updated here — not in connection stages
  if (currentState == RUNNING) {
    long elapsed = (long)(now - lastMillis);
    remainingTime_ms -= elapsed;
    if (remainingTime_ms <= 0) {
      remainingTime_ms = 0;
      currentState     = ENDED_TIMEUP;
      setPenState(false);
    }
  }
  lastMillis = now;

  // ── Warning LED flash ────────────────────────────────────
  if (isWarningActive) {
    if (now >= warningEndTime) {
      isWarningActive = false;
      digitalWrite(warningLED, LOW);
    } else if (now - lastLedFlash >= 300) {
      lastLedFlash  = now;
      ledFlashState = !ledFlashState;
      digitalWrite(warningLED, ledFlashState ? HIGH : LOW);
    }
  }

  // ── Punishment timer auto-enable ─────────────────────────
  if (isDisabled && hasPunishTimer && now >= punishEndTime) {
    isDisabled     = false;
    hasPunishTimer = false;
    if (currentState == RUNNING) setPenState(true);
  }

  // ── Display at 10 FPS ────────────────────────────────────
  if (now - lastDisplayUpdate > 100) {
    updateDisplay();
    lastDisplayUpdate = now;
  }
  // ── Ping ESP32 every 3 s to signal we're alive ───────────
  if (client.connected() && now - lastPingSent > 3000) {
    client.print("{\"event\":\"ping\"}\n");
    lastPingSent = now;
  }
}

// ============================================================
//  Start connection
// ============================================================
void startConnection() {
  serverIPResolved = false;
  inputBuffer      = "";
  currentState     = WAITING_CONN;
  client.stop();
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);
  delay(100);
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(false);

  loadCredentials();

  if (hasStaCreds) {
    Serial.print("Trying STA: "); Serial.println(saved_ssid);
    connStage      = CONN_STA_WIFI;
    connStageStart = millis();
    WiFi.begin(saved_ssid, saved_pass);
  } else {
    Serial.println("No STA creds — using Proctopen AP");
    connStage      = CONN_AP_WIFI;
    connStageStart = millis();
    WiFi.begin(AP_SSID, AP_PASS);
  }
}

// ============================================================
//  Command processor
// ============================================================
void processCommand(String jsonString) {
  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, jsonString);
  if (error) {
    Serial.print("JSON error: "); Serial.println(error.c_str());
    return;
  }

  String cmd = doc["cmd"].as<String>();
  Serial.print("CMD: "); Serial.println(cmd);

  if (cmd == "sta_creds") {
    String newSsid = doc["ssid"].as<String>();
    String newPass = doc["pass"].as<String>();
    if (newSsid.length() > 0 && newSsid != String(saved_ssid)) {
      Serial.println("Received STA creds — switching network");
      saveCredentials(newSsid, newPass);
      delay(300);
      startConnection();
    }
    return;
  }

  if (cmd == "clear_creds") {
    clearCredentials();
    Serial.println("STA credentials cleared");
    return;
  }

  if (cmd == "timer") {
    remainingTime_ms     = doc["duration_ms"].as<long>();
    currentState         = READY_TO_START;
    totalDeductedSeconds = 0;
    isWarningActive      = false;
    isDisabled           = false;
    hasPunishTimer       = false;
  }
  else if (cmd == "start") {
    lastMillis   = millis();
    currentState = RUNNING;
    if (!isDisabled) setPenState(true);
  }
  else if (cmd == "pause") {
    currentState = PAUSED;
    setPenState(false);
  }
  else if (cmd == "end") {
    currentState     = ENDED_PROCTOR;
    remainingTime_ms = 0;
    setPenState(false);
  }
  else if (cmd == "reset") {
    currentState         = CONNECTED_IDLE;
    remainingTime_ms     = 0;
    totalDeductedSeconds = 0;
    isWarningActive      = false;
    isDisabled           = false;
    hasPunishTimer       = false;
    digitalWrite(warningLED, LOW);
    setPenState(false);
  }
  else if (cmd == "warn") {
    isWarningActive = true;
    warningEndTime  = millis() + 120000;
    lastLedFlash    = millis();
  }
  else if (cmd == "disable") {
    isDisabled = true;
    setPenState(false);
    if (doc.containsKey("punish_ms")) {
      hasPunishTimer = true;
      punishEndTime  = millis() + doc["punish_ms"].as<long>();
    } else {
      hasPunishTimer = false;
    }
  }
  else if (cmd == "enable") {
    isDisabled     = false;
    hasPunishTimer = false;
    if (currentState == RUNNING) setPenState(true);
  }
  else if (cmd == "deduct") {
    long deduct_ms        = doc["time_ms"].as<long>();
    remainingTime_ms     -= deduct_ms;
    totalDeductedSeconds += (deduct_ms / 1000);
    if (remainingTime_ms <= 0) {
      remainingTime_ms = 0;
      currentState     = ENDED_TIMEUP;
      setPenState(false);
    }
  }
  else if (cmd == "sync") {
    remainingTime_ms = doc["remaining_ms"].as<long>();
    lastMillis       = millis();
  }
}

// ============================================================
//  Display
// ============================================================
void updateDisplay() {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);

  if (currentState == WAITING_CONN) {
    display.setTextSize(2);
    display.setCursor(0, 0);
    display.println("Proctopen");
    display.setTextSize(1);
    display.setCursor(0, 20);
    display.println("Waiting for");
    display.println("Connection...");
    display.setCursor(0, 42);
    switch (connStage) {
      case CONN_STA_WIFI: {
        display.println("Trying network:");
        display.print(saved_ssid);
        long rem = (long)(STA_WIFI_TIMEOUT_MS
                   - (millis() - connStageStart)) / 1000;
        if (rem < 0) rem = 0;
        display.print(" ("); display.print(rem); display.print("s)");
        break;
      }
      case CONN_STA_MDNS:
        display.println("WiFi OK");
        display.print("Finding server...");
        break;
      case CONN_STA_TCP:
        display.print("Server: "); display.println(serverIP);
        display.print("Connecting...");
        break;
      case CONN_AP_WIFI:
        display.println("Trying Proctopen AP");
        display.print("Connecting...");
        break;
      case CONN_AP_MDNS:
        display.println("AP OK");
        display.print("Finding server...");
        break;
      case CONN_AP_TCP:
        display.print("Server: "); display.println(serverIP);
        display.print("Connecting...");
        break;
    }
    display.display();
    return;
  }

  if (currentState == CONNECTED_IDLE) {
    display.setTextSize(2);
    display.setCursor(0, 0);
    display.println("Proctopen");
    display.setTextSize(1);
    display.setCursor(0, 20);
    display.println("Connected.");
    display.setCursor(0, 32);
    display.print(usingStaNetwork ? "STA: " : "AP:  ");
    display.println(WiFi.localIP());
    display.display();
    return;
  }

  if (currentState == READY_TO_START) {
    display.setTextSize(3);
    display.setCursor(20, 0);
    printFormattedTime(remainingTime_ms);
    display.setTextSize(1);
    display.setCursor(0, 36);
    display.println("Please wait for");
    display.println("the exam to start.");
    display.display();
    return;
  }

  if (currentState == PAUSED) {
    display.setTextSize(2);
    display.setCursor(0, 0);
    display.println("Paused");
    display.setTextSize(1);
    display.setCursor(0, 22);
    display.println("Timer:");
    display.setTextSize(2);
    display.setCursor(20, 34);
    printFormattedTime(remainingTime_ms);
    display.display();
    return;
  }

  if (currentState == ENDED_TIMEUP) {
    display.setTextSize(2);
    display.setCursor(0, 10);
    display.println("Times Up!");
    display.println("Exam Ended");
    display.display();
    return;
  }

  if (currentState == ENDED_PROCTOR) {
    display.setTextSize(2);
    display.setCursor(0, 10);
    display.println("Exam Ended");
    display.setTextSize(1);
    display.setCursor(0, 38);
    display.println("- By the Proctor");
    display.display();
    return;
  }

  if (currentState == RUNNING) {
    int yOffset = 0;
    if (isWarningActive) {
      display.fillRect(0, 0, 128, 16, SSD1306_WHITE);
      display.setTextColor(SSD1306_BLACK);
      display.setTextSize(2);
      display.setCursor(22, 1);
      display.print("WARNING");
      display.setTextColor(SSD1306_WHITE);
      yOffset = 18;
    }
    if (isDisabled) {
      display.setTextSize(2);
      display.setCursor(0, yOffset);
      display.println("DISABLED!");
      display.setTextSize(1);
      display.setCursor(0, yOffset + 20);
      if (hasPunishTimer) {
        long p_rem = max(0L, (long)(punishEndTime - millis()) / 1000);
        display.print("Penalty: ");
        display.print(p_rem);
        display.println("s");
        display.setCursor(0, yOffset + 30);
      }
      display.print("Exam: ");
      printFormattedTime(remainingTime_ms);
    } else {
      display.setTextSize(3);
      display.setCursor(20, yOffset + 2);
      printFormattedTime(remainingTime_ms);
    }
    if (totalDeductedSeconds > 0) {
      display.setTextSize(1);
      display.setCursor(0, 55);
      display.print("Time deducted by ");
      if (totalDeductedSeconds >= 60) {
        display.print(totalDeductedSeconds / 60);
        display.print("m");
      }
      display.print(totalDeductedSeconds % 60);
      display.print("s");
    }
    display.display();
    return;
  }
}

// ============================================================
//  EEPROM credential storage
// ============================================================
void loadCredentials() {
  if (EEPROM.read(EEPROM_ADDR_MAGIC) == EEPROM_MAGIC) {
    for (int i = 0; i < 32; i++)
      saved_ssid[i] = EEPROM.read(EEPROM_ADDR_SSID + i);
    saved_ssid[32] = '\0';
    for (int i = 0; i < 63; i++)
      saved_pass[i] = EEPROM.read(EEPROM_ADDR_PASS + i);
    saved_pass[63] = '\0';
    hasStaCreds = (strlen(saved_ssid) > 0);
    if (hasStaCreds) {
      Serial.print("Loaded STA creds: "); Serial.println(saved_ssid);
    }
  } else {
    hasStaCreds = false;
    Serial.println("No saved STA creds");
  }
}

void saveCredentials(String ssid, String pass) {
  EEPROM.write(EEPROM_ADDR_MAGIC, EEPROM_MAGIC);
  for (int i = 0; i < 32; i++)
    EEPROM.write(EEPROM_ADDR_SSID + i,
      i < (int)ssid.length() ? ssid[i] : 0);
  for (int i = 0; i < 63; i++)
    EEPROM.write(EEPROM_ADDR_PASS + i,
      i < (int)pass.length() ? pass[i] : 0);
  EEPROM.commit();
  ssid.toCharArray(saved_ssid, 33);
  pass.toCharArray(saved_pass, 64);
  hasStaCreds = true;
  Serial.print("Saved STA creds: "); Serial.println(saved_ssid);
}

void clearCredentials() {
  EEPROM.write(EEPROM_ADDR_MAGIC, 0x00);
  EEPROM.commit();
  memset(saved_ssid, 0, sizeof(saved_ssid));
  memset(saved_pass, 0, sizeof(saved_pass));
  hasStaCreds = false;
  Serial.println("Credentials cleared");
}

// ============================================================
//  Helpers
// ============================================================
void printFormattedTime(long ms) {
  if (ms < 0) ms = 0;
  int m = (ms / 1000) / 60;
  int s = (ms / 1000) % 60;
  if (m < 10) display.print("0");
  display.print(m);
  display.print(":");
  if (s < 10) display.print("0");
  display.print(s);
}

void setPenState(bool enable) {
  if (isPenCurrentlyEnabled == enable) return;
  isPenCurrentlyEnabled = enable;

  digitalWrite(enablePin, LOW);
  digitalWrite(motorIn1,  LOW);
  digitalWrite(motorIn2,  LOW);
  delay(50);

  if (enable) {
    digitalWrite(motorIn1, HIGH);
    digitalWrite(motorIn2, LOW);
  } else {
    digitalWrite(motorIn1, LOW);
    digitalWrite(motorIn2, HIGH);
  }

  digitalWrite(enablePin, HIGH);
  motorRunning  = true;
  motorStopTime = millis() + 1000;
}
