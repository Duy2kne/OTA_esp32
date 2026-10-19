/**
 * @file BasicOta.ino
 * @brief Ví dụ cơ bản sử dụng EspGithubOta để cập nhật firmware qua GitHub Pages
 *
 * LƯU Ý BẢO MẬT:
 * 1. KHÔNG nhúng cứng mật khẩu WiFi hoặc API Token nhạy cảm vào firmware vì GitHub Pages là PUBLIC!
 *    Nên dùng WiFiManager, ESP-IDF Provisioning (BLE/WiFi SoftAP) hoặc NVS.
 * 2. Đối với ESP32-C3: BẮT BUỘC gọi WiFi.setTxPower(WIFI_POWER_8_5dBm) sau WiFi.begin()
 *    để chống sụt áp nguồn và ổn định RF.
 */

#include <WiFi.h>
#include <EspGithubOta.h>

#define FW_VERSION "1.0.0"

// Thay thế bằng URL GitHub Pages của bạn (kết thúc bằng /ota/)
const char* OTA_BASE_URL = "https://<user>.github.io/<repo>/ota/";
const char* PROJECT_SLUG = "smart-meter-c3";
const char* CHANNEL      = "stable"; // hoặc "beta"

EspGithubOta ota;

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n--- Khởi động thiết bị ---");
  Serial.printf("Phiên bản hiện tại: %s\n", FW_VERSION);

  // KẾT NỐI WIFI
  // Khuyến nghị: Sử dụng WiFiManager thay vì hardcode thông tin WiFi
  WiFi.mode(WIFI_STA);
  WiFi.begin("TEN_WIFI_CUA_BAN", "MAT_KHAU_WIFI");

  Serial.print("Đang kết nối WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi đã kết nối thành công!");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());

  // BẮT BUỘC VỚI ESP32-C3: Giới hạn công suất phát WiFi ở 8.5 dBm
  // Gọi ngay sau WiFi.begin() và sau mỗi lần thức từ Deep Sleep
  #if defined(CONFIG_IDF_TARGET_ESP32C3) || defined(ARDUINO_ESP32C3_DEV)
    EspGithubOta::applyEsp32c3TxPowerLimit();
  #endif

  // Cấu hình OTA Hub
  ota.begin(OTA_BASE_URL, PROJECT_SLUG, FW_VERSION, CHANNEL);

  // Đặt chu kỳ kiểm tra tự động 6 giờ (21600s), kèm jitter ngẫu nhiên tối đa 300s
  ota.setCheckInterval(21600, 300);

  // Đăng ký callback theo dõi tiến trình
  ota.onProgress([](size_t progress, size_t total, int percent) {
    Serial.printf("Tải OTA: %d%% (%d / %d bytes)\n", percent, (int)progress, (int)total);
  });

  ota.onStatus([](OtaStatus status, const String& msg) {
    Serial.printf("[Trạng thái OTA] %s\n", msg.c_str());
  });

  // Kiểm tra cập nhật ngay khi vừa bật nguồn
  Serial.println("Kiểm tra cập nhật OTA ngay lúc khởi động...");
  ota.checkAndUpdate();
}

void loop() {
  // Hàm loop non-blocking kiểm tra định kỳ theo hẹn giờ
  ota.loop();

  // Thực hiện các tác vụ bình thường của ứng dụng tại đây
  delay(100);
}
