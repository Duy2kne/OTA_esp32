# ESP32 OTA Multi-Project Hub (100% GitHub-Native)

Hệ thống quản lý và cập nhật firmware OTA đa dự án cho ESP32, ESP32-C3 và ESP32-S3, hoạt động **100% trên hạ tầng GitHub** (GitHub Pages + GitHub Actions), không cần server riêng, không có cơ sở dữ liệu backend, kèm thư viện client C++ cho Arduino / PlatformIO với tính năng tự động rollback và phân phối theo tỉ lệ rollout (%).

---

## ⚡ Các Tính Năng Nổi Bật

- **0 Server Riêng**: File nhị phân và manifest phục vụ tĩnh hoàn toàn trên Fastly CDN của GitHub Pages.
- **Git Data API Atomic Commit**: Trình duyệt upload firmware trực tiếp lên GitHub thông qua một commit duy nhất chứa cả `firmware.bin` và `release.json` (blob ➔ tree ➔ commit ➔ update ref).
- **Kiểm Định Header Tức Thì**: Kiểm tra Magic Byte `0xE9`, Chip ID (`ESP32`, `ESP32-C3`, `ESP32-S3`), SHA-256 (Web Crypto) và MD5 ngay trong trình duyệt trước khi cho phép commit.
- **Thư Viện Client ESP32 Bảo Mật**:
  - Xác thực SSL nghiêm ngặt bằng **CA Certificate Bundle** (`esp_crt_bundle_attach`). Tuyệt đối không dùng `setInsecure()`.
  - Phân bổ rollout % xác định theo công thức `hash(deviceId + ":" + version) % 100 < rollout`.
  - Hỗ trợ ghim phiên bản cố định theo thiết bị (`pins.json`).
  - Hỗ trợ **Hardware Self-Test** và **Tự Động Rollback**: Nếu firmware mới lỗi hoặc crash, bootloader sẽ phục hồi bản firmware cũ gần nhất (`esp_ota_mark_app_valid_cancel_rollback()`).
- **Bắt buộc với ESP32-C3**: Tự động áp dụng giới hạn công suất WiFi **8.5 dBm** (`WiFi.setTxPower(WIFI_POWER_8_5dBm)`) chống sụt áp nguồn.

---

## ⚠️ Ràng Buộc & Nguyên Tắc Bảo Mật Cốt Lõi

1. **GitHub Pages Hoàn Toàn PUBLIC**:
   - Bất kỳ ai có đường dẫn URL đều tải được file `.bin`.
   - **TUYỆT ĐỐI KHÔNG nhúng secret (mật khẩu WiFi, API key, token nhạy cảm)** vào mã nguồn firmware.
   - Thiết bị phải sử dụng `WiFiManager` hoặc cơ chế provisioning (ESP-IDF BLE / SoftAP) để người dùng tự cấu hình thông tin mạng vào bộ nhớ NVS.
2. **GitHub Pages Cache CDN ~10 Phút**:
   - GitHub Pages đặt thời gian cache TTL khoảng 600 giây (10 phút).
   - Sau khi bạn phát hành một phiên bản mới hoặc thay đổi tỉ lệ rollout, các thiết bị có thể mất tối đa **~10 phút** để nhận được manifest mới nhất.
3. **BẮT BUỘC ĐỐI VỚI ESP32-C3**:
   - ESP32-C3 có độ nhạy dòng RF cao. Cần giới hạn công suất phát WiFi ở **8.5 dBm** ngay sau khi `WiFi.begin()` và sau mỗi lần thức từ Deep Sleep:
     ```cpp
     WiFi.setTxPower(WIFI_POWER_8_5dBm);
     ```

---

## 📁 Cấu Trúc Dữ Liệu Trong Repository

Repository chính là cơ sở dữ liệu duy nhất (Source of Truth):

```
firmware/
  <project-slug>/
    project.json              # { name, description, chip: "esp32"|"esp32c3"|"esp32s3", channels: ["stable","beta"] }
    pins.json                 # { "<deviceId>": "<version>" } ghim thiết bị cụ thể vào 1 version
    releases/
      <version>/              # Chuẩn SemVer, vd: 1.4.2
        firmware.bin          # Binary compiled, magic byte 0xE9, chip ID khớp project.json
        release.json          # { version, channel, notes, rollout: 0-100, mandatory, sha256, md5, size, status }
```

---

## 🚀 Hướng Dẫn Cài Đặt Từng Bước

### Bước 1: Thiết lập Repository và GitHub Pages
1. Fork hoặc clone repository này về tài khoản GitHub của bạn.
2. Vào tab **Settings** ➔ **Pages**:
   - Tại mục **Build and deployment** > **Source**, chọn: **GitHub Actions**.
