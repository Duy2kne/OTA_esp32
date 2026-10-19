/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  FolderPlus,
  Search,
  Filter,
  Cpu,
  Layers,
  Pin,
  Shield,
  Activity,
  AlertCircle,
  ExternalLink,
  Github,
  Key,
} from 'lucide-react';
import type { OtaIndex, ProjectSummary, ReleaseConfig, DevicePins, EspChip } from './lib/ota-types.ts';
import type { GitHubAuth } from './lib/github-api.ts';
import { Navbar } from './components/Navbar.tsx';
import { ProjectCard } from './components/ProjectCard.tsx';
import { ProjectDetailView } from './components/ProjectDetailView.tsx';
import { LoginModal } from './components/LoginModal.tsx';
import { UploadFirmwareModal } from './components/UploadFirmwareModal.tsx';
import { NewProjectModal } from './components/NewProjectModal.tsx';
import { EditReleaseModal } from './components/EditReleaseModal.tsx';
import { EditPinsModal } from './components/EditPinsModal.tsx';
import { WorkflowTrackerModal } from './components/WorkflowTrackerModal.tsx';
import { BinInspectorModal } from './components/BinInspectorModal.tsx';
import { RolloutSimulatorModal } from './components/RolloutSimulatorModal.tsx';
import { ArchitectureGuideModal } from './components/ArchitectureGuideModal.tsx';

