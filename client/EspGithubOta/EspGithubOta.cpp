/**
 * @file EspGithubOta.cpp
 * @brief Hiện thực thư viện EspGithubOta cho ESP32 / ESP32-C3 / ESP32-S3
 * @license Apache-2.0
 */

#include "EspGithubOta.h"
#include <esp_crt_bundle.h>
#include <esp_wifi.h>

EspGithubOta::EspGithubOta()
    : _currentVersion("1.0.0"),
      _channel("stable"),
      _checkIntervalMs(21600000UL), // 6 hours
      _lastCheckMs(0),
      _currentJitterMs(0),
      _beforeUpdateCb(nullptr),
      _progressCb(nullptr),
      _statusCb(nullptr) {
  _deviceId = WiFi.macAddress();
  _deviceId.replace(":", "");
  _currentJitterMs = random(0, 300000); // 0 to 5 mins jitter
}

void EspGithubOta::begin(const String& baseUrl, const String& projectSlug, const String& currentVersion, const String& channel) {
  _baseUrl = baseUrl;
  if (!_baseUrl.endsWith("/")) {
    _baseUrl += "/";
  }
  _projectSlug = projectSlug;
  _currentVersion = currentVersion;
  _channel = channel;

  if (_deviceId.length() == 0) {
    _deviceId = WiFi.macAddress();
    _deviceId.replace(":", "");
  }

  _log("Khoi tao OTA Hub: Project=" + _projectSlug + ", Channel=" + _channel +
       ", Version=" + _currentVersion + ", DeviceID=" + _deviceId);
}

void EspGithubOta::setCheckInterval(uint32_t intervalSeconds, uint32_t maxJitterSeconds) {
  _checkIntervalMs = intervalSeconds * 1000UL;
  _currentJitterMs = random(0, maxJitterSeconds * 1000UL);
}

void EspGithubOta::loop() {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  uint32_t now = millis();
  if (_lastCheckMs == 0 || (now - _lastCheckMs >= (_checkIntervalMs + _currentJitterMs))) {
    _lastCheckMs = now;
    _currentJitterMs = random(0, 300000); // regenerate jitter for next interval
    _log("Kiem tra cap nhat dinh ky theo chu ky hen gio...");
    checkAndUpdate();
  }
}

void EspGithubOta::applyEsp32c3TxPowerLimit() {
  // Bắt buộc với ESP32-C3 để duy trì ổn định nguồn và RF
  WiFi.setTxPower(WIFI_POWER_8_5dBm);
  esp_wifi_set_max_tx_power(34); // 34 tương đương 8.5 dBm trong ESP-IDF
  Serial.println(F("[EspGithubOta] Da ap dung gioi han cong suat phat WiFi 8.5 dBm cho ESP32-C3"));
}

bool EspGithubOta::markAppValid() {
  esp_err_t err = esp_ota_mark_app_valid_cancel_rollback();
  if (err == ESP_OK) {
    Serial.println(F("[EspGithubOta] ✅ Da xac nhan firmware hop le! Huy rollback bootloader thanh cong."));
    return true;
  } else {
    Serial.printf("[EspGithubOta] ⚠️ Khong the danh dau app valid (ma loi: 0x%X)\n", err);
    return false;
  }
}

void EspGithubOta::markAppInvalidAndRollback() {
  Serial.println(F("[EspGithubOta] ❌ Self-test that bai! Khoi dong lai ve phien ban firmware cu..."));
  esp_ota_mark_app_invalid_rollback_and_reboot();
}

int EspGithubOta::compareSemver(const String& a, const String& b) {
  // Simple semver comparison helper (Major.Minor.Patch)
  int a1 = 0, a2 = 0, a3 = 0;
  int b1 = 0, b2 = 0, b3 = 0;
  sscanf(a.c_str(), "%d.%d.%d", &a1, &a2, &a3);
  sscanf(b.c_str(), "%d.%d.%d", &b1, &b2, &b3);

  if (a1 != b1) return a1 - b1;
  if (a2 != b2) return a2 - b2;
  if (a3 != b3) return a3 - b3;
  return 0;
}

