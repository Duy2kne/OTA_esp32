/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Cpu,
  ShieldAlert,
  Key,
  LogOut,
  HelpCircle,
  Binary,
  Calculator,
  RefreshCw,
  GitBranch,
} from 'lucide-react';
import type { GitHubAuth } from '../lib/github-api.ts';

interface NavbarProps {
  isAdminMode: boolean;
  onToggleAdminMode: () => void;
  auth: GitHubAuth | null;
  onOpenLoginModal: () => void;
  onLogout: () => void;
  onOpenGuide: () => void;
  onOpenInspector: () => void;
  onOpenSimulator: () => void;
  onRefreshData: () => void;
  isLoading: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  isAdminMode,
  onToggleAdminMode,
  auth,
  onOpenLoginModal,
  onLogout,
  onOpenGuide,
  onOpenInspector,
  onOpenSimulator,
  onRefreshData,
  isLoading,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/30 text-cyan-400 shadow-lg shadow-cyan-950/40">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-white font-mono">
                  ESP32<span className="text-cyan-400">.OTA</span>
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60">
                  GitHub Native
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                OTA đa dự án cho ESP32 / C3 / S3 trên Pages & Actions
              </p>
            </div>
          </div>

          {/* Quick utility tools */}
          <div className="hidden md:flex items-center gap-1.5">
            <button
              onClick={onOpenInspector}
              title="Soi header, magic byte 0xE9 và chip ID của file .bin bất kỳ"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-cyan-300 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition"
            >
              <Binary className="w-3.5 h-3.5 text-cyan-400" />
              <span>Soi Binary (.bin)</span>
            </button>

            <button
              onClick={onOpenSimulator}
              title="Kiểm tra slot rollout của thiết bị theo công thức hash(deviceId + version)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-cyan-300 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition"
            >
              <Calculator className="w-3.5 h-3.5 text-cyan-400" />
              <span>Giả Lập Rollout</span>
            </button>

            <button
              onClick={onOpenGuide}
              title="Kiến trúc hệ thống, quy tắc bảo mật và hướng dẫn cấu hình"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-cyan-300 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition"
            >
              <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
              <span>Kiến Trúc & HD</span>
            </button>
          </div>

          {/* Actions & Mode switch */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onRefreshData}
              disabled={isLoading}
              title="Làm mới dữ liệu từ manifest tĩnh"
              className="p-2 rounded-lg text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>

            {/* Admin Toggle / Status */}
            {auth ? (
              <div className="flex items-center gap-2 bg-slate-900/90 border border-cyan-500/40 rounded-lg p-1 pl-2.5">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-slate-200 font-mono text-[11px] hidden sm:inline">
                    {auth.owner}/{auth.repo}
                  </span>
                </div>
                <button
                  onClick={onLogout}
                  title="Đăng xuất / Xóa Token khỏi trình duyệt"
                  className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-300 text-xs transition"
                >
                  <LogOut className="w-3 h-3" />
                  <span className="hidden sm:inline">Thoát</span>
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenLoginModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-md shadow-cyan-950/60 transition"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Quản Trị (PAT)</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notice Banner */}
      <div className="border-t border-slate-900 bg-slate-950 px-4 py-1.5 text-center text-[11px] text-slate-400 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <span className="flex items-center gap-1 text-amber-400/90">
          <ShieldAlert className="w-3 h-3 flex-shrink-0" />
          <span>Pages là PUBLIC: Tuyệt đối không nhúng mật khẩu WiFi / secrets vào firmware.</span>
        </span>
        <span className="text-slate-600 hidden sm:inline">•</span>
        <span className="text-slate-400">
          GitHub Pages cache CDN ~10 phút: Manifest mới có thể mất tối đa 10 phút để cập nhật đến thiết bị.
        </span>
      </div>
    </header>
  );
};
