/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  GitCommit,
  Cpu,
  Hash,
  FileCheck,
} from 'lucide-react';
import { calculateMd5, calculateSha256 } from '../lib/crypto-utils.ts';
import { GitHubService, type GitHubAuth } from '../lib/github-api.ts';
import {
  CHIP_ID_MAP,
  isValidSemver,
  parseEspBinaryHeader,
  type BinaryHeaderInfo,
} from '../lib/ota-validator.ts';
import type { ProjectSummary, ReleaseChannel, ReleaseConfig } from '../lib/ota-types.ts';

interface UploadFirmwareModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectSummary;
  auth: GitHubAuth;
  onSuccess: (commitSha: string, version: string) => void;
}

export const UploadFirmwareModal: React.FC<UploadFirmwareModalProps> = ({
  isOpen,
  onClose,
  project,
  auth,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [binaryBytes, setBinaryBytes] = useState<Uint8Array | null>(null);
  const [headerInfo, setHeaderInfo] = useState<BinaryHeaderInfo | null>(null);
  const [sha256, setSha256] = useState<string>('');
  const [md5, setMd5] = useState<string>('');

  const [version, setVersion] = useState<string>('');
  const [channel, setChannel] = useState<ReleaseChannel>(project.config.channels[0] || 'stable');
  const [notes, setNotes] = useState<string>('');
  const [rollout, setRollout] = useState<number>(100);
  const [mandatory, setMandatory] = useState<boolean>(false);
  const [minVersion, setMinVersion] = useState<string>('');

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileDrop = async (selectedFile: File) => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const buffer = await selectedFile.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const header = parseEspBinaryHeader(bytes);

      // Validate magic byte
      if (!header.isValidMagic) {
        throw new Error(
          `Byte đầu tiên là 0x${header.magic.toString(16).toUpperCase()}, không phải 0xE9 theo chuẩn ESP32 image!`
        );
      }

      // Validate chip ID
      const expectedChipId = CHIP_ID_MAP[project.config.chip];
      if (header.chipId !== expectedChipId) {
        throw new Error(
          `File binary được biên dịch cho '${header.chipName}' (Chip ID: 0x${header.chipId.toString(16)}), nhưng dự án này yêu cầu chip '${project.config.chip}'!`
        );
      }

      const calculatedSha = await calculateSha256(bytes);
      const calculatedMd5 = calculateMd5(bytes);

      setFile(selectedFile);
      setBinaryBytes(bytes);
      setHeaderInfo(header);
      setSha256(calculatedSha);
      setMd5(calculatedMd5);

      // Suggest version from filename if matches e.g. "firmware-1.2.0.bin"
      const match = selectedFile.name.match(/v?(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?)/);
      if (match && !version) {
        setVersion(match[1]);
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi đọc file binary');
      setFile(null);
      setBinaryBytes(null);
      setHeaderInfo(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const uint8ArrayToBase64 = (bytes: Uint8Array): string => {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const handleCommitRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!binaryBytes || !headerInfo || !file) {
      setError('Vui lòng chọn file firmware.bin hợp lệ');
      return;
    }

    if (!isValidSemver(version)) {
      setError('Định dạng phiên bản phải chuẩn SemVer (ví dụ: 1.0.0, 1.2.0-beta.1)');
      return;
    }

    // Check if version already exists
    if (project.releases.some((r) => r.version === version.trim())) {
      setError(`Phiên bản '${version.trim()}' đã tồn tại trong dự án này! Vui lòng tăng số phiên bản.`);
      return;
    }

    setIsCommitting(true);
    setError(null);

    try {
      const releaseJson: ReleaseConfig = {
        version: version.trim(),
        channel,
        notes: notes.trim() || `Phát hành phiên bản ${version} cho ${project.config.name}`,
        rollout,
        mandatory,
        minVersion: minVersion.trim() || undefined,
        status: 'active',
        createdAt: new Date().toISOString(),
        sha256,
        md5,
        size: binaryBytes.length,
      };

      const gitService = new GitHubService(auth);

      const binBase64 = uint8ArrayToBase64(binaryBytes);
      const releaseJsonContent = JSON.stringify(releaseJson, null, 2);

      const targetPathPrefix = `firmware/${project.slug}/releases/${version.trim()}`;

      // Single atomic commit for BOTH firmware.bin and release.json using Git Data API
      const result = await gitService.commitFiles(
        [
          {
            path: `${targetPathPrefix}/firmware.bin`,
            content: binBase64,
            encoding: 'base64',
          },
          {
            path: `${targetPathPrefix}/release.json`,
            content: releaseJsonContent,
            encoding: 'utf-8',
          },
        ],
        `release(ota): phát hành ${project.slug}@${version.trim()} (${channel})`
      );

      onSuccess(result.commitSha, version.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi commit release lên GitHub repository');
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-xl max-h-[92vh] rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-800 text-cyan-400">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Upload Firmware OTA Mới</h3>
              <p className="text-xs text-slate-400">
                Dự án: <span className="text-cyan-400 font-semibold">{project.config.name}</span> ({project.config.chip})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content form */}
        <form onSubmit={handleCommitRelease} className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
          {/* Drop area */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">File Binary (.bin):</label>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-cyan-500/60 rounded-xl p-5 cursor-pointer bg-slate-950/60 hover:bg-slate-950 transition">
              <UploadCloud className="w-7 h-7 text-slate-500 mb-1.5 text-cyan-400" />
              {file ? (
                <div className="text-center">
                  <span className="text-white font-medium">{file.name}</span>
                  <span className="text-slate-400 block text-[11px]">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              ) : (
                <div className="text-center">
                  <span className="text-slate-300 font-medium">Kéo thả firmware.bin vào đây hoặc bấm để chọn</span>
                  <span className="text-slate-500 block text-[10px] mt-0.5">
                    Tự động đọc magic byte 0xE9 & Chip ID {project.config.chip}
                  </span>
                </div>
              )}
              <input
                type="file"
                accept=".bin"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileDrop(e.target.files[0]);
                  }
                }}
              />
            </label>
          </div>

          {isAnalyzing && (
            <div className="text-center text-cyan-400 py-1 font-mono text-[11px] animate-pulse">
              Đang phân tích Header ESP Image và tính SHA-256 / MD5...
            </div>
          )}

          {/* Validation Status */}
          {headerInfo && (
            <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Xác thực Header ESP32 Thành Công</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-emerald-500/30 text-[10px] font-mono text-white">
                  Magic: 0x{headerInfo.magic.toString(16).toUpperCase()} • {headerInfo.chipName}
                </span>
              </div>
              <div className="font-mono text-[10px] text-slate-300 space-y-0.5 break-all">
                <div>SHA-256: {sha256}</div>
                <div>MD5: {md5}</div>
              </div>
            </div>
          )}

          {/* Version and channel */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Phiên bản (SemVer):</label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="vd: 1.0.1 hoặc 1.1.0-beta.1"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                required
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Kênh phát hành (Channel):</label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as ReleaseChannel)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500"
              >
                {project.config.channels.map((ch) => (
                  <option key={ch} value={ch}>
                    {ch.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Rollout slider */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-slate-300 font-semibold">
                Tỉ lệ phân phối (Rollout): <span className="text-cyan-400 font-mono">{rollout}%</span>
              </label>
              <span className="text-[10px] text-slate-500">
                {rollout === 100 ? 'Phát hành toàn bộ thiết bị' : 'Phân phối thử nghiệm từng phần'}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={rollout}
              onChange={(e) => setRollout(parseInt(e.target.value, 10))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Release notes */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Ghi chú phát hành (Release Notes):</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Mô tả các thay đổi, sửa lỗi hoặc tính năng mới..."
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500 resize-none"
            />
          </div>

          {/* Mandatory & Min Version */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="mandatoryCheck"
                checked={mandatory}
                onChange={(e) => setMandatory(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-950 accent-cyan-400"
              />
              <label htmlFor="mandatoryCheck" className="text-slate-300 cursor-pointer">
                Bắt buộc cập nhật (Bỏ qua rollout %)
              </label>
            </div>
            <div>
              <input
                type="text"
                value={minVersion}
                onChange={(e) => setMinVersion(e.target.value)}
                placeholder="Yêu cầu version tối thiểu (vd: 1.0.0)"
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono text-[11px] focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit buttons */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isCommitting}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isCommitting || !binaryBytes || !headerInfo}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-lg shadow-cyan-950/60"
            >
              {isCommitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Đang Tạo Commit Duy Nhất Lên Git...</span>
                </>
              ) : (
                <>
                  <GitCommit className="w-3.5 h-3.5" />
                  <span>Tạo Commit Phát Hành Firmware</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
