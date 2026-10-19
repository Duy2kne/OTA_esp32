/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, FolderPlus, GitCommit, AlertTriangle, CheckCircle2, Shield, Info } from 'lucide-react';
import { GitHubService, type GitHubAuth } from '../lib/github-api.ts';
import type { EspChip, ProjectConfig, ProjectSummary, ReleaseChannel } from '../lib/ota-types.ts';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  auth: GitHubAuth | null;
  onSuccess: (newProject: ProjectSummary) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  auth,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [chip, setChip] = useState<EspChip>('esp32c3');
  const [channels, setChannels] = useState<ReleaseChannel[]>(['stable', 'beta']);
  const [isCommitting, setIsCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const autoSlug = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slug || slug === autoSlug(name)) {
      setSlug(autoSlug(val));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      setError('Vui lòng nhập tên và định danh (slug) dự án');
      return;
    }

    if (channels.length === 0) {
      setError('Vui lòng chọn ít nhất 1 kênh phát hành (stable hoặc beta)');
      return;
    }

    setIsCommitting(true);
    setError(null);

    const projectConfig: ProjectConfig = {
      name: name.trim(),
      description: description.trim(),
      chip,
      channels,
      createdAt: new Date().toISOString(),
    };

    const newProjectSummary: ProjectSummary = {
      slug: slug.trim(),
      config: projectConfig,
      releases: [],
      pins: {},
      latestByChannel: {
        stable: null,
        beta: null,
      },
    };

    try {
      if (auth) {
        // Commit to GitHub repository using Git Data API
        const gitService = new GitHubService(auth);
        await gitService.commitFiles(
          [
            {
              path: `firmware/${slug.trim()}/project.json`,
              content: JSON.stringify(projectConfig, null, 2),
              encoding: 'utf-8',
            },
            {
              path: `firmware/${slug.trim()}/pins.json`,
              content: JSON.stringify({}, null, 2),
              encoding: 'utf-8',
            },
          ],
          `chore(ota): tạo dự án mới '${slug.trim()}' (${chip})`
        );
      }

      onSuccess(newProjectSummary);
      onClose();
      // Reset form
      setName('');
      setSlug('');
      setDescription('');
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tạo dự án lên GitHub');
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-800 text-cyan-400">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Thêm Dự Án Firmware Mới</h3>
              <p className="text-xs text-slate-400">
                {auth ? `Đồng bộ trực tiếp lên GitHub (${auth.owner}/${auth.repo})` : 'Tạo nhanh dự án trên Dashboard'}
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

        {!auth && (
          <div className="mt-4 p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/60 text-xs text-slate-300 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Bạn đang ở chế độ tạo trực tiếp. Dự án sẽ được lưu ngay vào Dashboard để bạn lấy đoạn mã C++, cấu hình và kiểm thử. Khi bạn kết nối GitHub PAT, hệ thống sẽ hỗ trợ đồng bộ lên repo.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Tên dự án của bạn:</label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="VD: Hệ Thống Đo Độ Ẩm Đất Nông Nghiệp"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Định danh URL (Slug):</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(autoSlug(e.target.value))}
                placeholder="vd: soil-moisture-node"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                required
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Dùng làm đường dẫn manifest và binary</span>
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Dòng Chip mục tiêu:</label>
              <select
                value={chip}
                onChange={(e) => setChip(e.target.value as EspChip)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500"
              >
                <option value="esp32c3">ESP32-C3 (RISC-V, WiFi+BLE)</option>
                <option value="esp32s3">ESP32-S3 (Xtensa Dual-core, AI)</option>
                <option value="esp32">ESP32 (Classic Xtensa Dual-core)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Mô tả dự án:</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả chức năng thiết bị, cảm biến sử dụng, địa điểm lắp đặt..."
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500 resize-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1.5">Kênh phân phối (Channels):</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={channels.includes('stable')}
                  onChange={(e) => {
                    if (e.target.checked) setChannels([...channels, 'stable']);
                    else setChannels(channels.filter((c) => c !== 'stable'));
                  }}
                  className="rounded border-slate-700 bg-slate-950 accent-cyan-400"
                />
                <span className="text-slate-300 font-mono">stable (chính thức)</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={channels.includes('beta')}
                  onChange={(e) => {
                    if (e.target.checked) setChannels([...channels, 'beta']);
                    else setChannels(channels.filter((c) => c !== 'beta'));
                  }}
                  className="rounded border-slate-700 bg-slate-950 accent-cyan-400"
                />
                <span className="text-slate-300 font-mono">beta (thử nghiệm)</span>
              </label>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-5 flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
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
              disabled={isCommitting}
              className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-lg shadow-cyan-950/60"
            >
              {isCommitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Đang Tạo Dự Án...</span>
                </>
              ) : (
                <>
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>Tạo Dự Án Ngay</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
