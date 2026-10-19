/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Copy, Check, Code2, Terminal } from 'lucide-react';
import type { EspChip, ReleaseChannel } from '../lib/ota-types.ts';

interface CodeSnippetGeneratorProps {
  projectSlug: string;
  chip: EspChip;
  channel: ReleaseChannel;
  baseUrl: string;
}

export const CodeSnippetGenerator: React.FC<CodeSnippetGeneratorProps> = ({
  projectSlug,
  chip,
  channel,
  baseUrl,
}) => {
  const [tab, setTab] = useState<'arduino' | 'platformio'>('arduino');
  const [copied, setCopied] = useState(false);

  const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

  const arduinoSnippet = `// === TÍCH HỢP ESPGITHUBOTA VÀO SKETCH ARDUINO ===
#include <WiFi.h>
#include <EspGithubOta.h>

#define FW_VERSION "1.0.0"

// URL thư mục OTA trên GitHub Pages (kết thúc bằng /)
const char* OTA_BASE_URL = "${cleanBaseUrl}";
const char* PROJECT_SLUG = "${projectSlug}";
const char* CHANNEL      = "${channel}";

EspGithubOta ota;

void setup() {
  Serial.begin(115200);
  
  // Kết nối WiFi (khuyến nghị dùng WiFiManager thay vì hardcode)
  WiFi.mode(WIFI_STA);
  WiFi.begin("YOUR_WIFI_SSID", "YOUR_WIFI_PASSWORD");
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\\nWiFi Connected!");

  ${chip === 'esp32c3' ? `// BẮT BUỘC VỚI ESP32-C3: Giới hạn công suất phát WiFi ở 8.5 dBm
  EspGithubOta::applyEsp32c3TxPowerLimit();
` : ''}
  // Khởi tạo OTA Hub
  ota.begin(OTA_BASE_URL, PROJECT_SLUG, FW_VERSION, CHANNEL);

  // Đặt chu kỳ check 6 giờ (21600s), jitter ngẫu nhiên tối đa 300s
  ota.setCheckInterval(21600, 300);

  // Theo dõi tiến trình tải
  ota.onProgress([](size_t progress, size_t total, int percent) {
    Serial.printf("Tiến trình nạp OTA: %d%% (%u / %u bytes)\\n", percent, progress, total);
  });

  // Kiểm tra cập nhật ngay khi bật nguồn
  ota.checkAndUpdate();
}

void loop() {
  ota.loop(); // Non-blocking check định kỳ
  // Code ứng dụng của bạn...
  delay(10);
}`;

  const platformIoSnippet = `; === CẤU HÌNH PLATFORMIO (platformio.ini) ===
[env:${chip}]
platform = espressif32
board = ${chip === 'esp32c3' ? 'esp32-c3-devkitm-1' : chip === 'esp32s3' ? 'esp32-s3-devkitc-1' : 'esp32dev'}
framework = arduino
monitor_speed = 115200

; Định nghĩa phiên bản firmware và bật tính năng Rollback bootloader
build_flags =
    -DFW_VERSION=\\"1.0.0\\"
    -DCONFIG_BOOTLOADER_APP_ROLLBACK_ENABLE=1

; Sử dụng phân vùng 2 slot OTA
board_build.partitions = partitions_two_ota.csv

; Thư viện EspGithubOta
lib_extra_dirs = client
`;

  const currentCode = tab === 'arduino' ? arduinoSnippet : platformIoSnippet;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden text-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab('arduino')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold transition ${
              tab === 'arduino' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Arduino Sketch (.ino)</span>
          </button>
          <button
            onClick={() => setTab('platformio')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold transition ${
              tab === 'platformio' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>platformio.ini</span>
          </button>
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-cyan-400" />}
          <span>{copied ? 'Đã copy!' : 'Copy Code'}</span>
        </button>
      </div>

      {/* Code body */}
      <pre className="p-3.5 font-mono text-[11px] text-cyan-300/90 overflow-x-auto leading-relaxed max-h-56">
        <code>{currentCode}</code>
      </pre>
    </div>
  );
};
