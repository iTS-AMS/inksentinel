// ============================================================
//  PROCTOPEN — Central Unit (ESP32 DevKitV1)
//  v5 — MAC-based identity + disconnect compensation +
//       per-unit sync + seat/beep commands + USB serial mode
//
// ============================================================

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <ESPmDNS.h>
#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ── Pins ─────────────────────────────────────────────────────
#define OLED_SDA    21
#define OLED_SCL    22
#define MODE_BUTTON 23

// ── OLED ─────────────────────────────────────────────────────
#define SCREEN_WIDTH  128
#define SCREEN_HEIGHT  64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// ── mDNS ─────────────────────────────────────────────────────
#define MDNS_HOST "proctopen"

// ── AP credentials (always on) ───────────────────────────────
const char* AP_SSID = "Proctopen";
const char* AP_PASS = "proctopen123";

// ── Operating modes ──────────────────────────────────────────
enum OpMode { MODE_BLE, MODE_AP, MODE_STA, MODE_USB };
OpMode      currentMode = MODE_BLE;
const char* modeNames[] = { "Bluetooth", "WiFi AP", "WiFi STA", "USB Serial" };

// ── Button ───────────────────────────────────────────────────
unsigned long lastButtonPress = 0;
bool          lastButtonState = HIGH;

// ── Flash storage ────────────────────────────────────────────
Preferences prefs;

// ── STA credentials ──────────────────────────────────────────
String sta_ssid     = "";
String sta_password = "";
bool   staConfigured = false;
bool   staConnected  = false;

// ── HTTP / WebSocket ─────────────────────────────────────────
AsyncWebServer httpServer(80);
AsyncWebSocket ws("/ws");
bool           wsStarted = false;

// ── USB Serial mode ──────────────────────────────────────────
bool           usbMode       = false;
String         usbInputBuf   = "";
unsigned long  lastUsbHeartbeat = 0;

// ── TCP server for Wemos ─────────────────────────────────────
WiFiServer tcpServer(8080);
bool       tcpRunning = false;

// ── Wemos client registry ────────────────────────────────────
struct WemosClient {
  WiFiClient    client;
  uint8_t       id;
  bool          active;
  String        buf;
  bool          onAP;
  bool          credsSent;
  unsigned long lastPing;
  unsigned long disconnectedAt; // when this unit last disconnected
  long          compensation;   // extra ms to add to this unit's sync
  String        mac;            // permanent hardware identity
  bool          identified;     // true once hello packet received
};

bool    pendingTCPStart = false;
#define MAX_WEMOS 20
WemosClient wemos[MAX_WEMOS];
uint8_t     nextId = 1;

// ── BLE ──────────────────────────────────────────────────────
#define BLE_SVC_UUID "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define BLE_RX_UUID  "6e400002-b5a3-f393-e0a9-e50e24dcca9e"
#define BLE_TX_UUID  "6e400003-b5a3-f393-e0a9-e50e24dcca9e"

BLEServer*         bleServer    = nullptr;
BLECharacteristic* bleTxChar    = nullptr;
bool               bleConnected = false;
bool               bleRunning   = false;

// ── Exam state ───────────────────────────────────────────────
enum ExamState {
  EXAM_IDLE, EXAM_READY, EXAM_RUNNING, EXAM_PAUSED, EXAM_ENDED
};
ExamState     examState  = EXAM_IDLE;
long          remainingMs = 0;
unsigned long lastMillis  = 0;

// ── Timing ───────────────────────────────────────────────────
unsigned long lastDisplay   = 0;
unsigned long lastSync      = 0;
unsigned long lastHeartbeat = 0;

// ── Config portal ────────────────────────────────────────────
bool   configPortalActive = false;
String scannedNets        = "";

// ── mDNS flag ────────────────────────────────────────────────
bool mdnsRunning = false;

// ── STA monitoring ───────────────────────────────────────────
bool          staAttempting   = false;
unsigned long staAttemptStart = 0;
#define STA_CONNECT_TIMEOUT_MS 12000

// ============================================================
//  Forward declarations
// ============================================================
void switchMode(OpMode m);
void startBLE();
void stopBLE();
void startAP();
void startSTA();
void stopSTA();
void startUSB();
void stopUSB();
void startTCP();
void stopTCP();
void startMDNS();
void stopMDNS();
void stopWebServer();
void setupWebSocket();
void setupConfigPortal();
void scanNetworks();
void handleWebCommand(String json);
void broadcastWemos(String msg);
void sendWemosByID(uint8_t id, String msg);
void sendWemosByMAC(String mac, String msg);
void sendWeb(String json);
void acceptWemos();
void readWemos();
void handleHello(int slotIndex, String mac);
void checkButton();
void updateDisplay();
void pushStaCreds(int i);
bool isOnAPNetwork(WiFiClient& c);
void sendPerUnitSync();
int  findSlotByMAC(String mac);

