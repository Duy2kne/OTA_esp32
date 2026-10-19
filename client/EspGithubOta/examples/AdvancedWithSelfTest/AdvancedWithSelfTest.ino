/**
 * @file AdvancedWithSelfTest.ino
 * @brief Ví dụ nâng cao: Kiểm tra tính hợp lệ phần cứng (Self-Test) & Rollback tự động
 *
 * Tính năng nâng cao:
 * 1. Hoãn cập nhật (onBeforeUpdate) nếu thiết bị đang bận (relay đang bật, đang đo).
 * 2. Tự kiểm tra (Self-test) sau khi nạp firmware mới (kết nối ngoại vi, cảm biến).
 * 3. Nếu self-test đạt: gọi EspGithubOta::markAppValid() để bootloader lưu phiên bản mới.
 * 4. Nếu self-test lỗi (cảm biến đơ, lỗi khởi tạo): gọi EspGithubOta::markAppInvalidAndRollback()
 *    để bootloader tự động phục hồi về firmware cũ ngay lập tức!
 */

#include <WiFi.h>
#include <EspGithubOta.h>

#define FW_VERSION "1.1.0"

const char* OTA_BASE_URL = "https://<user>.github.io/<repo>/ota/";
const char* PROJECT_SLUG = "smart-meter-c3";
const char* CHANNEL      = "stable";

EspGithubOta ota;
bool isSystemBusyWithMeasurement = false;

// Hàm tự kiểm tra sức khỏe thiết bị sau khi boot
bool runHardwareSelfTest() {
  Serial.println(F("\n[Self-Test] Đang chạy kiểm tra phần cứng & ngoại vi..."));

  // 1. Kiểm tra kết nối cảm biến I2C / SPI (mô phỏng)
  delay(500);
  bool sensorOk = true;

  // 2. Kiểm tra bộ nhớ Heap khả dụng
  uint32_t freeHeap = ESP.getFreeHeap();
  Serial.printf("[Self-Test] Free Heap: %u bytes\n", freeHeap);
  bool heapOk = (freeHeap > 40000);

  // 3. Kiểm tra kết nối mạng
  bool networkOk = (WiFi.status() == WL_CONNECTED);

  bool allPassed = sensorOk && heapOk && networkOk;
  Serial.printf("[Self-Test] Kết quả kiểm tra: %s\n", allPassed ? "ĐẠT (PASS)" : "HỎNG (FAIL)");
  return allPassed;
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n--- Khởi động thiết bị (Phiên bản: " FW_VERSION ") ---");

  WiFi.mode(WIFI_STA);
  WiFi.begin("TEN_WIFI_CUA_BAN", "MAT_KHAU_WIFI");

  int retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 20) {
    delay(500);
    Serial.print(".");
    retry++;
  }
  Serial.println("\nWiFi kết nối thành công!");

  // Bắt buộc với ESP32-C3: Giới hạn công suất phát WiFi 8.5 dBm
  #if defined(CONFIG_IDF_TARGET_ESP32C3) || defined(ARDUINO_ESP32C3_DEV)
    EspGithubOta::applyEsp32c3TxPowerLimit();
  #endif

  // THỰC HIỆN SELF-TEST ĐỂ QUYẾT ĐỊNH XÁC NHẬN HOẶC ROLLBACK
  if (runHardwareSelfTest()) {
    // Nếu kiểm tra thành công, xác nhận app hợp lệ với bootloader
    EspGithubOta::markAppValid();
  } else {
    // Nếu kiểm tra hỏng, quay về firmware hoạt động gần nhất
    Serial.println(F("[CẢNH BÁO] Phần cứng không vượt qua Self-test! Rollback về bản cũ..."));
    EspGithubOta::markAppInvalidAndRollback();
  }

  // Khởi tạo thư viện OTA
  ota.begin(OTA_BASE_URL, PROJECT_SLUG, FW_VERSION, CHANNEL);
  ota.setCheckInterval(14400, 300); // 4 giờ

  // Đăng ký hook kiểm tra điều kiện trước khi tải firmware
  ota.onBeforeUpdate([](const OtaManifestData& manifest) -> bool {
    if (isSystemBusyWithMeasurement) {
      Serial.println(F("[OTA Hoãn] Đang bận thực hiện chu kỳ đo quan trọng, hoãn cập nhật..."));
      return false; // Hoãn cập nhật, lần sau kiểm tra lại
    }
    Serial.printf("[OTA Đồng ý] Sẵn sàng cập nhật lên %s (Mandatory: %s)\n",
                  manifest.version.c_str(), manifest.mandatory ? "Có" : "Không");
    return true;
  });

  ota.onProgress([](size_t progress, size_t total, int percent) {
    Serial.printf("Tiến trình ghi flash: %d%% (%u / %u bytes)\n", percent, progress, total);
  });

  // Kiểm tra cập nhật
  ota.checkAndUpdate();
}

void loop() {
  ota.loop();
  delay(100);
}
