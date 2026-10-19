# EspGithubOta: Thư viện OTA GitHub Pages cho ESP32 / C3 / S3

Thư viện client Arduino / PlatformIO cho dòng ESP32 để tự động kiểm tra, xác thực bảo mật và cập nhật firmware qua **GitHub Pages** không cần server riêng.

---

## ⚠️ Nguyên Tắc Bảo Mật & Ràng Buộc Quan Trọng
1. **GitHub Pages là PUBLIC**: Bất kỳ ai biết URL đều có thể tải file `.bin`.
   - **TUYỆT ĐỐI KHÔNG nhúng secret, mật khẩu WiFi, token tài khoản** vào firmware code.
   - Luôn sử dụng `WiFiManager` hoặc ESP Provisioning (BLE/SoftAP) để người dùng tự cấu hình WiFi vào NVS.
2. **GitHub Pages CDN Cache**: GitHub Pages cache file tĩnh khoảng **10 phút**.
   - Sau khi bạn push release mới, manifest có thể mất tối đa ~10 phút để cập nhật trên toàn cầu.
3. **BẮT BUỘC ĐỐI VỚI ESP32-C3**:
   - Giới hạn công suất phát WiFi ở **8.5 dBm** ngay sau khi `WiFi.begin()` và sau mỗi lần thức từ Deep Sleep:
     ```cpp
     WiFi.setTxPower(WIFI_POWER_8_5dBm);
     ```
   - Điều này giúp tránh hiện tượng sụt áp dòng tức thời gây reset chip và hỏng RF.
4. **HTTPS Thật & CA Bundle**:
   - Thư viện sử dụng `esp_crt_bundle_attach` để đối chiếu chứng chỉ số SSL của GitHub Pages.
   - **Tuyệt đối KHÔNG sử dụng `setInsecure()`**.

---

## Cấu Hình PlatformIO (`platformio.ini`)

Copy file `partitions_two_ota.csv` vào thư mục gốc dự án PlatformIO của bạn:

```ini
[env:esp32c3]
platform = espressif32
board = esp32-c3-devkitm-1
framework = arduino
monitor_speed = 115200

; Định nghĩa phiên bản firmware lúc build
build_flags = 
    -DFW_VERSION=\"1.1.0\"
    -DCONFIG_BOOTLOADER_APP_ROLLBACK_ENABLE=1

; Sử dụng bảng phân vùng 2 slot OTA và hỗ trợ rollback
board_build.partitions = partitions_two_ota.csv

; Thêm thư viện EspGithubOta
lib_extra_dirs = path/to/client
```

---

## Bật Tính Năng Bootloader Rollback Trong ESP-IDF / Arduino

Khi bật tính năng rollback:
1. ESP32 khởi động vào partition firmware mới. Trạng thái partition là `ESP_OTA_IMG_NEW`.
2. Ứng dụng chạy hàm `runHardwareSelfTest()` (kiểm tra cảm biến, kết nối mạng, heap).
3. Nếu thành công: Gọi `EspGithubOta::markAppValid()` -> Bootloader đánh dấu partition là `ESP_OTA_IMG_VALID`.
4. Nếu thất bại hoặc ứng dụng crash liên tục trước khi xác nhận: Bootloader sẽ tự động khởi động lại partition firmware cũ hoạt động gần nhất (`ESP_OTA_IMG_VALID`), loại bỏ hoàn toàn nguy cơ biến thiết bị thành "cục gạch" (bricking).

---

## Cơ Chế Rollout Dần Dần (%) & Ghim Thiết Bị (Pinning)

1. **Ghim thiết bị (Pins)**:
   Nếu địa chỉ MAC hoặc Device ID của thiết bị nằm trong `pins.json` của server:
   ```json
   {
     "84F7031A2B3C": "1.2.0-beta.1"
   }
   ```
   Thiết bị sẽ được ưu tiên nhận đúng phiên bản ghim, bất kể rollout % hay trạng thái channel.

2. **Rollout theo % ngẫu nhiên có tính xác định**:
   Thư viện tính:
   ```cpp
   uint32_t slot = hash(deviceId + ":" + version) % 100;
   if (slot < rolloutPercent) {
       // Được phép cập nhật!
   }
   ```
   Cùng một thiết bị và phiên bản sẽ luôn rơi vào đúng 1 slot cố định từ 0 - 99. Khi bạn tăng rollout từ 10% -> 50% -> 100%, những máy đã cập nhật sẽ không bị lặp lại, và các máy mới sẽ dần dần được cập nhật theo từng đợt an toàn.
