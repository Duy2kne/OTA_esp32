/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, FolderPlus, GitCommit, AlertTriangle } from 'lucide-react';
import { GitHubService, type GitHubAuth } from '../lib/github-api.ts';
import type { EspChip, ProjectConfig, ReleaseChannel } from '../lib/ota-types.ts';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  auth: GitHubAuth;
  onSuccess: (newSlug: string) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({ isOpen, onClose, auth, onSuccess }) => {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [chip, setChip] = useState<EspChip>('esp32c3');
  const [channels, setChannels] = useState<ReleaseChannel[]>(['stable', 'beta']);
  const [isCommitting, setIsCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slug || slug === autoSlug(name)) {
      setSlug(autoSlug(val));
    }
  };

  const autoSlug = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      setError('Vui lòng nhập tên và định danh (slug) dự án');
      return;
    }

    setIsCommitting(true);
    setError(null);

    try {
      const projectConfig: ProjectConfig = {
        name: name.trim(),
        description: description.trim(),
        chip,
        channels,
        createdAt: new Date().toISOString(),
      };

      const gitService = new GitHubService(auth);

      // Commit project.json and empty pins.json
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

      onSuccess(slug.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi commit tạo dự án lên GitHub');
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
              <h3 className="text-base font-bold text-white">Tạo Dự Án Firmware Mới</h3>
              <p className="text-xs text-slate-400">Thêm dự án quản lý OTA vào cấu trúc repository</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Tên dự án:</label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="vd: Đồng hồ thông minh Smart Watch"
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
                placeholder="vd: smart-watch"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Dòng Chip mục tiêu:</label>
              <select
                value={chip}
                onChange={(e) => setChip(e.target.value as EspChip)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500"
              >
                <option value="esp32c3">ESP32-C3 (RISC-V, WiFi+BLE)</option>
                <option value="esp32s3">ESP32-S3 (Xtensa Dual-core, AI/Vector)</option>
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
              placeholder="Mô tả chức năng thiết bị, cảm biến sử dụng..."
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
                <span className="text-slate-300 font-mono">stable</span>
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
                <span className="text-slate-300 font-mono">beta</span>
              </label>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-5 flex items-center justify-end gap-2 pt-2">
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
                  <span>Đang Commit Tạo Dự Án...</span>
                </>
              ) : (
                <>
                  <GitCommit className="w-3.5 h-3.5" />
                  <span>Tạo Dự Án Trên Git</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