// ============================================================
//  BLE callbacks
// ============================================================
class BLEConnCB : public BLEServerCallbacks {
  void onConnect(BLEServer*) override {
    bleConnected = true;
    Serial.println("BLE: web app connected");
  }
  void onDisconnect(BLEServer*) override {
    bleConnected = false;
    BLEDevice::startAdvertising();
    Serial.println("BLE: disconnected, re-advertising");
  }
};

class BLERxCB : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* c) override {
    String v = c->getValue().c_str();
    v.trim();
    if (v.length()) handleWebCommand(v);
  }
};

// ============================================================
//  WebSocket callback
// ============================================================
void onWsEvent(AsyncWebSocket*, AsyncWebSocketClient*,
               AwsEventType type, void* arg, uint8_t* data, size_t len) {
  if (type != WS_EVT_DATA) return;
  AwsFrameInfo* info = (AwsFrameInfo*)arg;
  if (info->final && info->index == 0 && info->len == len) {
    String msg = "";
    for (size_t i = 0; i < len; i++) msg += (char)data[i];
    handleWebCommand(msg);
  }
}

// ============================================================
//  Setup
// ============================================================
void setup() {
  Serial.begin(115200);
  pinMode(MODE_BUTTON, INPUT_PULLUP);

  Wire.begin(OLED_SDA, OLED_SCL);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED failed");
    for (;;);
  }

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(15, 20);
  display.println("PROCTOPEN CENTRAL");
  display.setCursor(30, 38);
  display.println("Booting...");
  display.display();
  delay(1500);

  prefs.begin("proctopen", false);
  sta_ssid      = prefs.getString("ssid", "");
  sta_password  = prefs.getString("pass", "");
  staConfigured = (sta_ssid.length() > 0);
  uint8_t savedMode = prefs.getUChar("mode", 0);
  prefs.end();

  // Initialise all wemos slots cleanly
  for (int i = 0; i < MAX_WEMOS; i++) {
    wemos[i].active       = false;
    wemos[i].identified   = false;
    wemos[i].mac          = "";
    wemos[i].compensation = 0;
    wemos[i].disconnectedAt = 0;
    wemos[i].lastPing     = 0;
  }

  currentMode = (OpMode)savedMode;
  switchMode(currentMode);
}

// ============================================================
//  Loop
// ============================================================
void loop() {
  if (pendingTCPStart) {
    pendingTCPStart = false;
    startTCP();
  }

  unsigned long now = millis();

  checkButton();

  // ── USB Serial input ─────────────────────────────────────
  if (usbMode) {
    while (Serial.available()) {
      char c = Serial.read();
      if (c == '\n') {
        usbInputBuf.trim();
        if (usbInputBuf.length() > 0) {
          handleWebCommand(usbInputBuf);
          usbInputBuf = "";
        }
      } else {
        usbInputBuf += c;
      }
    }
  }

  // ── STA monitoring ───────────────────────────────────────
  if (currentMode == MODE_STA && staAttempting) {
    if (WiFi.status() == WL_CONNECTED) {
      staAttempting = false;
      staConnected  = true;
      Serial.print("STA connected — IP: "); Serial.println(WiFi.localIP());
      startMDNS();
      for (int i = 0; i < MAX_WEMOS; i++) {
        if (wemos[i].active && wemos[i].onAP && !wemos[i].credsSent)
          pushStaCreds(i);
      }
    } else if (now - staAttemptStart >= STA_CONNECT_TIMEOUT_MS) {
      staAttempting = false;
      staConnected  = false;
      Serial.println("STA timed out");
    }
  }

  // ── Wemos TCP ────────────────────────────────────────────
  if (tcpRunning) {
    acceptWemos();
    readWemos();
  }

  // ── Exam countdown ───────────────────────────────────────
  if (examState == EXAM_RUNNING) {
    long elapsed = (long)(now - lastMillis);
    remainingMs -= elapsed;
    if (remainingMs <= 0) {
      remainingMs = 0;
      examState   = EXAM_ENDED;
      broadcastWemos("{\"cmd\":\"end\"}\n");
      sendWeb("{\"event\":\"timeup\"}");
    }
  }
  lastMillis = now;

  // ── Per-unit sync every 5 s ──────────────────────────────
  if (examState == EXAM_RUNNING && now - lastSync > 5000) {
    sendPerUnitSync();
    lastSync = now;
  }

  // ── Heartbeat every 2 s ──────────────────────────────────
  if (now - lastHeartbeat > 2000) {
    String unitList = "[";
    bool first = true;
    for (int i = 0; i < MAX_WEMOS; i++) {
      if (wemos[i].active) {
        if (!first) unitList += ",";
        unitList += "{\"id\":"   + String(wemos[i].id)
                 + ",\"mac\":\"" + wemos[i].mac + "\""
                 + ",\"via\":\"" + String(wemos[i].onAP ? "ap" : "sta") + "\""
                 + ",\"identified\":" + String(wemos[i].identified ? "true" : "false")
                 + "}";
        first = false;
      }
    }
    unitList += "]";

    sendWeb("{\"event\":\"heartbeat\","
            "\"active\":1,"
            "\"mode\":\"" + String(modeNames[currentMode]) + "\","
            "\"sta_connected\":" + String(staConnected ? "true" : "false") + ","
            "\"exam_state\":" + String((int)examState) + ","
            "\"remaining_ms\":" + String(remainingMs) + ","
            "\"units\":" + unitList + "}");
    lastHeartbeat = now;
  }

  if (wsStarted) ws.cleanupClients();

  if (now - lastDisplay > 100) {
    updateDisplay();
    lastDisplay = now;
  }
}

