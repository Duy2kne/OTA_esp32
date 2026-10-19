/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, BookOpen, ShieldCheck, ServerOff, Terminal, Zap, CheckCircle2, AlertOctagon } from 'lucide-react';

interface ArchitectureGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ArchitectureGuideModal: React.FC<ArchitectureGuideModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'architecture' | 'security' | 'setup' | 'esp32'>('architecture');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-3xl max-h-[88vh] rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-800 text-cyan-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Kiến Trúc & Hướng Dẫn Vận Hành Hệ Thống OTA</h3>
              <p className="text-xs text-slate-400">Chạy hoàn toàn trên hạ tầng GitHub (Pages + Actions), 0 server riêng</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-5 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('architecture')}
            className={`py-2.5 px-3 border-b-2 text-xs font-semibold whitespace-nowrap transition ${
              activeTab === 'architecture'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            1. Kiến Trúc 0 Server
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`py-2.5 px-3 border-b-2 text-xs font-semibold whitespace-nowrap transition ${
              activeTab === 'security'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            2. Quy Tắc Bảo Mật Cốt Lõi
          </button>
          <button
            onClick={() => setActiveTab('setup')}
            className={`py-2.5 px-3 border-b-2 text-xs font-semibold whitespace-nowrap transition ${
              activeTab === 'setup'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            3. Cấu Hình Repo & Pages
          </button>
          <button
            onClick={() => setActiveTab('esp32')}
            className={`py-2.5 px-3 border-b-2 text-xs font-semibold whitespace-nowrap transition ${
              activeTab === 'esp32'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            4. Tích Hợp Client Firmware
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs text-slate-300 leading-relaxed font-sans">
          {activeTab === 'architecture' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <h4 className="font-bold text-white text-sm mb-2 flex items-center gap-2">
                  <ServerOff className="w-4 h-4 text-cyan-400" />
                  Luồng Dữ Liệu Hoàn Toàn Tĩnh (Zero-Server Architecture)
                </h4>
                <p className="text-slate-400 mb-3">
                  Không có backend Node.js, không có cơ sở dữ liệu SQL/NoSQL và không nhận HTTP POST. Mọi logic xử lý được phân bổ:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="font-bold text-cyan-300 block mb-1">1. Git Data API (Browser)</span>
                    <span className="text-slate-400 text-[11px]">
                      Trình duyệt người quản trị dùng Fine-grained PAT để tạo blob, tree, commit duy nhất đưa firmware.bin + release.json vào nhánh main.
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="font-bold text-cyan-300 block mb-1">2. Build-Time (Actions)</span>
                    <span className="text-slate-400 text-[11px]">
                      Script <code>scripts/build-ota.ts</code> chạy lúc build, kiểm tra byte 0xE9, chip ID, SHA-256, và sinh ra file tĩnh <code>ota/&lt;channel&gt;.json</code>.
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="font-bold text-cyan-300 block mb-1">3. Edge & ESP32 Client</span>
                    <span className="text-slate-400 text-[11px]">
                      GitHub Pages CDN phân phối toàn cầu. ESP32 thực hiện tính toán rollout slot <code>hash(deviceId + version) % 100</code> nội bộ.
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <h5 className="font-bold text-white mb-2">Cấu Trúc Thư Mục Trong Repository (Source of Truth):</h5>
                <pre className="p-3 rounded-lg bg-slate-900 text-cyan-300 font-mono text-[11px] overflow-x-auto">
{`firmware/
  <project-slug>/
    project.json       # { name, description, chip: "esp32c3", channels: ["stable","beta"] }
    pins.json          # { "<deviceId>": "<version>" } ghim thiết bị cụ thể
    releases/
      <version>/       # vd: 1.4.2
        firmware.bin   # Byte đầu tiên bắt buộc 0xE9, chip ID khớp
        release.json   # { version, channel, notes, rollout, sha256, md5, size, status }`}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-600/40 text-rose-200">
                <h4 className="font-bold text-white text-sm mb-2 flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 text-rose-400" />
                  Quy Tắc Vàng 1: GitHub Pages Hoàn Toàn Công Khai (PUBLIC)
                </h4>
                <p className="text-xs leading-relaxed">
                  Bất kỳ ai có URL đều có thể tải file <code>firmware.bin</code> của bạn. Vì vậy, <strong>TUYỆT ĐỐI KHÔNG lưu mật khẩu WiFi, Secret Key, Token tài khoản nhạy cảm</strong> vào mã nguồn firmware!
                </p>
                <div className="mt-2 text-[11px] text-rose-300 bg-rose-950/60 p-2.5 rounded-lg border border-rose-800">
                  💡 <strong>Giải pháp chuẩn:</strong> Thiết bị phải sử dụng cơ chế cấp phát WiFi lúc cài đặt (WiFiManager, ESP-IDF BLE/WiFi SoftAP Provisioning) và lưu vào bộ nhớ mã hóa NVS của chip.
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <h4 className="font-bold text-white text-sm mb-2 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Quy Tắc Vàng 2: Bắt Buộc Giới Hạn Công Suất WiFi ESP32-C3 (8.5 dBm)
                </h4>
                <p className="text-slate-300 text-xs leading-relaxed">
                  ESP32-C3 (Single-core RISC-V) có độ nhạy dòng đỉnh khi kích hoạt modem RF. Nếu để công suất mặc định (~20 dBm), tụ lọc nguồn trên mạch chất lượng kém có thể bị sụt áp đột ngột khiến chip reboot loop hoặc hỏng module WiFi.
                </p>
                <div className="mt-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-amber-300">
                  WiFi.setTxPower(WIFI_POWER_8_5dBm); // Gọi ngay sau WiFi.begin() và sau Deep Sleep
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <h4 className="font-bold text-white text-sm mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Quy Tắc Vàng 3: Bảo Mật HTTPS và Không Bao Giờ Dùng setInsecure()
                </h4>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Thư viện <code>EspGithubOta</code> sử dụng CA Certificate Bundle của ESP-IDF (<code>setCACertBundle</code>) để xác thực chữ ký của Let's Encrypt / DigiCert cấp cho GitHub Pages. Tuyệt đối không dùng <code>setInsecure()</code> vì sẽ làm vô hiệu hóa mã hóa và dễ bị tấn công Man-In-The-Middle.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'setup' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="font-bold text-white text-sm">Các Bước Thiết Lập Repository Lần Đầu</h4>
                <ol className="list-decimal list-inside space-y-2 text-slate-300 text-xs">
                  <li>
                    <strong>Tạo Repo GitHub</strong>: Fork hoặc push mã nguồn này lên tài khoản GitHub của bạn.
                  </li>
                  <li>
                    <strong>Kích hoạt GitHub Pages</strong>:
                    <br />
                    Vào repo của bạn ➔ <strong>Settings</strong> ➔ <strong>Pages</strong> ➔ Tại mục <strong>Source</strong>, chọn:
                    <span className="ml-1 px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 font-mono font-semibold border border-cyan-800">
                      GitHub Actions
                    </span>
                  </li>
                  <li>
                    <strong>Tạo Fine-grained Personal Access Token</strong>:
                    <br />
                    Vào GitHub ➔ <strong>Settings</strong> ➔ <strong>Developer Settings</strong> ➔ <strong>Personal access tokens</strong> ➔ <strong>Fine-grained tokens</strong>:
                    <ul className="list-disc list-inside ml-4 mt-1 text-slate-400 text-[11px]">
                      <li>Repository access: Chỉ chọn repo này</li>
                      <li>Permissions: <strong>Contents (Read and write)</strong></li>
                    </ul>
                  </li>
                  <li>
                    <strong>Đăng nhập Quản Trị trên Dashboard</strong>:
                    <br />
                    Bấm nút <strong>Quản Trị (PAT)</strong> ở thanh điều hướng trên cùng và dán token. Token chỉ được lưu an toàn trong <code>localStorage</code> trình duyệt của bạn.
                  </li>
                </ol>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <h5 className="font-bold text-white mb-1">Cơ Chế Cache CDN 10 Phút Của GitHub Pages:</h5>
                <p className="text-slate-400 text-xs">
                  GitHub Pages áp dụng cache TTL 600 giây (10 phút) trên Fastly CDN. Khi bạn phát hành một phiên bản mới hoặc đổi tỉ lệ rollout, các thiết bị đã truy vấn gần đó có thể nhận file manifest cũ trong vòng tối đa 10 phút trước khi cache hết hạn.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'esp32' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <h4 className="font-bold text-white text-sm">Cách Tích Hợp Thư Viện EspGithubOta</h4>
                <p className="text-slate-400 text-xs">
                  Thư mục <code>client/EspGithubOta</code> chứa toàn bộ thư viện chuẩn cho Arduino IDE và PlatformIO.
                </p>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-cyan-300">
                  #include &lt;EspGithubOta.h&gt;<br />
                  EspGithubOta ota;<br /><br />
                  // Trong setup():<br />
                  ota.begin("https://&lt;user&gt;.github.io/&lt;repo&gt;/ota/", "smart-meter-c3", "1.0.0", "stable");<br />
                  ota.checkAndUpdate();<br /><br />
                  // Trong loop():<br />
                  ota.loop();
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <h5 className="font-bold text-white mb-1">Bảng Phân Vùng 2 Slot OTA & Tự Động Rollback:</h5>
                <p className="text-slate-400 text-xs mb-2">
                  Dùng file <code>partitions_two_ota.csv</code> có sẵn trong thư mục thư viện. Khi nạp bản mới, nếu ứng dụng gặp lỗi crash hoặc self-test không thành công, bootloader sẽ tự động quay trở lại bản cũ hoạt động tốt gần nhất!
                </p>
                <div className="p-2.5 rounded bg-slate-900 font-mono text-[11px] text-emerald-400">
                  EspGithubOta::markAppValid(); // Gọi sau khi self-test cảm biến/ngoại vi thành công
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition"
          >
            Đã Hiểu
          </button>
        </div>
      </div>
    </div>
  );
};
