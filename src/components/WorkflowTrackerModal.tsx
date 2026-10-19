/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { X, PlayCircle, CheckCircle2, XCircle, Clock, ExternalLink, RefreshCw, Zap } from 'lucide-react';
import { GitHubService, type GitHubAuth, type WorkflowRun } from '../lib/github-api.ts';

interface WorkflowTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  auth: GitHubAuth;
  commitSha?: string;
  onDeployFinished?: () => void;
}

export const WorkflowTrackerModal: React.FC<WorkflowTrackerModalProps> = ({
  isOpen,
  onClose,
  auth,
  commitSha,
  onDeployFinished,
}) => {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeRun, setActiveRun] = useState<WorkflowRun | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const gitService = new GitHubService(auth);

    const pollRuns = async () => {
      setIsLoading(true);
      try {
        const list = await gitService.getLatestWorkflowRuns();
        if (!isMounted) return;
        setRuns(list);

        // Find relevant run by commitSha or first run
        const target = commitSha
          ? list.find((r) => r.head_commit.id.startsWith(commitSha.slice(0, 7))) || list[0]
          : list[0];
        setActiveRun(target || null);

        if (target && target.status === 'completed' && onDeployFinished) {
          onDeployFinished();
        }
      } catch (err) {
        console.error('Error polling workflows:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    pollRuns();
    // Poll every 4 seconds while running
    const interval = setInterval(pollRuns, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen, auth, commitSha]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-800 text-cyan-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Tiến Độ Deploy GitHub Actions</h3>
              <p className="text-xs text-slate-400">Theo dõi tiến trình build OTA & triển khai GitHub Pages</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Display */}
        <div className="mt-5 space-y-4 text-xs">
          {activeRun ? (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-sm">{activeRun.name}</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 ${
                    activeRun.status === 'completed'
                      ? activeRun.conclusion === 'success'
                        ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                        : 'bg-rose-950/80 text-rose-400 border border-rose-800'
                      : 'bg-cyan-950/80 text-cyan-400 border border-cyan-800 animate-pulse'
                  }`}
                >
                  {activeRun.status === 'completed' ? (
                    activeRun.conclusion === 'success' ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Thành Công</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3 text-rose-400" />
                        <span>Thất Bại</span>
                      </>
                    )
                  ) : (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin text-cyan-400" />
                      <span>{activeRun.status === 'queued' ? 'Đang Chờ...' : 'Đang Deploy...'}</span>
                    </>
                  )}
                </span>
              </div>

              <div className="font-mono text-[11px] text-slate-400 space-y-1">
                <div>Commit: <span className="text-cyan-300 font-semibold">{activeRun.head_commit.message}</span></div>
                <div>Hash: <span className="text-slate-300">{activeRun.head_commit.id.slice(0, 7)}</span></div>
                <div>Khởi tạo: <span className="text-slate-300">{new Date(activeRun.created_at).toLocaleTimeString('vi-VN')}</span></div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-900">
                <a
                  href={activeRun.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-semibold text-[11px]"
                >
                  <span>Xem Chi Tiết Log Trên GitHub</span>
                  <ExternalLink className="w-3 h-3" />
                </a>

                {isLoading && (
                  <span className="flex items-center gap-1 text-slate-500 text-[10px]">
                    <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                    Đang đồng bộ...
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-slate-400 bg-slate-950 rounded-xl border border-slate-800">
              <Clock className="w-6 h-6 mx-auto mb-2 text-slate-600 animate-pulse" />
              <p>Đang tìm kiếm lượt chạy workflow mới nhất trên GitHub Actions...</p>
            </div>
          )}

          {/* Success Banner */}
          {activeRun?.status === 'completed' && activeRun?.conclusion === 'success' && (
            <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/40 text-emerald-300 text-[11px] leading-relaxed">
              🎉 <strong>GitHub Pages đã deploy xong!</strong> Manifest mới và file binary đã có mặt trên CDN. Lưu ý thiết bị có thể cần tới 10 phút để nhận manifest mới nhất do bộ đệm CDN của GitHub Pages.
            </div>
          )}

          {/* Recent Runs History */}
          {runs.length > 1 && (
            <div className="pt-2">
              <span className="font-semibold text-slate-400 block mb-1.5 text-[11px]">Các lượt chạy gần đây:</span>
              <div className="space-y-1 max-h-32 overflow-y-auto font-mono text-[11px]">
                {runs.slice(1, 4).map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-2 rounded bg-slate-950/60 border border-slate-850 text-slate-300"
                  >
                    <span className="truncate max-w-[240px]">{r.head_commit.message || 'Manual build'}</span>
                    <span className={r.conclusion === 'success' ? 'text-emerald-400' : 'text-slate-400'}>
                      {r.conclusion || r.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

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