// ============================================================
//  Button — cycles BLE → AP → STA → USB → BLE
// ============================================================
void checkButton() {
  bool s = digitalRead(MODE_BUTTON);
  if (s == LOW && lastButtonState == HIGH
      && millis() - lastButtonPress > 300) {
    lastButtonPress = millis();
    switchMode((OpMode)((currentMode + 1) % 4));
  }
  lastButtonState = s;
}

// ============================================================
//  Mode switching
// ============================================================
void switchMode(OpMode m) {
  Serial.print("Switching to: "); Serial.println(modeNames[m]);

  stopBLE();
  stopSTA();
  stopUSB();
  stopWebServer();
  stopTCP();
  stopMDNS();

  for (int i = 0; i < MAX_WEMOS; i++) {
    if (wemos[i].active) {
      wemos[i].client.stop();
      wemos[i].active = false;
    }
  }
  nextId = 1;

  currentMode = m;
  prefs.begin("proctopen", false);
  prefs.putUChar("mode", (uint8_t)m);
  prefs.end();

  startAP();

  switch (m) {
    case MODE_BLE:
      startBLE();
      break;
    case MODE_AP:
      setupWebSocket();
      httpServer.begin();
      wsStarted = true;
      break;
    case MODE_STA:
      startSTA();
      break;
    case MODE_USB:
      startUSB();
      break;
  }

  pendingTCPStart = true;
}

// ============================================================
//  mDNS
// ============================================================
void startMDNS() {
  if (mdnsRunning) MDNS.end();
  if (MDNS.begin(MDNS_HOST)) {
    MDNS.addService("http", "tcp", 80);
    mdnsRunning = true;
    Serial.println("mDNS: proctopen.local ready");
  } else {
    Serial.println("mDNS: failed");
  }
}

void stopMDNS() {
  if (mdnsRunning) { MDNS.end(); mdnsRunning = false; }
}

