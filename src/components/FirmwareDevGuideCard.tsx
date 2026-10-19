/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Code,
  Copy,
  Check,
  AlertTriangle,
  ShieldAlert,
  Zap,
  RotateCcw,
  FileBox,
  Terminal,
  HelpCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { ProjectSummary, ReleaseChannel } from '../lib/ota-types.ts';

interface FirmwareDevGuideCardProps {
  project: ProjectSummary;
  selectedChannel: ReleaseChannel;
  baseUrl: string;
}

export const FirmwareDevGuideCard: React.FC<FirmwareDevGuideCardProps> = ({
  project,
  selectedChannel,
  baseUrl,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const manifestUrl = `${cleanBase}${project.slug}/${selectedChannel}.json`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="rounded-2xl bg-slate-900 border border-cyan-500/30 overflow-hidden shadow-xl">
      {/* Header bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-900 via-cyan-950/40 to-slate-900 cursor-pointer select-none border-b border-slate-800"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800/80">
            <Code className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Ghi Chú & Thông Tin Bắt Buộc Khi Code Firmware Cho Dự Án Này</span>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                {project.slug}
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Các thông số cấu hình, lưu ý phần cứng ({project.config.chip.toUpperCase()}) và xuất file .bin
            </p>
          </div>
        </div>

        <button className="p-1 rounded-lg text-slate-400 hover:text-white transition">
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {isExpanded && (
        <div className="p-5 space-y-5 text-xs">
          {/* 1. Essential Parameters Table */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2.5 flex items-center gap-1.5">
              <span>1. Thông số định danh nhúng trong mã nguồn C++</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[11px]">
              {/* Parameter 1 */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-slate-500 block text-[10px]">TÊN DỰ ÁN (PROJECT_SLUG):</span>
                  <span className="text-white font-bold select-all">"{project.slug}"</span>
                </div>
                <button
                  onClick={() => copyToClipboard(`"${project.slug}"`, 'slug')}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition"
                >
                  {copiedKey === 'slug' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Parameter 2 */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-slate-500 block text-[10px]">URL GỐC OTA (OTA_BASE_URL):</span>
                  <span className="text-cyan-300 font-bold truncate max-w-[200px] block select-all">
                    "{cleanBase}"
                  </span>
                </div>
                <button
                  onClick={() => copyToClipboard(`"${cleanBase}"`, 'base')}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition"
                >
                  {copiedKey === 'base' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Parameter 3 */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-slate-500 block text-[10px]">KÊNH PHÁT HÀNH (CHANNEL):</span>
                  <span className="text-amber-300 font-bold select-all">"{selectedChannel}"</span>
                </div>
                <button
                  onClick={() => copyToClipboard(`"${selectedChannel}"`, 'channel')}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition"
                >
                  {copiedKey === 'channel' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Parameter 4 */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-slate-500 block text-[10px]">ĐỊNH NGHĨA PHIÊN BẢN (FW_VERSION):</span>
                  <span className="text-emerald-300 font-bold select-all">#define FW_VERSION "1.0.0"</span>
                </div>
                <button
                  onClick={() => copyToClipboard('#define FW_VERSION "1.0.0"', 'fw_ver')}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition"
                >
                  {copiedKey === 'fw_ver' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* 2. Chip-Specific Hardware Rules */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2.5 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>2. Lưu ý phần cứng đặc thù ({project.config.chip.toUpperCase()})</span>
            </h4>

            {project.config.chip === 'esp32c3' ? (
              <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-600/40 text-amber-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-xs text-amber-300">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>BẮT BUỘC VỚI ESP32-C3: Giới hạn công suất phát WiFi ở 8.5 dBm</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-300">
                  ESP32-C3 (RISC-V) rất nhạy với dòng khởi động bộ phát WiFi RF. Bắt buộc gọi lệnh sau ngay sau khi kết nối WiFi và sau mỗi lần thức từ Deep Sleep để tránh reset nguồn:
                </p>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-amber-800/60 font-mono text-cyan-300 text-[11px] flex items-center justify-between">
                  <code>WiFi.setTxPower(WIFI_POWER_8_5dBm);</code>
                  <button
                    onClick={() => copyToClipboard('WiFi.setTxPower(WIFI_POWER_8_5dBm);', 'txpower')}
                    className="p-1 hover:text-white"
                  >
                    {copiedKey === 'txpower' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-cyan-400" />}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 space-y-1.5">
                <div className="font-semibold text-white">Chip {project.config.chip.toUpperCase()} (Xtensa Dual-Core)</div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Đảm bảo chọn đúng board trong Arduino IDE / PlatformIO để tạo header binary khớp mã Chip ID 
                  (ESP32: <code>0x0000</code>, ESP32-S3: <code>0x0009</code>).
                </p>
              </div>
            )}
          </div>

          {/* 3. Security Warning */}
          <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-600/30 text-rose-200 flex items-start gap-3">
            <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="block text-xs font-bold text-rose-300">
                Tuyệt đối không lưu mật khẩu WiFi hoặc Secrets vào mã nguồn firmware!
              </strong>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                GitHub Pages là không gian lưu trữ công khai (PUBLIC). Bất kỳ ai cũng có thể tải file <code>firmware.bin</code> của bạn. Hãy sử dụng thư viện <strong>WiFiManager</strong> hoặc BLE/SoftAP Provisioning để người dùng nhập WiFi lúc cài đặt.
              </p>
            </div>
          </div>

          {/* 4. How to export .bin */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2.5 flex items-center gap-1.5">
              <FileBox className="w-4 h-4 text-cyan-400" />
              <span>3. Cách lấy file binary (.bin) để upload lên Dashboard</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="font-bold text-cyan-400 block">Dùng Arduino IDE:</span>
                <p className="text-slate-400">
                  Vào menu <strong>Sketch</strong> ➔ chọn <strong>Export Compiled Binary</strong> (phím tắt <code>Ctrl + Alt + S</code> hoặc <code>Cmd + Alt + S</code>).
                </p>
                <p className="text-slate-500 font-mono text-[10px]">
                  File xuất ra tại: <code>&lt;thư-mục-sketch&gt;/build/esp32.../&lt;tên&gt;.ino.bin</code>
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="font-bold text-cyan-400 block">Dùng PlatformIO:</span>
                <p className="text-slate-400">
                  Chạy lệnh <code>pio run</code> hoặc bấm biểu tượng dấu tích Build trên thanh dưới cùng của VS Code.
                </p>
                <p className="text-slate-500 font-mono text-[10px]">
                  File xuất ra tại: <code>.pio/build/&lt;tên-môi-trường&gt;/firmware.bin</code>
                </p>
              </div>
            </div>
          </div>

          {/* 5. Auto Rollback & Partition Table */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <RotateCcw className="w-4 h-4 text-emerald-400" />
              <span>4. Bật Rollback chống lỗi bootloop (Cứu thiết bị tự động)</span>
            </h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Dùng file <code>client/EspGithubOta/partitions_two_ota.csv</code> có sẵn. Trong code, sau khi khởi tạo cảm biến thành công, gọi lệnh:
            </p>
            <div className="p-2 rounded bg-slate-900 font-mono text-emerald-300 text-[11px] flex items-center justify-between">
              <code>EspGithubOta::markAppValid(); // Huỷ rollback nếu self-test đạt</code>
              <button
                onClick={() => copyToClipboard('EspGithubOta::markAppValid();', 'rollback')}
                className="p-1 hover:text-white"
              >
                {copiedKey === 'rollback' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-cyan-400" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
