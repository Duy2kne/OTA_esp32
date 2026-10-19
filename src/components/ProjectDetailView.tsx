/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ArrowLeft,
  UploadCloud,
  Pin,
  ExternalLink,
  Copy,
  Check,
  PauseCircle,
  PlayCircle,
  XCircle,
  CheckCircle2,
  Sliders,
  Calendar,
  Hash,
  FileCode,
  HardDrive,
  Cpu,
  Layers,
  Info,
} from 'lucide-react';
import type { ProjectSummary, ReleaseChannel, ReleaseConfig } from '../lib/ota-types.ts';
import { CodeSnippetGenerator } from './CodeSnippetGenerator.tsx';

interface ProjectDetailViewProps {
  project: ProjectSummary;
  onBack: () => void;
  isAdmin: boolean;
  onOpenUpload: () => void;
  onOpenPins: () => void;
  onOpenEditRelease: (release: ReleaseConfig) => void;
  baseUrl: string;
}

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({
  project,
  onBack,
  isAdmin,
  onOpenUpload,
  onOpenPins,
  onOpenEditRelease,
  baseUrl,
}) => {
  const [selectedChannel, setSelectedChannel] = useState<ReleaseChannel>('stable');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const manifestUrl = `${cleanBase}${project.slug}/${selectedChannel}.json`;

  const handleCopyManifestUrl = () => {
    navigator.clipboard.writeText(manifestUrl);
    setCopiedUrl('manifest');
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const channelReleases = project.releases.filter((r) => r.channel === selectedChannel);
  const latestRelease = project.latestByChannel[selectedChannel];

  const getChipBadge = (chip: string) => {
    switch (chip) {
      case 'esp32c3':
        return {
          bg: 'bg-cyan-950/80 border-cyan-700/60 text-cyan-300',
          label: 'ESP32-C3 (RISC-V)',
        };
      case 'esp32s3':
        return {
          bg: 'bg-purple-950/80 border-purple-700/60 text-purple-300',
          label: 'ESP32-S3 (Xtensa LX7)',
        };
      default:
        return {
          bg: 'bg-blue-950/80 border-blue-700/60 text-blue-300',
          label: 'ESP32 (Xtensa LX6)',
        };
    }
  };

  const chipInfo = getChipBadge(project.config.chip);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-start sm:items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition mt-0.5 sm:mt-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-extrabold text-white">{project.config.name}</h2>
              <span className={`text-[11px] font-mono px-2 py-0.5 rounded border ${chipInfo.bg}`}>
                {chipInfo.label}
              </span>
              <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                slug: {project.slug}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">{project.config.description}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <button
                onClick={onOpenPins}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition"
              >
                <Pin className="w-3.5 h-3.5 text-amber-400" />
                <span>Ghim Thiết Bị ({Object.keys(project.pins || {}).length})</span>
              </button>
              <button
                onClick={onOpenUpload}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-950/60 transition"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Upload Firmware Mới</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Manifest Endpoint & Channel Switcher */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Channel buttons */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 mr-1">Kênh:</span>
            {project.config.channels.map((ch) => (
              <button
                key={ch}
                onClick={() => setSelectedChannel(ch)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition ${
                  selectedChannel === ch
                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-800 shadow-sm'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-850'
                }`}
              >
                {ch}
                {project.latestByChannel[ch] && (
                  <span className="ml-1.5 font-mono text-[10px] text-cyan-400">
                    v{project.latestByChannel[ch]?.version}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Manifest URL with copy */}
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="text-[11px] font-mono text-cyan-300 truncate max-w-[260px] sm:max-w-xs md:max-w-md">
              {manifestUrl}
            </span>
            <button
              onClick={handleCopyManifestUrl}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-900 transition flex items-center gap-1 text-[11px]"
              title="Copy link manifest cho ESP32"
            >
              {copiedUrl === 'manifest' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-cyan-400" />
              )}
            </button>
          </div>
        </div>

        {/* Latest release summary for selected channel */}
        {latestRelease ? (
          <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <div>
                <span className="text-slate-400">Bản phát hành active mới nhất: </span>
                <span className="font-mono font-bold text-white text-sm">v{latestRelease.version}</span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-slate-400 text-[11px] font-mono">
              <span>Rollout: <strong className="text-cyan-400">{latestRelease.rollout}%</strong></span>
              <span>Dung lượng: <strong className="text-slate-300">{(latestRelease.size / 1024).toFixed(1)} KB</strong></span>
              <span>Ngày tạo: <strong className="text-slate-300">{new Date(latestRelease.createdAt).toLocaleDateString('vi-VN')}</strong></span>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-500 text-center">
            Kênh <span className="uppercase font-semibold text-slate-400">{selectedChannel}</span> hiện chưa có bản phát hành active nào.
          </div>
        )}
      </div>

      {/* Code Snippet for ESP32 */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <FileCode className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-white">Đoạn Mã Tích Hợp Cấu Hình Cho ESP32</h3>
        </div>
        <CodeSnippetGenerator
          projectSlug={project.slug}
          chip={project.config.chip}
          channel={selectedChannel}
          baseUrl={cleanBase}
        />
      </div>

      {/* Releases List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">
              Lịch Sử Bản Phát Hành (Kênh: <span className="uppercase text-cyan-400">{selectedChannel}</span>)
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Tổng cộng: {channelReleases.length} releases
          </span>
        </div>

        {channelReleases.length === 0 ? (
          <div className="p-8 rounded-xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-500">
            Chưa có firmware nào được tải lên cho kênh này.
          </div>
        ) : (
          <div className="space-y-3">
            {channelReleases.map((rel) => (
              <div
                key={rel.version}
                className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition space-y-3"
              >
                {/* Release header line */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-base text-white">v{rel.version}</span>
                    {/* Status badge */}
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                        rel.status === 'active'
                          ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                          : rel.status === 'paused'
                          ? 'bg-amber-950/80 text-amber-400 border border-amber-800'
                          : 'bg-rose-950/80 text-rose-400 border border-rose-800'
                      }`}
                    >
                      {rel.status === 'active' ? 'Hoạt Động' : rel.status === 'paused' ? 'Tạm Dừng' : 'Đã Thu Hồi'}
                    </span>

                    {rel.mandatory && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950/80 text-rose-400 border border-rose-800">
                        BẮT BUỘC
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                      <span>Rollout:</span>
                      <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                        <div
                          className="h-full bg-cyan-400 transition-all"
                          style={{ width: `${rel.rollout}%` }}
                        />
                      </div>
                      <span className="font-bold text-cyan-300">{rel.rollout}%</span>
                    </div>

                    {isAdmin && (
                      <button
                        onClick={() => onOpenEditRelease(rel)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
                      >
                        <Sliders className="w-3 h-3 text-cyan-400" />
                        <span>Chỉnh Sửa</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Notes */}
                {rel.notes && (
                  <p className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-lg border border-slate-850">
                    {rel.notes}
                  </p>
                )}

                {/* Hash and binary metadata */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono text-slate-400 bg-slate-950 p-2.5 rounded-lg border border-slate-850">
                  <div className="truncate">
                    <span className="text-slate-500">SHA256: </span>
                    <span className="text-slate-300 select-all">{rel.sha256}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-slate-500">MD5: </span>
                      <span className="text-slate-300 select-all">{rel.md5}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Size: </span>
                      <span className="text-cyan-400 font-semibold">{(rel.size / 1024).toFixed(1)} KB</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