export default function App() {
  const [otaData, setOtaData] = useState<OtaIndex | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auth state
  const [auth, setAuth] = useState<GitHubAuth | null>(() => {
    try {
      const saved = localStorage.getItem('esp32_ota_auth');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Selected project for detail view
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [chipFilter, setChipFilter] = useState<'all' | EspChip>('all');

  // Modals
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isPinsOpen, setIsPinsOpen] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isWorkflowOpen, setIsWorkflowOpen] = useState(false);

  const [activeReleaseForEdit, setActiveReleaseForEdit] = useState<ReleaseConfig | null>(null);
  const [lastCommitSha, setLastCommitSha] = useState<string | undefined>(undefined);

  // Compute Base URL for OTA manifest endpoints
  const getOtaBaseUrl = () => {
    const origin = window.location.origin;
    let pathname = window.location.pathname;
    if (!pathname.endsWith('/')) {
      pathname = pathname.substring(0, pathname.lastIndexOf('/') + 1);
    }
    return `${origin}${pathname}ota/`;
  };

  const [baseUrl] = useState(getOtaBaseUrl);

  const fetchOtaIndex = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Try relative ota/index.json first
      const res = await fetch('./ota/index.json', { cache: 'no-cache' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Không thể tải ./ota/index.json`);
      }
      const data: OtaIndex = await res.json();
      setOtaData(data);
    } catch (err: any) {
      console.warn('Lỗi tải manifest ota/index.json:', err);
      setError(
        'Chưa tải được manifest tĩnh từ ota/index.json. Hãy chắc chắn lệnh npm run build-ota đã được chạy.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOtaIndex();
  }, []);

  const handleLoginSuccess = (newAuth: GitHubAuth) => {
    setAuth(newAuth);
    localStorage.setItem('esp32_ota_auth', JSON.stringify(newAuth));
  };

  const handleLogout = () => {
    setAuth(null);
    localStorage.removeItem('esp32_ota_auth');
  };

  const handleUploadSuccess = (commitSha: string) => {
    setLastCommitSha(commitSha);
    setIsWorkflowOpen(true);
    // Refresh data after small delay
    setTimeout(fetchOtaIndex, 3000);
  };

  const handleNewProjectSuccess = (newSlug: string) => {
    setSelectedSlug(newSlug);
    setIsWorkflowOpen(true);
    setTimeout(fetchOtaIndex, 3000);
  };

  const handleReleaseUpdated = (updatedRelease: ReleaseConfig) => {
    if (!otaData || !selectedSlug) return;
    setOtaData({
      ...otaData,
      projects: otaData.projects.map((p) => {
        if (p.slug !== selectedSlug) return p;
        return {
          ...p,
          releases: p.releases.map((r) => (r.version === updatedRelease.version ? updatedRelease : r)),
        };
      }),
    });
    setIsWorkflowOpen(true);
  };

  const handlePinsUpdated = (updatedPins: DevicePins) => {
    if (!otaData || !selectedSlug) return;
    setOtaData({
      ...otaData,
      projects: otaData.projects.map((p) => (p.slug === selectedSlug ? { ...p, pins: updatedPins } : p)),
    });
    setIsWorkflowOpen(true);
  };

  const selectedProject = otaData?.projects.find((p) => p.slug === selectedSlug) || null;

  // Filter projects
  const filteredProjects = (otaData?.projects || []).filter((p) => {
    const matchesSearch =
      p.config.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.config.description.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesChip = chipFilter === 'all' || p.config.chip === chipFilter;
    return matchesSearch && matchesChip;
  });

  const totalProjects = otaData?.projects.length || 0;
  const totalReleases = otaData?.projects.reduce((acc, p) => acc + p.releases.length, 0) || 0;
  const totalPins = otaData?.projects.reduce((acc, p) => acc + Object.keys(p.pins || {}).length, 0) || 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Navbar */}
      <Navbar
        isAdminMode={!!auth}
        onToggleAdminMode={() => {
          if (!auth) setIsLoginOpen(true);
          else handleLogout();
        }}
        auth={auth}
        onOpenLoginModal={() => setIsLoginOpen(true)}
        onLogout={handleLogout}
        onOpenGuide={() => setIsGuideOpen(true)}
        onOpenInspector={() => setIsInspectorOpen(true)}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
        onRefreshData={fetchOtaIndex}
        isLoading={isLoading}
      />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {selectedProject ? (
          /* Project Detail View */
          <ProjectDetailView
            project={selectedProject}
            onBack={() => setSelectedSlug(null)}
            isAdmin={!!auth}
            onOpenUpload={() => setIsUploadOpen(true)}
            onOpenPins={() => setIsPinsOpen(true)}
            onOpenEditRelease={(rel) => setActiveReleaseForEdit(rel)}
            baseUrl={baseUrl}
          />
        ) : (
          /* Projects Overview Grid */
          <div className="space-y-6">
            {/* Hero / Stat banner */}
            <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/30 border border-slate-800 p-6 sm:p-7 relative overflow-hidden shadow-2xl">
              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800 font-bold uppercase tracking-wider">
                      Zero-Server OTA Architecture
                    </span>
                    <span className="text-xs text-slate-400 hidden sm:inline">
                      • Build-time manifest validation
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    Trung Tâm Cập Nhật Firmware Cho ESP32
                  </h1>
                  <p className="mt-1 text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
                    Hệ thống OTA không cần backend, phục vụ manifest tĩnh siêu tốc qua GitHub Pages CDN với kiểm định chặt chẽ magic byte <code className="text-cyan-400 font-mono">0xE9</code>, chip ID, SHA-256 và cơ chế tự động rollback bảo vệ thiết bị.
                  </p>
                </div>

                {/* Quick stats & new project trigger */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-4 bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 font-mono text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px]">DỰ ÁN</span>
                      <strong className="text-base text-cyan-400">{totalProjects}</strong>
                    </div>
                    <div className="w-px h-7 bg-slate-800" />
                    <div>
                      <span className="text-slate-500 block text-[10px]">RELEASES</span>
                      <strong className="text-base text-white">{totalReleases}</strong>
                    </div>
                    <div className="w-px h-7 bg-slate-800" />
                    <div>
                      <span className="text-slate-500 block text-[10px]">GHIM (PINS)</span>
                      <strong className="text-base text-amber-400">{totalPins}</strong>
                    </div>
                  </div>

                  {auth && (
                    <button
                      onClick={() => setIsNewProjectOpen(true)}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition shadow-lg shadow-cyan-950/60"
                    >
                      <FolderPlus className="w-4 h-4" />
                      <span>Tạo Dự Án Mới</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Error banner if manifest fetch fails */}
            {error && (
              <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800 text-rose-300 text-xs flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-semibold block">Thông báo đồng bộ dữ liệu tĩnh:</strong>
                    <span>{error}</span>
                  </div>
                </div>
                <button
                  onClick={fetchOtaIndex}
                  className="px-3 py-1 rounded bg-rose-900/60 hover:bg-rose-800 text-rose-200 text-xs font-semibold whitespace-nowrap transition"
                >
                  Thử lại
                </button>
              </div>
            )}

            {/* Search & Chip Filter Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Tìm kiếm dự án theo tên hoặc slug..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 transition"
                />
              </div>

              {/* Chip Filter Buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <span className="text-xs text-slate-500 mr-1 flex items-center gap-1">
                  <Filter className="w-3 h-3" />
                  Chip:
                </span>
                {(['all', 'esp32c3', 'esp32s3', 'esp32'] as const).map((chip) => (
                  <button
                    key={chip}
                    onClick={() => setChipFilter(chip)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition ${
                      chipFilter === chip
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {chip === 'all' ? 'Tất cả' : chip.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Projects Grid */}
            {filteredProjects.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800/80">
                <Cpu className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-white mb-1">Không tìm thấy dự án phù hợp</h3>
                <p className="text-xs text-slate-400">
                  Hãy thử đổi từ khóa tìm kiếm hoặc bấm nút "Tạo Dự Án Mới" để thêm firmware đầu tiên.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredProjects.map((project) => (
                  <ProjectCard
                    key={project.slug}
                    project={project}
                    onSelect={() => setSelectedSlug(project.slug)}
                    baseUrl={baseUrl}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-5 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>ESP32 OTA Multi-Project Hub • Powered by GitHub Pages & Actions</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <button onClick={() => setIsGuideOpen(true)} className="hover:text-cyan-400 transition">
              Tài liệu & Kiến Trúc
            </button>
            <span>•</span>
            <button onClick={() => setIsSimulatorOpen(true)} className="hover:text-cyan-400 transition">
              Giả Lập Rollout
            </button>
            <span>•</span>
            <button onClick={() => setIsInspectorOpen(true)} className="hover:text-cyan-400 transition">
              Soi Binary (.bin)
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSuccess={handleLoginSuccess}
        currentAuth={auth}
      />

      {auth && selectedProject && (
        <UploadFirmwareModal
          isOpen={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
          project={selectedProject}
          auth={auth}
          onSuccess={handleUploadSuccess}
        />
      )}

      {auth && (
        <NewProjectModal
          isOpen={isNewProjectOpen}
          onClose={() => setIsNewProjectOpen(false)}
          auth={auth}
          onSuccess={handleNewProjectSuccess}
        />
      )}

      {auth && selectedProject && (
        <EditPinsModal
          isOpen={isPinsOpen}
          onClose={() => setIsPinsOpen(false)}
          project={selectedProject}
          auth={auth}
          onSuccess={handlePinsUpdated}
        />
      )}

      {auth && selectedProject && activeReleaseForEdit && (
        <EditReleaseModal
          isOpen={!!activeReleaseForEdit}
          onClose={() => setActiveReleaseForEdit(null)}
          projectSlug={selectedProject.slug}
          release={activeReleaseForEdit}
          auth={auth}
          onSuccess={handleReleaseUpdated}
        />
      )}

      {auth && (
        <WorkflowTrackerModal
          isOpen={isWorkflowOpen}
          onClose={() => setIsWorkflowOpen(false)}
          auth={auth}
          commitSha={lastCommitSha}
          onDeployFinished={fetchOtaIndex}
        />
      )}

      <BinInspectorModal
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
      />

      <RolloutSimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
      />

      <ArchitectureGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </div>
  );
}