// ============================================================
//  BLE
// ============================================================
void startBLE() {
  BLEDevice::init("Proctopen");
  bleServer = BLEDevice::createServer();
  bleServer->setCallbacks(new BLEConnCB());

  BLEService* svc = bleServer->createService(BLE_SVC_UUID);

  bleTxChar = svc->createCharacteristic(
    BLE_TX_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  bleTxChar->addDescriptor(new BLE2902());

  BLECharacteristic* rx = svc->createCharacteristic(
    BLE_RX_UUID,
    BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  rx->setCallbacks(new BLERxCB());

  svc->start();

  BLEAdvertising* adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(BLE_SVC_UUID);
  adv->setScanResponse(true);
  BLEDevice::startAdvertising();

  bleRunning   = true;
  bleConnected = false;
  Serial.println("BLE: advertising as Proctopen");
}

void stopBLE() {
  if (!bleRunning) return;
  BLEDevice::deinit(true);
  bleServer    = nullptr;
  bleTxChar    = nullptr;
  bleRunning   = false;
  bleConnected = false;
}

// ============================================================
//  WiFi AP
// ============================================================
void startAP() {
  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASS);
  Serial.print("AP started — IP: "); Serial.println(WiFi.softAPIP());
  startMDNS();
}

// ============================================================
//  WiFi STA
// ============================================================
void startSTA() {
  if (!staConfigured) {
    configPortalActive = true;
    Serial.println("No STA creds — config portal on AP");
    scanNetworks();
    setupConfigPortal();
    httpServer.begin();
    wsStarted = false;
    return;
  }

  configPortalActive = false;
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(AP_SSID, AP_PASS);
  WiFi.begin(sta_ssid.c_str(), sta_password.c_str());

  staAttempting   = true;
  staAttemptStart = millis();
  staConnected    = false;

  Serial.print("STA connecting to "); Serial.println(sta_ssid);

  setupWebSocket();
  httpServer.begin();
  wsStarted = true;
}

void stopSTA() {
  staConnected       = false;
  staAttempting      = false;
  configPortalActive = false;
}

// ============================================================
//  USB Serial mode
//  Web app sends JSON over serial, ESP32 responds over serial
//  Same JSON protocol as WebSocket — no changes to commands
// ============================================================
void startUSB() {
  usbMode     = true;
  usbInputBuf = "";
  Serial.println("USB: serial mode active — send JSON commands");
  // AP still running for Wemos
}

void stopUSB() {
  usbMode     = false;
  usbInputBuf = "";
}

// ============================================================
//  Push STA credentials to Wemos on AP subnet
// ============================================================
void pushStaCreds(int i) {
  if (!wemos[i].active || !wemos[i].client.connected()) return;
  String pkt = "{\"cmd\":\"sta_creds\","
               "\"ssid\":\"" + sta_ssid + "\","
               "\"pass\":\"" + sta_password + "\"}\n";
  wemos[i].client.print(pkt);
  wemos[i].credsSent = true;
  Serial.print("Pushed STA creds to Wemos ID: "); Serial.println(wemos[i].id);
}

// ============================================================
//  Detect AP subnet (192.168.4.x)
// ============================================================
bool isOnAPNetwork(WiFiClient& c) {
  IPAddress remote = c.remoteIP();
  IPAddress apIP   = WiFi.softAPIP();
  return (remote[0] == apIP[0] &&
          remote[1] == apIP[1] &&
          remote[2] == apIP[2]);
}

// ============================================================
//  Find a slot by MAC — returns slot index or -1
// ============================================================
int findSlotByMAC(String mac) {
  for (int i = 0; i < MAX_WEMOS; i++) {
    if (wemos[i].mac == mac) return i;
  }
  return -1;
}

// ============================================================
//  Handle hello packet — MAC identification
//  Called when Wemos sends {"event":"hello","mac":"XX:XX:..."}
// ============================================================
void handleHello(int slotIndex, String mac) {
  // Check if this MAC was seen before (reconnect)
  int prevSlot = -1;
  for (int i = 0; i < MAX_WEMOS; i++) {
    if (i == slotIndex) continue;
    if (wemos[i].mac == mac) { prevSlot = i; break; }
  }

  if (prevSlot >= 0) {
    // Known MAC — carry over ID and compensation from previous slot
    wemos[slotIndex].id           = wemos[prevSlot].id;
    wemos[slotIndex].compensation = wemos[prevSlot].compensation;
    wemos[slotIndex].disconnectedAt = wemos[prevSlot].disconnectedAt;
    // Clear the old ghost slot
    wemos[prevSlot].mac          = "";
    wemos[prevSlot].compensation = 0;
    Serial.print("Wemos reconnected — reusing ID: ");
    Serial.println(wemos[slotIndex].id);
  } else {
    // New MAC — ID already assigned in acceptWemos, just record it
    Serial.print("Wemos new — ID: "); Serial.print(wemos[slotIndex].id);
    Serial.print(" MAC: "); Serial.println(mac);
  }

  wemos[slotIndex].mac        = mac;
  wemos[slotIndex].identified = true;

  // Apply compensation for reconnect during running exam
  if (examState == EXAM_RUNNING) {
    long gap = (long)(millis() - wemos[slotIndex].disconnectedAt);
    if (gap > 0 && wemos[slotIndex].disconnectedAt > 0) {
      wemos[slotIndex].compensation += gap;
    }
    long compensated = remainingMs + wemos[slotIndex].compensation;
    Serial.print("Compensation for ID "); Serial.print(wemos[slotIndex].id);
    Serial.print(": gap="); Serial.print(gap);
    Serial.print("ms total comp="); Serial.print(wemos[slotIndex].compensation);
    Serial.print("ms sending="); Serial.println(compensated);
    wemos[slotIndex].client.print(
      "{\"cmd\":\"sync\",\"remaining_ms\":" + String(compensated) + "}\n");
    wemos[slotIndex].client.print("{\"cmd\":\"start\"}\n");
  } else if (examState == EXAM_PAUSED) {
    long gap = (long)(millis() - wemos[slotIndex].disconnectedAt);
    if (gap > 0 && wemos[slotIndex].disconnectedAt > 0) {
      wemos[slotIndex].compensation += gap;
    }
    long compensated = remainingMs + wemos[slotIndex].compensation;
    wemos[slotIndex].client.print(
      "{\"cmd\":\"sync\",\"remaining_ms\":" + String(compensated) + "}\n");
    wemos[slotIndex].client.print("{\"cmd\":\"pause\"}\n");
  } else if (examState == EXAM_READY) {
    wemos[slotIndex].client.print(
      "{\"cmd\":\"timer\",\"duration_ms\":" + String(remainingMs) + "}\n");
  }

  // Notify web app — include MAC so web can match to stored seat
  sendWeb("{\"event\":\"wemos_connected\","
          "\"id\":"    + String(wemos[slotIndex].id) + ","
          "\"mac\":\"" + mac + "\","
          "\"via\":\"" + String(wemos[slotIndex].onAP ? "ap" : "sta") + "\"}");
}

// ============================================================
//  Config portal
// ============================================================
void scanNetworks() {
  wifi_mode_t prev = WiFi.getMode();
  if (prev == WIFI_AP) WiFi.mode(WIFI_AP_STA);
  int n = WiFi.scanNetworks();
  scannedNets = "[";
  for (int i = 0; i < n; i++) {
    if (i > 0) scannedNets += ",";
    scannedNets += "{\"ssid\":\"" + WiFi.SSID(i)
                + "\",\"rssi\":"  + WiFi.RSSI(i)
                + ",\"secure\":"
                + (WiFi.encryptionType(i) != WIFI_AUTH_OPEN ? "true" : "false")
                + "}";
  }
  scannedNets += "]";
  if (prev == WIFI_AP) WiFi.mode(WIFI_AP);
}

void setupConfigPortal() {
  httpServer.on("/", HTTP_GET, [](AsyncWebServerRequest* req) {
    String html = R"rawhtml(
<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Proctopen Setup</title>
<style>
  body{font-family:sans-serif;background:#111;color:#eee;
       display:flex;flex-direction:column;align-items:center;
       padding:2rem;gap:1rem;max-width:400px;margin:auto}
  h2{color:#7c6fff;margin:0}
  .net{background:#1c1c22;border:1px solid #333;border-radius:8px;
       padding:.7rem 1rem;cursor:pointer;width:100%;
       display:flex;justify-content:space-between;align-items:center}
  .net:hover{border-color:#7c6fff}
  input{width:100%;padding:.6rem;border-radius:6px;
        border:1px solid #333;background:#1a1a1a;color:#eee;font-size:1rem}
  button{background:#7c6fff;color:#fff;border:none;padding:.7rem;
         border-radius:6px;font-size:1rem;cursor:pointer;
         width:100%;font-weight:600}
  #msg{color:#7c6fff;font-size:.85rem;min-height:1rem}
</style></head><body>
<h2>Proctopen Wi-Fi Setup</h2>
<p style="color:#555;font-size:.85rem;margin:0">Select your router network.</p>
<div id="nets"></div>
<input id="ssid" placeholder="Network SSID"/>
<input id="pass" type="password" placeholder="Password (blank if open)"/>
<button onclick="save()">Save &amp; Connect</button>
<div id="msg"></div>
<script>
const nets=)rawhtml" + scannedNets + R"rawhtml(;
nets.sort((a,b)=>b.rssi-a.rssi).forEach(n=>{
  const d=document.createElement('div');
  d.className='net';
  d.innerHTML=`<span>${n.ssid}</span>
    <span style="font-size:.8rem;color:#555">
    ${n.secure?'🔒 ':''}${n.rssi}dBm</span>`;
  d.onclick=()=>document.getElementById('ssid').value=n.ssid;
  document.getElementById('nets').appendChild(d);
});
function save(){
  const s=document.getElementById('ssid').value.trim();
  const p=document.getElementById('pass').value;
  if(!s){document.getElementById('msg').textContent='Enter a network name';return;}
  document.getElementById('msg').textContent='Saving...';
  fetch('/save?ssid='+encodeURIComponent(s)+'&pass='+encodeURIComponent(p))
    .then(r=>r.text())
    .then(t=>document.getElementById('msg').textContent=t);
}
</script></body></html>)rawhtml";
    req->send(200, "text/html", html);
  });

  httpServer.on("/save", HTTP_GET, [](AsyncWebServerRequest* req) {
    if (!req->hasParam("ssid")) {
      req->send(400, "text/plain", "Missing SSID"); return;
    }
    String s = req->getParam("ssid")->value();
    String p = req->hasParam("pass") ? req->getParam("pass")->value() : "";
    prefs.begin("proctopen", false);
    prefs.putString("ssid", s);
    prefs.putString("pass", p);
    prefs.end();
    sta_ssid = s; sta_password = p; staConfigured = true;
    req->send(200, "text/plain", "Saved! Rebooting...");
    delay(1500);
    ESP.restart();
  });

  httpServer.on("/scan", HTTP_GET, [](AsyncWebServerRequest* req) {
    scanNetworks();
    req->send(200, "application/json", scannedNets);
  });
}

// ============================================================
//  WebSocket
// ============================================================
void setupWebSocket() {
  ws.onEvent(onWsEvent);
  httpServer.addHandler(&ws);
  httpServer.on("/", HTTP_GET, [](AsyncWebServerRequest* req) {
    req->send(200, "text/plain",
      "Proctopen Central v5\nWebSocket: ws://proctopen.local/ws");
  });
}

void stopWebServer() {
  if (wsStarted) {
    ws.closeAll();
    httpServer.end();
    wsStarted = false;
  }
}

// ============================================================
//  TCP server
// ============================================================
void startTCP() {
  if (tcpRunning) return;
  tcpServer.begin();
  tcpRunning = true;
  Serial.println("TCP server on port 8080");
}

void stopTCP() {
  if (!tcpRunning) return;
  for (int i = 0; i < MAX_WEMOS; i++) {
    if (wemos[i].active) { wemos[i].client.stop(); wemos[i].active = false; }
  }
  tcpServer.end();
  tcpRunning = false;
}

void acceptWemos() {
  WiFiClient c = tcpServer.available();
  if (!c) return;

  for (int i = 0; i < MAX_WEMOS; i++) {
    if (!wemos[i].active) {
      bool onAP = isOnAPNetwork(c);

      // Assign slot — MAC and full identity set later in handleHello
      wemos[i].client       = c;
      wemos[i].id           = nextId++;
      wemos[i].active       = true;
      wemos[i].buf          = "";
      wemos[i].onAP         = onAP;
      wemos[i].credsSent    = false;
      wemos[i].lastPing     = millis();
      wemos[i].disconnectedAt = millis();
      wemos[i].compensation = 0;
      wemos[i].mac          = "";
      wemos[i].identified   = false;

      Serial.print("Wemos TCP connected — slot "); Serial.print(i);
      Serial.print(" via "); Serial.println(onAP ? "AP" : "STA");

      // Push credentials if needed
      if (currentMode == MODE_STA && onAP && staConnected)
        pushStaCreds(i);
      if (currentMode == MODE_AP)
        wemos[i].client.print("{\"cmd\":\"clear_creds\"}\n");

      // NOTE: exam state catch-up sent after hello identifies the unit
      return;
    }
  }
  c.stop();
  Serial.println("Max Wemos clients reached");
}

void readWemos() {
  for (int i = 0; i < MAX_WEMOS; i++) {
    if (!wemos[i].active) continue;

    if (!wemos[i].client.connected() ||
        (millis() - wemos[i].lastPing > 8000)) {
      Serial.print("Wemos disconnected — ID: "); Serial.print(wemos[i].id);
      Serial.print(" MAC: "); Serial.println(wemos[i].mac);

      wemos[i].disconnectedAt = millis();

      sendWeb("{\"event\":\"wemos_disconnected\","
              "\"id\":"    + String(wemos[i].id) + ","
              "\"mac\":\"" + wemos[i].mac + "\"}");

      wemos[i].client.stop();
      wemos[i].active     = false;
      wemos[i].identified = false;
      // Keep mac and compensation in slot so handleHello can recover them

      bool anyActive = false;
      for (int j = 0; j < MAX_WEMOS; j++)
        if (wemos[j].active) { anyActive = true; break; }
      if (!anyActive) {
        nextId = 1;
        Serial.println("All Wemos disconnected — ID counter reset");
      }
      continue;
    }

    while (wemos[i].client.available()) {
      char c = wemos[i].client.read();
      if (c == '\n') {
        wemos[i].buf.trim();
        if (wemos[i].buf.length() > 0) {
          // Handle ping
          if (wemos[i].buf == "{\"event\":\"ping\"}") {
            wemos[i].lastPing = millis();
          }
          // Handle hello — MAC identification
          else if (wemos[i].buf.startsWith("{\"event\":\"hello\"")) {
            JsonDocument doc;
            if (deserializeJson(doc, wemos[i].buf) == DeserializationError::Ok) {
              String mac = doc["mac"].as<String>();
              if (mac.length() > 0) handleHello(i, mac);
            }
          }
        }
        wemos[i].buf = "";
      } else {
        wemos[i].buf += c;
      }
    }
  }
}

// ============================================================
//  Per-unit sync — preserves individual compensation
// ============================================================
void sendPerUnitSync() {
  for (int i = 0; i < MAX_WEMOS; i++) {
    if (wemos[i].active && wemos[i].client.connected()) {
      long compensated = remainingMs + wemos[i].compensation;
      wemos[i].client.print(
        "{\"cmd\":\"sync\",\"remaining_ms\":"
        + String(compensated) + "}\n");
    }
  }
}

// ============================================================
//  Command handler
// ============================================================
void handleWebCommand(String json) {
  if (!usbMode) {
    Serial.print("Web cmd: "); Serial.println(json);
  }

  JsonDocument doc;
  if (deserializeJson(doc, json) != DeserializationError::Ok) return;
  String cmd = doc["cmd"].as<String>();

  // ── Global exam commands ─────────────────────────────────
  if (cmd == "timer") {
    remainingMs = doc["duration_ms"].as<long>();
    examState   = EXAM_READY;
    // Reset compensation when new timer is set
    for (int i = 0; i < MAX_WEMOS; i++) wemos[i].compensation = 0;
    broadcastWemos("{\"cmd\":\"timer\",\"duration_ms\":"
                  + String(remainingMs) + "}\n");
  }
  else if (cmd == "start") {
    examState  = EXAM_RUNNING;
    lastMillis = lastSync = millis();
    broadcastWemos("{\"cmd\":\"start\"}\n");
    sendWeb("{\"event\":\"started\"}");
  }
  else if (cmd == "pause") {
    examState = EXAM_PAUSED;
    broadcastWemos("{\"cmd\":\"pause\"}\n");
    sendWeb("{\"event\":\"paused\"}");
  }
  else if (cmd == "end") {
    examState   = EXAM_ENDED;
    remainingMs = 0;
    for (int i = 0; i < MAX_WEMOS; i++) wemos[i].compensation = 0;
    broadcastWemos("{\"cmd\":\"end\"}\n");
    sendWeb("{\"event\":\"ended\"}");
  }
  else if (cmd == "reset") {
    examState   = EXAM_IDLE;
    remainingMs = 0;
    for (int i = 0; i < MAX_WEMOS; i++) wemos[i].compensation = 0;
    broadcastWemos("{\"cmd\":\"reset\"}\n");
    sendWeb("{\"event\":\"reset\"}");
  }

  // ── Targeted commands (by device_id or mac) ──────────────
  else if (cmd == "warn") {
    sendWemosByID(doc["device_id"].as<uint8_t>(), "{\"cmd\":\"warn\"}\n");
  }
  else if (cmd == "enable") {
    sendWemosByID(doc["device_id"].as<uint8_t>(), "{\"cmd\":\"enable\"}\n");
  }
  else if (cmd == "disable") {
    uint8_t id  = doc["device_id"].as<uint8_t>();
    String  pkt = "{\"cmd\":\"disable\"";
    if (doc.containsKey("punish_ms"))
      pkt += ",\"punish_ms\":" + String(doc["punish_ms"].as<long>());
    pkt += "}\n";
    sendWemosByID(id, pkt);
  }
  else if (cmd == "deduct") {
    sendWemosByID(doc["device_id"].as<uint8_t>(),
      "{\"cmd\":\"deduct\",\"time_ms\":"
      + String(doc["time_ms"].as<long>()) + "}\n");
  }

  // ── Seat assignment ──────────────────────────────────────
  // Web sends: {"cmd":"seat","device_id":1,"number":5}
  else if (cmd == "seat") {
    sendWemosByID(doc["device_id"].as<uint8_t>(),
      "{\"cmd\":\"seat\",\"number\":"
      + String(doc["number"].as<int>()) + "}\n");
  }

  // ── Beep ─────────────────────────────────────────────────
  // Web sends: {"cmd":"beep","device_id":1}
  else if (cmd == "beep") {
    sendWemosByID(doc["device_id"].as<uint8_t>(), "{\"cmd\":\"beep\"}\n");
  }

  // ── Mode / WiFi management ───────────────────────────────
  else if (cmd == "set_mode") {
    String m = doc["mode"].as<String>();
    if      (m == "ble") switchMode(MODE_BLE);
    else if (m == "ap")  switchMode(MODE_AP);
    else if (m == "sta") switchMode(MODE_STA);
    else if (m == "usb") switchMode(MODE_USB);
  }
  else if (cmd == "forget_wifi") {
    prefs.begin("proctopen", false);
    prefs.remove("ssid"); prefs.remove("pass");
    prefs.end();
    sta_ssid = ""; sta_password = ""; staConfigured = false;
    broadcastWemos("{\"cmd\":\"clear_creds\"}\n");
    sendWeb("{\"event\":\"wifi_forgotten\"}");
  }
}

// ============================================================
//  Broadcast to all Wemos
// ============================================================
void broadcastWemos(String msg) {
  for (int i = 0; i < MAX_WEMOS; i++)
    if (wemos[i].active && wemos[i].client.connected())
      wemos[i].client.print(msg);
}

// ============================================================
//  Send to specific Wemos by session ID
// ============================================================
void sendWemosByID(uint8_t id, String msg) {
  for (int i = 0; i < MAX_WEMOS; i++) {
    if (wemos[i].active && wemos[i].id == id
        && wemos[i].client.connected()) {
      wemos[i].client.print(msg);
      return;
    }
  }
  Serial.print("Wemos ID not found: "); Serial.println(id);
}

// ============================================================
//  Send to specific Wemos by MAC (for fixed mode)
// ============================================================
void sendWemosByMAC(String mac, String msg) {
  for (int i = 0; i < MAX_WEMOS; i++) {
    if (wemos[i].active && wemos[i].mac == mac
        && wemos[i].client.connected()) {
      wemos[i].client.print(msg);
      return;
    }
  }
  Serial.print("Wemos MAC not found: "); Serial.println(mac);
}

// ============================================================
//  Send to web app — WebSocket, BLE, or USB serial
// ============================================================
void sendWeb(String json) {
  if (bleRunning && bleConnected && bleTxChar) {
    bleTxChar->setValue(json.c_str());
    bleTxChar->notify();
  }
  if (wsStarted) {
    ws.textAll(json);
  }
  if (usbMode) {
    Serial.println(json);
  }
}

// ============================================================
//  Display
// ============================================================
void updateDisplay() {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);

  display.setCursor(0, 0);
  display.print("["); display.print(modeNames[currentMode]); display.print("]");

  display.setCursor(0, 11);
  display.print("AP: "); display.print(WiFi.softAPIP());

  display.setCursor(0, 21);
  switch (currentMode) {
    case MODE_BLE:
      display.print(bleConnected ? "BLE: connected" : "BLE: waiting...");
      break;
    case MODE_AP:
      display.print("proctopen.local");
      break;
    case MODE_STA:
      if (configPortalActive)
        display.print("Setup: 192.168.4.1");
      else if (staConnected) {
        display.print("STA: "); display.print(WiFi.localIP());
      } else if (staAttempting) {
        long rem = (STA_CONNECT_TIMEOUT_MS
                   - (long)(millis() - staAttemptStart)) / 1000;
        if (rem < 0) rem = 0;
        display.print("STA: connecting (");
        display.print(rem); display.print("s)");
      } else {
        display.print("STA: failed");
      }
      break;
    case MODE_USB:
      display.print("USB Serial active");
      break;
  }

  display.setCursor(0, 31);
  if (mdnsRunning) display.print("proctopen.local");

  int cnt = 0;
  for (int i = 0; i < MAX_WEMOS; i++) if (wemos[i].active) cnt++;
  display.setCursor(0, 41);
  display.print("Units: "); display.print(cnt);

  display.setCursor(0, 51);
  switch (examState) {
    case EXAM_IDLE:   display.print("Idle"); break;
    case EXAM_ENDED:  display.print("Exam ended"); break;
    case EXAM_READY: {
      display.print("Ready  ");
      int m = (remainingMs/1000)/60, s = (remainingMs/1000)%60;
      if (m<10) display.print("0"); display.print(m);
      display.print(":");
      if (s<10) display.print("0"); display.print(s);
      break;
    }
    case EXAM_PAUSED: {
      display.print("PAUSED  ");
      int m = (remainingMs/1000)/60, s = (remainingMs/1000)%60;
      if (m<10) display.print("0"); display.print(m);
      display.print(":");
      if (s<10) display.print("0"); display.print(s);
      break;
    }
    case EXAM_RUNNING: {
      display.fillRect(0, 41, 128, 23, SSD1306_BLACK);
      display.setTextSize(2);
      display.setCursor(14, 44);
      int m = (remainingMs/1000)/60, s = (remainingMs/1000)%60;
      if (m<10) display.print("0"); display.print(m);
      display.print(":");
      if (s<10) display.print("0"); display.print(s);
      display.setTextSize(1);
      break;
    }
  }

  display.display();
}