uint32_t EspGithubOta::_calculateRolloutSlot(const String& deviceId, const String& version) {
  String str = deviceId + ":" + version;
  uint32_t hash = 5381;
  for (size_t i = 0; i < str.length(); i++) {
    hash = ((hash << 5) + hash) + (uint8_t)str.charAt(i);
  }
  return hash % 100;
}

String EspGithubOta::_cleanUrl(const String& base, const String& rel) {
  if (rel.startsWith("http://") || rel.startsWith("https://")) {
    return rel;
  }
  String b = base;
  if (!b.endsWith("/")) b += "/";
  String r = rel;
  while (r.startsWith("/")) r = r.substring(1);
  return b + r;
}

void EspGithubOta::_log(const String& msg) {
  Serial.print(F("[EspGithubOta] "));
  Serial.println(msg);
}

void EspGithubOta::_notifyStatus(OtaStatus status, const String& msg) {
  _log(msg);
  if (_statusCb) {
    _statusCb(status, msg);
  }
}

bool EspGithubOta::_fetchManifest(OtaManifestData& manifest) {
  if (WiFi.status() != WL_CONNECTED) {
    _notifyStatus(OtaStatus::NETWORK_ERROR, "WiFi chua duoc ket noi.");
    return false;
  }

  WiFiClientSecure client;
  // Su dung CA certificate bundle cua ESP-IDF de kiem tra SSL chung thu GitHub Pages
  // TUYET DOI KHONG dung client.setInsecure()
  client.setCACertBundle(esp_crt_bundle_attach);

  HTTPClient http;
  String manifestUrl = _baseUrl + _projectSlug + "/" + _channel + ".json";
  _log("Tai manifest tu: " + manifestUrl);

  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  http.setTimeout(12000);

  if (!http.begin(client, manifestUrl)) {
    _notifyStatus(OtaStatus::NETWORK_ERROR, "Khong the khoi tao ket noi HTTPS den GitHub Pages");
    return false;
  }

  int httpCode = http.GET();
  if (httpCode != HTTP_CODE_OK) {
    _notifyStatus(OtaStatus::NETWORK_ERROR, "HTTP GET manifest loi, ma phan hoi: " + String(httpCode));
    http.end();
    return false;
  }

  String payload = http.getString();
  http.end();

  // Parsing JSON manifest tuong thich bo nho nho tren ESP32
  // Format mau:
  // { "release": { "version": "1.4.2", "path": "...", "size": 123456, "sha256": "...", "md5": "...", "rollout": 100 } }
  if (payload.indexOf("\"release\":null") != -1 || payload.indexOf("\"release\": null") != -1) {
    _notifyStatus(OtaStatus::NO_UPDATE_AVAILABLE, "Khong co ban phat hanh active nao tren kenh nay.");
    return false;
  }

  int relIdx = payload.indexOf("\"release\"");
  if (relIdx == -1) {
    _notifyStatus(OtaStatus::MANIFEST_PARSE_ERROR, "Manifest khong co truong 'release'");
    return false;
  }

  // Check device pin first
  String pinPattern = "\"" + _deviceId + "\":";
  int pinIdx = payload.indexOf(pinPattern);
  String pinnedVersion = "";
  if (pinIdx != -1) {
    int vStart = payload.indexOf("\"", pinIdx + pinPattern.length());
    if (vStart != -1) {
      int vEnd = payload.indexOf("\"", vStart + 1);
      if (vEnd != -1) {
        pinnedVersion = payload.substring(vStart + 1, vEnd);
        _log("Thiet bi duoc GHIM (PINNED) co dinh vao phien ban: " + pinnedVersion);
      }
    }
  }

  // Parse version
  int verIdx = payload.indexOf("\"version\":", relIdx);
  if (verIdx != -1) {
    int s = payload.indexOf("\"", verIdx + 10);
    int e = payload.indexOf("\"", s + 1);
    manifest.version = payload.substring(s + 1, e);
  }

  // Parse path
  int pathIdx = payload.indexOf("\"path\":", relIdx);
  if (pathIdx != -1) {
    int s = payload.indexOf("\"", pathIdx + 7);
    int e = payload.indexOf("\"", s + 1);
    manifest.path = payload.substring(s + 1, e);
  }

  // Parse size
  int sizeIdx = payload.indexOf("\"size\":", relIdx);
  if (sizeIdx != -1) {
    int s = sizeIdx + 7;
    while (payload.charAt(s) == ' ' || payload.charAt(s) == ':') s++;
    int e = s;
    while (isDigit(payload.charAt(e))) e++;
    manifest.size = payload.substring(s, e).toInt();
  }

  // Parse sha256
  int shaIdx = payload.indexOf("\"sha256\":", relIdx);
  if (shaIdx != -1) {
    int s = payload.indexOf("\"", shaIdx + 9);
    int e = payload.indexOf("\"", s + 1);
    manifest.sha256 = payload.substring(s + 1, e);
  }

  // Parse md5
  int md5Idx = payload.indexOf("\"md5\":", relIdx);
  if (md5Idx != -1) {
    int s = payload.indexOf("\"", md5Idx + 6);
    int e = payload.indexOf("\"", s + 1);
    manifest.md5 = payload.substring(s + 1, e);
  }

  // Parse rollout
  manifest.rollout = 100;
  int rollIdx = payload.indexOf("\"rollout\":", relIdx);
  if (rollIdx != -1) {
    int s = rollIdx + 10;
    while (payload.charAt(s) == ' ' || payload.charAt(s) == ':') s++;
    int e = s;
    while (isDigit(payload.charAt(e))) e++;
    manifest.rollout = payload.substring(s, e).toInt();
  }

  // Parse mandatory
  manifest.mandatory = (payload.indexOf("\"mandatory\":true", relIdx) != -1 || payload.indexOf("\"mandatory\": true", relIdx) != -1);

  // Parse notes
  int notesIdx = payload.indexOf("\"notes\":", relIdx);
  if (notesIdx != -1) {
    int s = payload.indexOf("\"", notesIdx + 8);
    int e = payload.indexOf("\"", s + 1);
    manifest.notes = payload.substring(s + 1, e);
  }

  // If pinned to a specific version, honor pin override
  if (pinnedVersion.length() > 0) {
    if (pinnedVersion != _currentVersion) {
      manifest.hasUpdate = true;
      manifest.version = pinnedVersion;
      manifest.path = _projectSlug + "/" + pinnedVersion + "/firmware.bin";
      manifest.rollout = 100;
      return true;
    } else {
      _notifyStatus(OtaStatus::NO_UPDATE_AVAILABLE, "Thiet bi da o phien ban ghim (" + pinnedVersion + ")");
      return false;
    }
  }

  // Compare semver with current version
  int cmp = compareSemver(manifest.version, _currentVersion);
  if (cmp <= 0) {
    _notifyStatus(OtaStatus::NO_UPDATE_AVAILABLE, "Phien ban tren may (" + _currentVersion + ") da la moi nhat hoac cao hon tren server (" + manifest.version + ")");
    return false;
  }

  manifest.hasUpdate = true;
  return true;
}

