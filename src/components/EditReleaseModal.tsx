/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Sliders, GitCommit, AlertTriangle, ShieldCheck, PauseCircle, XCircle, CheckCircle2 } from 'lucide-react';
import { GitHubService, type GitHubAuth } from '../lib/github-api.ts';
import type { ReleaseConfig, ReleaseStatus } from '../lib/ota-types.ts';

interface EditReleaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectSlug: string;
  release: ReleaseConfig;
  auth: GitHubAuth;
  onSuccess: (updatedRelease: ReleaseConfig) => void;
}

export const EditReleaseModal: React.FC<EditReleaseModalProps> = ({
  isOpen,
  onClose,
  projectSlug,
  release,
  auth,
  onSuccess,
}) => {
  const [rollout, setRollout] = useState(release.rollout);
  const [status, setStatus] = useState<ReleaseStatus>(release.status);
  const [notes, setNotes] = useState(release.notes);
  const [mandatory, setMandatory] = useState(release.mandatory);
  const [isCommitting, setIsCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCommitting(true);
    setError(null);

    try {
      const updatedConfig: ReleaseConfig = {
        ...release,
        rollout,
        status,
        notes: notes.trim(),
        mandatory,
      };

      const gitService = new GitHubService(auth);
      const filePath = `firmware/${projectSlug}/releases/${release.version}/release.json`;

      await gitService.commitFiles(
        [
          {
            path: filePath,
            content: JSON.stringify(updatedConfig, null, 2),
            encoding: 'utf-8',
          },
        ],
        `chore(ota): cập nhật release ${projectSlug}@${release.version} (Rollout: ${rollout}%, Trạng thái: ${status})`
      );

      onSuccess(updatedConfig);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi cập nhật cấu hình release');
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-800 text-cyan-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Quản Lý Release v{release.version}</h3>
              <p className="text-xs text-slate-400 font-mono">Dự án: {projectSlug} • Kênh: {release.channel}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          {/* Status selector */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1.5">Trạng thái phát hành:</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStatus('active')}
                className={`py-2 px-2 rounded-lg border text-center transition flex flex-col items-center gap-1 ${
                  status === 'active'
                    ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold text-[11px]">Hoạt Động</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('paused')}
                className={`py-2 px-2 rounded-lg border text-center transition flex flex-col items-center gap-1 ${
                  status === 'paused'
                    ? 'bg-amber-950/40 border-amber-500 text-amber-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <PauseCircle className="w-4 h-4 text-amber-400" />
                <span className="font-semibold text-[11px]">Tạm Dừng</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('revoked')}
                className={`py-2 px-2 rounded-lg border text-center transition flex flex-col items-center gap-1 ${
                  status === 'revoked'
                    ? 'bg-rose-950/40 border-rose-500 text-rose-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <XCircle className="w-4 h-4 text-rose-400" />
                <span className="font-semibold text-[11px]">Thu Hồi</span>
              </button>
            </div>
          </div>

          {/* Rollout slider */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="font-semibold text-slate-300">
                Tỉ lệ phân phối (Rollout): <span className="text-cyan-400 font-mono">{rollout}%</span>
              </label>
              <span className="text-[10px] text-slate-500">
                {rollout === 100 ? '100% thiết bị' : `${rollout}% thiết bị theo hash`}
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

          {/* Mandatory Checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="editMandatory"
              checked={mandatory}
              onChange={(e) => setMandatory(e.target.checked)}
              className="w-4 h-4 rounded border-slate-700 bg-slate-950 accent-cyan-400"
            />
            <label htmlFor="editMandatory" className="text-slate-300 cursor-pointer">
              Đánh dấu là bản cập nhật bắt buộc (Mandatory)
            </label>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Ghi chú phát hành:</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500 resize-none"
            />
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
                  <span>Đang Cập Nhật...</span>
                </>
              ) : (
                <>
                  <GitCommit className="w-3.5 h-3.5" />
                  <span>Lưu & Commit Thay Đổi</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
