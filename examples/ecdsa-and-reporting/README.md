# Hướng Dẫn Giai Đoạn 6: Ký Số Manifest ECDSA & Báo Cáo OTA

Tùy chọn nâng cao để tối đa hóa tính toàn vẹn và giám sát trực tiếp hàng nghìn thiết bị IoT ngoài hiện trường.

---

## 1. Ký Số Manifest Bằng ECDSA (secp256r1 / P-256)

Mục đích: Đảm bảo dù hacker có chiếm quyền sửa GitHub Pages hoặc can thiệp proxy DNS, thiết bị ESP32 cũng **từ chối nạp firmware** nếu chữ ký số không khớp với Private Key duy nhất của bạn.

### Bước 1: Tạo cặp khóa ECDSA (secp256r1)
Chạy lệnh OpenSSL trên máy cá nhân:
```bash
# Tạo khóa bí mật (Private Key)
openssl ecparam -genkey -name prime256v1 -noout -out ota_private.pem

# Trích xuất khóa công khai (Public Key)
openssl ec -in ota_private.pem -pubout -out ota_public.pem
```

### Bước 2: Lưu Private Key vào GitHub Secrets
- Vào GitHub Repo -> **Settings** -> **Secrets and variables** -> **Actions**.
- Tạo New repository secret: `OTA_ECDSA_PRIVATE_KEY` (dán nội dung file `ota_private.pem`).

### Bước 3: Ký số trong quá trình Build
Khi `scripts/build-ota.ts` sinh file `manifest.json`:
1. Tính `SHA-256` của manifest payload.
2. Dùng thư viện `node:crypto` ký bằng thuật toán `SHA256withECDSA`.
3. Nhúng chữ ký base64 vào trường `"signature": "MEQCI..."` trong manifest.

### Bước 4: Nhúng Public Key vào Firmware ESP32
Trong firmware ESP32, nhúng public key PEM và gọi `mbedtls_ecdsa_read_signature` để xác thực trước khi flash:
```cpp
const char* OTA_PUBLIC_KEY = 
"-----BEGIN PUBLIC KEY-----\n"
"MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...\n"
"-----END PUBLIC KEY-----\n";
```

---

## 2. Nhận Báo Cáo OTA Miễn Phí Qua Cloudflare Workers

Vì GitHub Pages là static nên không thể nhận HTTP POST log từ ESP32. Bạn có thể sử dụng Cloudflare Workers (gói miễn phí 100,000 requests/ngày) để tiếp nhận log báo cáo trạng thái OTA.

### File Worker Mẫu (`worker.js`):
```javascript
export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'POST') {
      return new Response('Only POST allowed', { status: 405 });
    }

    try {
      const data = await request.json();
      // data: { deviceId, project, version, oldVersion, status, freeHeap, rssi, error }
      console.log(`[OTA Report] ${data.deviceId} -> ${data.project}@${data.version}: ${data.status}`);

      // Gửi thông báo đến Telegram / Discord Webhook (tùy chọn)
      if (env.DISCORD_WEBHOOK_URL) {
        await fetch(env.DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `🚀 **ESP32 OTA Report**\n• Device: \`${data.deviceId}\`\n• Project: \`${data.project}\`\n• Target: \`${data.version}\`\n• Status: **${data.status}**\n• Details: ${data.error || 'Thành công'}`
          })
        });
      }

      return new Response(JSON.stringify({ success: true, timestamp: Date.now() }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(err.message, { status: 400 });
    }
  }
};
```

### Hàm gửi báo cáo từ ESP32 sau khi nạp xong:
```cpp
void sendOtaReport(const String& targetVersion, const String& status, const String& errorMsg = "") {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  WiFiClientSecure client;
  client.setCACertBundle(esp_crt_bundle_attach);

  http.begin(client, "https://ota-report.<ten-worker>.workers.dev/report");
  http.addHeader("Content-Type", "application/json");

  String payload = "{";
  payload += "\"deviceId\":\"" + WiFi.macAddress() + "\",";
  payload += "\"project\":\"smart-meter-c3\",";
  payload += "\"version\":\"" + targetVersion + "\",";
  payload += "\"oldVersion\":\"" + String(FW_VERSION) + "\",";
  payload += "\"status\":\"" + status + "\",";
  payload += "\"error\":\"" + errorMsg + "\",";
  payload += "\"freeHeap\":" + String(ESP.getFreeHeap()) + ",";
  payload += "\"rssi\":" + String(WiFi.RSSI());
  payload += "}";

  http.POST(payload);
  http.end();
}
```