OtaStatus EspGithubOta::checkAndUpdate() {
  OtaManifestData manifest;
  memset(&manifest, 0, sizeof(manifest));

  if (!_fetchManifest(manifest)) {
    return OtaStatus::NO_UPDATE_AVAILABLE;
  }

  _log("Phat hien ban cap nhat moi: " + manifest.version + " (Rollout: " + String(manifest.rollout) + "%)");

  // Check rollout percentage using hash(deviceId + version) % 100
  uint32_t slot = _calculateRolloutSlot(_deviceId, manifest.version);
  if ((int)slot >= manifest.rollout && !manifest.mandatory) {
    _notifyStatus(OtaStatus::SKIPPED_BY_ROLLOUT,
                  "Thiet bi nam o slot " + String(slot) + "%, chua den luot cap nhat (Rollout hien tai: " + String(manifest.rollout) + "%)");
    return OtaStatus::SKIPPED_BY_ROLLOUT;
  }

  // Call user onBeforeUpdate hook if set
  if (_beforeUpdateCb) {
    if (!_beforeUpdateCb(manifest)) {
      _notifyStatus(OtaStatus::SKIPPED_BY_APPLICATION, "Ung dung da hoan cap nhat (onBeforeUpdate return false).");
      return OtaStatus::SKIPPED_BY_APPLICATION;
    }
  }

  return _downloadAndFlash(manifest);
}