3. Khi bạn push commit lên nhánh `main`, workflow `.github/workflows/deploy.yml` sẽ tự động chạy:
   - Cài đặt dependencies (`npm ci`).
   - Chạy kiểm thử tự động với Vitest (`npm test`).
   - Kiểm tra toàn bộ file binary và sinh manifest tĩnh vào thư mục `public/ota/` (`npm run build-ota`).
   - Đóng gói và phát hành lên GitHub Pages (`actions/deploy-pages`).

### Bước 2: Tạo GitHub Fine-grained Personal Access Token (Cho Dashboard Quản Trị)
1. Vào GitHub ➔ **Settings** ➔ **Developer settings** ➔ **Personal access tokens** ➔ **Fine-grained tokens**.
2. Nhấn **Generate new token**:
   - **Repository access**: Chọn *Only select repositories* ➔ Chọn repo OTA này.
   - **Permissions**: Tại mục *Repository permissions*, cấp quyền:
     - **Contents**: **Read and write** (để commit firmware.bin và release.json).
     - **Actions**: **Read** (để theo dõi tiến độ deploy trực tiếp).
3. Copy token và mở Dashboard web ➔ Nhấn **Quản Trị (PAT)** ở góc trên bên phải để đăng nhập.

---

## 🛠️ Tích Hợp Firmware ESP32 (`client/EspGithubOta/`)

### 1. Thêm vào PlatformIO (`platformio.ini`)
Copy thư mục `client/EspGithubOta` và file `client/EspGithubOta/partitions_two_ota.csv` vào dự án của bạn:

```ini
[env:esp32c3]
platform = espressif32
board = esp32-c3-devkitm-1
framework = arduino
monitor_speed = 115200

build_flags =
    -DFW_VERSION=\"1.0.0\"
    -DCONFIG_BOOTLOADER_APP_ROLLBACK_ENABLE=1

board_build.partitions = partitions_two_ota.csv
lib_extra_dirs = client
```

### 2. Mã Nguồn Sketch Arduino Mẫu
```cpp
#include <WiFi.h>
#include <EspGithubOta.h>

#define FW_VERSION "1.0.0"

const char* OTA_BASE_URL = "https://<user>.github.io/<repo>/ota/";
const char* PROJECT_SLUG = "smart-meter-c3";
const char* CHANNEL      = "stable";

EspGithubOta ota;

void setup() {
  Serial.begin(115200);

  // Kết nối WiFi (khuyến khích dùng WiFiManager)
  WiFi.mode(WIFI_STA);
  WiFi.begin("SSID", "PASSWORD");
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }

  // BẮT BUỘC VỚI ESP32-C3: Giới hạn công suất WiFi
  #if defined(CONFIG_IDF_TARGET_ESP32C3) || defined(ARDUINO_ESP32C3_DEV)
    EspGithubOta::applyEsp32c3TxPowerLimit();
  #endif

  // Xác nhận app hợp lệ với Bootloader sau khi self-test
  EspGithubOta::markAppValid();

  // Khởi tạo OTA
  ota.begin(OTA_BASE_URL, PROJECT_SLUG, FW_VERSION, CHANNEL);
  ota.setCheckInterval(21600, 300); // 6 giờ + jitter ngẫu nhiên

  ota.onProgress([](size_t progress, size_t total, int percent) {
    Serial.printf("Nạp OTA: %d%%\n", percent);
  });

  // Kiểm tra ngay lúc bật nguồn
  ota.checkAndUpdate();
}

void loop() {
  ota.loop();
  delay(10);
}
```

---

## 🔄 CI/CD Tự Động Cho Từng Dự Án Firmware

Xem file mẫu `examples/firmware-ci.yml`. Khi bạn tạo release tag (ví dụ `git tag v1.2.0 && git push --tags` trên repo firmware riêng):
1. GitHub Actions biên dịch firmware bằng PlatformIO.
2. Kiểm tra byte `0xE9`, tính SHA-256 và MD5.
3. Tự động commit sang Central OTA Hub repo bằng secret `OTA_REPO_TOKEN`.

---

## 🛡️ Giai Đoạn 6: Ký Số Manifest ECDSA & Báo Cáo Đo Xa

Xem hướng dẫn chi tiết tại `examples/ecdsa-and-reporting/README.md`:
- Ký số SHA-256 bằng khóa riêng tư ECDSA (P-256) tại bước build.
- Nhúng Public Key vào firmware ESP32 để từ chối các bản firmware không có chữ ký hợp lệ.
- Nhận log đo xa (Telemetry / OTA Status) từ thiết bị qua Cloudflare Workers hoàn toàn miễn phí.
