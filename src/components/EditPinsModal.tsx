/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Pin, Trash2, Plus, GitCommit, AlertTriangle, Cpu } from 'lucide-react';
import { GitHubService, type GitHubAuth } from '../lib/github-api.ts';
import type { DevicePins, ProjectSummary } from '../lib/ota-types.ts';

interface EditPinsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectSummary;
  auth: GitHubAuth;
  onSuccess: (updatedPins: DevicePins) => void;
}

export const EditPinsModal: React.FC<EditPinsModalProps> = ({ isOpen, onClose, project, auth, onSuccess }) => {
  const [pins, setPins] = useState<DevicePins>({ ...(project.pins || {}) });
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newVersion, setNewVersion] = useState(project.releases[0]?.version || '1.0.0');
  const [isCommitting, setIsCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddPin = () => {
    if (!newDeviceId.trim()) {
      setError('Vui lòng nhập Device ID hoặc địa chỉ MAC');
      return;
    }
    const cleanId = newDeviceId.trim().replace(/[: -]/g, '').toUpperCase();
    setPins((prev) => ({
      ...prev,
      [cleanId]: newVersion,
    }));
    setNewDeviceId('');
    setError(null);
  };

  const handleRemovePin = (deviceId: string) => {
    setPins((prev) => {
      const copy = { ...prev };
      delete copy[deviceId];
      return copy;
    });
  };

  const handleSaveToGit = async () => {
    setIsCommitting(true);
    setError(null);

    try {
      const gitService = new GitHubService(auth);
      const filePath = `firmware/${project.slug}/pins.json`;

      await gitService.commitFiles(
        [
          {
            path: filePath,
            content: JSON.stringify(pins, null, 2),
            encoding: 'utf-8',
          },
        ],
        `chore(ota): cập nhật thiết bị ghim (pins) cho ${project.slug} (${Object.keys(pins).length} devices)`
      );

      onSuccess(pins);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu cấu hình pins lên Git');
    } finally {
      setIsCommitting(false);
    }
  };

  const pinEntries = Object.entries(pins);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-800 text-cyan-400">
              <Pin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Quản Lý Ghim Thiết Bị (Device Pins)</h3>
              <p className="text-xs text-slate-400 font-mono">Dự án: {project.slug} (firmware/{project.slug}/pins.json)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-xs">
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Thiết bị có Device ID / MAC trùng khớp sẽ luôn nhận phiên bản cố định được ghim, bất kể % rollout hay trạng thái kênh. Thích hợp cho thiết bị mẫu tại phòng lab hoặc khách hàng VIP.
          </p>

          {/* Add pin form */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <span className="font-semibold text-slate-300 block text-[11px]">Thêm thiết bị ghim mới:</span>
            <div className="flex gap-2">
              <input
                type="text"
                value={newDeviceId}
                onChange={(e) => setNewDeviceId(e.target.value)}
                placeholder="VD: 240AC4001122 hoặc LAB_DEVICE_01"
                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
              />
              <select
                value={newVersion}
                onChange={(e) => setNewVersion(e.target.value)}
                className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
              >
                {project.releases.map((r) => (
                  <option key={r.version} value={r.version}>
                    v{r.version} ({r.channel})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddPin}
                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm</span>
              </button>
            </div>
          </div>

          {/* List of pinned devices */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {pinEntries.length === 0 ? (
              <div className="text-center py-4 text-slate-500 text-[11px]">
                Chưa có thiết bị nào được ghim cho dự án này.
              </div>
            ) : (
              pinEntries.map(([devId, ver]) => (
                <div
                  key={devId}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono"
                >
                  <div className="flex items-center gap-2">
                    <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-slate-200 font-semibold">{devId}</span>
                    <span className="text-slate-500">➔</span>
                    <span className="text-amber-400 font-bold bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-800/40">
                      v{ver}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemovePin(devId)}
                    className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-900 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
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
              type="button"
              onClick={handleSaveToGit}
              disabled={isCommitting}
              className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-lg shadow-cyan-950/60"
            >
              {isCommitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Đang Commit Pins...</span>
                </>
              ) : (
                <>
                  <GitCommit className="w-3.5 h-3.5" />
                  <span>Lưu & Commit Pins</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