OtaStatus EspGithubOta::_downloadAndFlash(const OtaManifestData& manifest) {
  WiFiClientSecure client;
  client.setCACertBundle(esp_crt_bundle_attach);

  String downloadUrl = _cleanUrl(_baseUrl, manifest.path);
  _log("Bat dau tai firmware tu: " + downloadUrl);

  HTTPClient http;
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  http.setTimeout(30000);

  if (!http.begin(client, downloadUrl)) {
    _notifyStatus(OtaStatus::NETWORK_ERROR, "Khong the mo ket noi tai firmware");
    return OtaStatus::NETWORK_ERROR;
  }

  int httpCode = http.GET();
  if (httpCode != HTTP_CODE_OK) {
    _notifyStatus(OtaStatus::NETWORK_ERROR, "HTTP GET firmware that bai, code: " + String(httpCode));
    http.end();
    return OtaStatus::NETWORK_ERROR;
  }

  int contentLength = http.getSize();
  if (contentLength <= 0 && manifest.size > 0) {
    contentLength = manifest.size;
  }

  if (!Update.begin(contentLength, U_FLASH)) {
    _notifyStatus(OtaStatus::PARTITION_ERROR, "Khong du bo nho OTA partition: " + String(Update.errorString()));
    http.end();
    return OtaStatus::PARTITION_ERROR;
  }

  WiFiClient* stream = http.getStreamPtr();
  uint8_t buff[1024];
  size_t totalReceived = 0;
  int lastPercent = -1;

  // Setup SHA-256 stream calculation
  mbedtls_sha256_context sha_ctx;
  mbedtls_sha256_init(&sha_ctx);
  mbedtls_sha256_starts(&sha_ctx, 0); // 0 for SHA-256

  _log("Dang ghi vao flash...");

  while (http.connected() && (totalReceived < (size_t)contentLength || contentLength == -1)) {
    size_t sizeAvail = stream->available();
    if (sizeAvail) {
      int c = stream->readBytes(buff, ((sizeAvail > sizeof(buff)) ? sizeof(buff) : sizeAvail));
      if (c > 0) {
        Update.write(buff, c);
        mbedtls_sha256_update(&sha_ctx, buff, c);
        totalReceived += c;

        int percent = (contentLength > 0) ? (int)((totalReceived * 100) / contentLength) : 0;
        if (percent != lastPercent) {
          lastPercent = percent;
          if (_progressCb) {
            _progressCb(totalReceived, contentLength, percent);
          }
          if (percent % 10 == 0) {
            Serial.printf("[EspGithubOta] Tien trinh: %d%% (%d / %d bytes)\n", percent, (int)totalReceived, (int)contentLength);
          }
        }
      }
    }
    delay(1);
  }

  uint8_t sha_output[32];
  mbedtls_sha256_finish(&sha_ctx, sha_output);
  mbedtls_sha256_free(&sha_ctx);

  String computedSha = "";
  for (int i = 0; i < 32; i++) {
    char h[3];
    sprintf(h, "%02x", sha_output[i]);
    computedSha += h;
  }

  http.end();

  if (manifest.sha256.length() > 0 && !manifest.sha256.equalsIgnoreCase(computedSha)) {
    Update.abort();
    _notifyStatus(OtaStatus::CHECKSUM_MISMATCH,
                  "Sai lech ma checksum SHA-256! Ky vong: " + manifest.sha256 + ", Tinh toan: " + computedSha);
    return OtaStatus::CHECKSUM_MISMATCH;
  }

  if (!Update.end(true)) {
    _notifyStatus(OtaStatus::FLASH_WRITE_ERROR, "Loi hoan tat ghi flash: " + String(Update.errorString()));
    return OtaStatus::FLASH_WRITE_ERROR;
  }

  _notifyStatus(OtaStatus::SUCCESS, "🎉 Nap firmware " + manifest.version + " thanh cong! Dang khoi dong lai...");
  delay(1000);
  ESP.restart();
  return OtaStatus::SUCCESS;
}
