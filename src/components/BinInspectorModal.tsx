/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, UploadCloud, Binary, CheckCircle2, AlertTriangle, Copy, Check } from 'lucide-react';
import { calculateMd5, calculateSha256 } from '../lib/crypto-utils.ts';
import { parseEspBinaryHeader, type BinaryHeaderInfo } from '../lib/ota-validator.ts';

interface BinInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BinInspectorModal: React.FC<BinInspectorModalProps> = ({ isOpen, onClose }) => {
  const [fileInfo, setFileInfo] = useState<{
    name: string;
    size: number;
    header: BinaryHeaderInfo;
    sha256: string;
    md5: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFile = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      const header = parseEspBinaryHeader(bytes);
      const sha256 = await calculateSha256(bytes);
      const md5 = calculateMd5(bytes);

      setFileInfo({
        name: file.name,
        size: bytes.length,
        header,
        sha256,
        md5,
      });
    } catch (err: any) {
      setError(err.message || 'Không thể đọc file binary này');
      setFileInfo(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-800 text-cyan-400">
              <Binary className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Soi Cấu Trúc Header File Binary (.bin)</h3>
              <p className="text-xs text-slate-400">Kiểm tra Magic Byte 0xE9, Chip ID và Checksum độc lập</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drop Zone */}
        <div className="mt-5">
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-cyan-500/60 rounded-xl p-6 cursor-pointer bg-slate-950/60 hover:bg-slate-950 transition group">
            <UploadCloud className="w-8 h-8 text-slate-500 group-hover:text-cyan-400 mb-2 transition" />
            <span className="text-sm font-medium text-slate-300">
              Kéo thả file <code className="text-cyan-400">firmware.bin</code> vào đây hoặc nhấp để chọn
            </span>
            <span className="text-xs text-slate-500 mt-1">
              Phân tích hoàn toàn trong trình duyệt (WebAssembly / TypedArrays), không tải file lên server
            </span>
            <input
              type="file"
              accept=".bin"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFile(e.target.files[0]);
                }
              }}
            />
          </label>
        </div>

        {isProcessing && (
          <div className="mt-4 text-center text-xs text-cyan-400 animate-pulse font-mono">
            Đang phân tích byte header và tính toán SHA-256 / MD5...
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {fileInfo && (
          <div className="mt-5 space-y-3">
            {/* Validation Badge */}
            <div
              className={`p-3 rounded-xl border flex items-center justify-between ${
                fileInfo.header.isValidMagic
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2 text-xs">
                {fileInfo.header.isValidMagic ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                )}
                <span className="font-semibold">
                  {fileInfo.header.isValidMagic
                    ? 'Magic Byte 0xE9 hợp lệ (Chuẩn ESP Image Header)'
                    : `Magic byte sai: 0x${fileInfo.header.magic.toString(16)} (Không phải firmware ESP32)`}
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                {fileInfo.header.chipName}
              </span>
            </div>

            {/* Info Table */}
            <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 text-xs space-y-2.5 font-mono">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-slate-400">Tên file:</span>
                <span className="text-white font-semibold">{fileInfo.name}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-slate-400">Kích thước:</span>
                <span className="text-cyan-400">{fileInfo.size.toLocaleString()} bytes</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-slate-400">Chip ID nhận diện:</span>
                <span className="text-emerald-400">
                  0x{fileInfo.header.chipId.toString(16).padStart(4, '0')} ({fileInfo.header.chipName})
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-slate-400">Entry Point:</span>
                <span className="text-slate-300">
                  0x{fileInfo.header.entryAddress.toString(16).toUpperCase()}
                </span>
              </div>

              {/* Hashes with copy */}
              <div className="pt-1">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span>SHA-256:</span>
                  <button
                    onClick={() => handleCopy(fileInfo.sha256, 'sha256')}
                    className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 transition"
                  >
                    {copiedKey === 'sha256' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'sha256' ? 'Đã copy' : 'Copy'}</span>
                  </button>
                </div>
                <div className="text-[11px] text-slate-300 bg-slate-900 p-2 rounded border border-slate-800 break-all select-all">
                  {fileInfo.sha256}
                </div>
              </div>

              <div className="pt-1">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span>MD5:</span>
                  <button
                    onClick={() => handleCopy(fileInfo.md5, 'md5')}
                    className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 transition"
                  >
                    {copiedKey === 'md5' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'md5' ? 'Đã copy' : 'Copy'}</span>
                  </button>
                </div>
                <div className="text-[11px] text-slate-300 bg-slate-900 p-2 rounded border border-slate-800 break-all select-all">
                  {fileInfo.md5}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
