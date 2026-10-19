/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Key, Shield, ExternalLink, AlertCircle, CheckCircle2 } from 'lucide-react';
import { GitHubService, type GitHubAuth } from '../lib/github-api.ts';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (auth: GitHubAuth) => void;
  currentAuth: GitHubAuth | null;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSuccess, currentAuth }) => {
  const [token, setToken] = useState(currentAuth?.token || '');
  const [owner, setOwner] = useState(currentAuth?.owner || '');
  const [repo, setRepo] = useState(currentAuth?.repo || '');
  const [branch, setBranch] = useState(currentAuth?.branch || 'main');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleVerifyAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim() || !owner.trim() || !repo.trim()) {
      setError('Vui lòng nhập đầy đủ Token, Owner và Repo');
      return;
    }

    setIsLoading(true);
    setError(null);

    const authConfig: GitHubAuth = {
      token: token.trim(),
      owner: owner.trim(),
      repo: repo.trim(),
      branch: branch.trim() || 'main',
    };

    const service = new GitHubService(authConfig);
    const result = await service.verifyAccess();

    setIsLoading(false);

    if (result.ok) {
      onSuccess(authConfig);
      onClose();
    } else {
      setError(result.error || 'Xác thực thất bại');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-800 text-cyan-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Kết Nối Quyền Quản Trị GitHub</h3>
              <p className="text-xs text-slate-400">Dùng Fine-grained Personal Access Token</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Alert */}
        <div className="mt-4 p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/60 text-xs text-slate-300 flex items-start gap-2.5">
          <Shield className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-cyan-300">Bảo mật Token trên trình duyệt</p>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Token chỉ được lưu cục bộ trong <code>localStorage</code> của bạn và chỉ gửi trực tiếp đến GitHub API qua HTTPS. Không có bất kỳ máy chủ trung gian nào lưu trữ token của bạn.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleVerifyAndSave} className="mt-4 space-y-3.5 text-xs">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-300">GitHub Personal Access Token (PAT):</label>
              <a
                href="https://github.com/settings/tokens?type=beta"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px]"
              >
                Tạo Token <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="github_pat_11..."
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
              required
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              Yêu cầu quyền: <strong>Repository permissions ➔ Contents: Read and write</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">GitHub Owner / User:</label>
              <input
                type="text"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="vd: username hoặc org"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Repository Name:</label>
              <input
                type="text"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="vd: esp32-ota-hub"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Branch đích:</label>
            <input
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
              required
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-5 flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-lg shadow-cyan-950/60"
            >
              {isLoading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Đang Kiểm Tra...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Xác Nhận & Lưu</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
