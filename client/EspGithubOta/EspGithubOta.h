/**
 * @file EspGithubOta.h
 * @brief Thư viện OTA cho ESP32 / ESP32-C3 / ESP32-S3 sử dụng GitHub Pages
 * @license Apache-2.0
 */

#ifndef ESP_GITHUB_OTA_H
#define ESP_GITHUB_OTA_H

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Update.h>
#include <esp_ota_ops.h>
#include <esp_app_format.h>
#include <mbedtls/sha256.h>

#ifndef FW_VERSION
#define FW_VERSION "1.0.0"
#endif

// Mã lỗi OTA
enum class OtaStatus {
  SUCCESS = 0,
  NO_UPDATE_AVAILABLE,
  SKIPPED_BY_ROLLOUT,
  SKIPPED_BY_APPLICATION,
  NETWORK_ERROR,
  MANIFEST_PARSE_ERROR,
  INCOMPATIBLE_CHIP,
  CHECKSUM_MISMATCH,
  FLASH_WRITE_ERROR,
  PARTITION_ERROR
};

struct OtaManifestData {
  String version;
  String path;
  size_t size;
  String sha256;
  String md5;
  int rollout;
  bool mandatory;
  String minVersion;
  String notes;
  bool hasUpdate;
};

typedef std::function<bool(const OtaManifestData& manifest)> BeforeUpdateCallback;
typedef std::function<void(size_t progress, size_t total, int percent)> ProgressCallback;
typedef std::function<void(OtaStatus status, const String& message)> StatusCallback;

class EspGithubOta {
public:
  EspGithubOta();

  /**
   * Cấu hình OTA
   * @param baseUrl URL gốc của thư mục ota, ví dụ: "https://<user>.github.io/<repo>/ota/"
   * @param projectSlug Định danh dự án, ví dụ: "smart-meter-c3"
   * @param currentVersion Phiên bản firmware hiện tại (hoặc dùng FW_VERSION)
   * @param channel Kênh phát hành ("stable" hoặc "beta")
   */
  void begin(const String& baseUrl, const String& projectSlug, const String& currentVersion = FW_VERSION, const String& channel = "stable");

  /**
   * Đặt chu kỳ kiểm tra tự động (giây). Mặc định 21600 giây (6 giờ).
   * Thư viện sẽ tự động thêm một khoảng trễ ngẫu nhiên (jitter) để tránh các thiết bị đồng thời query.
   */
  void setCheckInterval(uint32_t intervalSeconds, uint32_t maxJitterSeconds = 300);

  /**
   * Gọi trong hàm loop() của Arduino để kiểm tra định kỳ không block.
   */
  void loop();

  /**
   * Kiểm tra và thực hiện cập nhật ngay lập tức (blocking / synchronous)
   */
  OtaStatus checkAndUpdate();

  /**
   * Đăng ký hàm callback trước khi tải firmware (ví dụ hoãn nếu relay đang đóng hoặc đang đo)
   * Trả về true để tiếp tục cập nhật, false để hoãn.
   */
  void onBeforeUpdate(BeforeUpdateCallback callback) { _beforeUpdateCb = callback; }

  /**
   * Đăng ký callback theo dõi tiến trình tải %
   */
  void onProgress(ProgressCallback callback) { _progressCb = callback; }

  /**
   * Đăng ký callback nhận thông báo trạng thái
   */
  void onStatus(StatusCallback callback) { _statusCb = callback; }

  /**
   * Đặt Device ID tùy chỉnh (mặc định sẽ dùng địa chỉ MAC của chip WiFi)
   */
  void setDeviceId(const String& id) { _deviceId = id; }
  String getDeviceId() const { return _deviceId; }

  /**
   * Bắt buộc với ESP32-C3: giới hạn công suất phát WiFi ở 8.5 dBm
   * Gọi hàm này sau WiFi.begin() và sau khi wake từ Deep Sleep
   */
  static void applyEsp32c3TxPowerLimit();

  /**
   * Xác nhận app hợp lệ sau khi chạy self-test thành công để huỷ rollback
   */
  static bool markAppValid();

  /**
   * Báo app lỗi khi self-test thất bại và kích hoạt rollback ngay lập tức
   */
  static void markAppInvalidAndRollback();

  /**
   * Kiểm tra phiên bản semver: a > b trả về >0, a < b trả về <0, a == b trả về 0
   */
  static int compareSemver(const String& a, const String& b);

private:
  String _baseUrl;
  String _projectSlug;
  String _currentVersion;
  String _channel;
  String _deviceId;

  uint32_t _checkIntervalMs;
  uint32_t _lastCheckMs;
  uint32_t _currentJitterMs;

  BeforeUpdateCallback _beforeUpdateCb;
  ProgressCallback _progressCb;
  StatusCallback _statusCb;

  String _cleanUrl(const String& base, const String& rel);
  bool _fetchManifest(OtaManifestData& manifest);
  bool _isEligibleForRollout(const String& targetVersion, int rolloutPercent);
  OtaStatus _downloadAndFlash(const OtaManifestData& manifest);
  void _log(const String& msg);
  void _notifyStatus(OtaStatus status, const String& msg);
  uint32_t _calculateRolloutSlot(const String& deviceId, const String& version);
};

#endif // ESP_GITHUB_OTA_H
