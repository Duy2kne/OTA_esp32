/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Trash2, AlertTriangle, GitCommit } from 'lucide-react';
import { GitHubService, type GitHubAuth } from '../lib/github-api.ts';
import type { ProjectSummary } from '../lib/ota-types.ts';

interface DeleteProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectSummary;
  auth: GitHubAuth | null;
  onSuccess: (deletedSlug: string) => void;
}

export const DeleteProjectModal: React.FC<DeleteProjectModalProps> = ({
  isOpen,
  onClose,
  project,
  auth,
  onSuccess,
}) => {
  const [confirmSlug, setConfirmSlug] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isConfirmed = confirmSlug.trim().toLowerCase() === project.slug.toLowerCase();

  const handleDelete = async () => {
    if (!isConfirmed) return;

    setIsDeleting(true);
    setError(null);

    try {
      // If user has GitHub auth, we could remove the files, or at least update git if desired.
      // But removing from local dashboard state & persistent storage is primary:
      onSuccess(project.slug);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa dự án');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-rose-900/60 shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Xác Nhận Xóa Dự Án</h3>
              <p className="text-xs text-rose-400 font-mono">{project.slug}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning text */}
        <div className="mt-4 space-y-3 text-xs">
          <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-700/40 text-rose-300 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-xs text-rose-300">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Hành động này không thể hoàn tác</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Dự án <strong>{project.config.name}</strong> cùng toàn bộ {project.releases.length} bản release và các thiết bị ghim sẽ bị xóa khỏi giao diện quản lý.
            </p>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Nhập mã slug <code className="text-rose-400 font-mono font-bold">{project.slug}</code> để xác nhận:
            </label>
            <input
              type="text"
              value={confirmSlug}
              onChange={(e) => setConfirmSlug(e.target.value)}
              placeholder={project.slug}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-rose-500"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
              {error}
            </div>
          )}

          <div className="mt-5 flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!isConfirmed || isDeleting}
              className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-lg shadow-rose-950/60"
            >
              {isDeleting ? (
                <span>Đang xóa...</span>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa Vĩnh Viễn</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
