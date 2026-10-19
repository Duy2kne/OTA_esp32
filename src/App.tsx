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
  Trash2,
  Sparkles,
  RefreshCw,
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
import { DeleteProjectModal } from './components/DeleteProjectModal.tsx';
import { WorkflowTrackerModal } from './components/WorkflowTrackerModal.tsx';
import { BinInspectorModal } from './components/BinInspectorModal.tsx';
import { RolloutSimulatorModal } from './components/RolloutSimulatorModal.tsx';
import { ArchitectureGuideModal } from './components/ArchitectureGuideModal.tsx';

const STORAGE_CUSTOM_PROJECTS = 'esp32_ota_custom_projects_v2';
const STORAGE_DELETED_SLUGS = 'esp32_ota_deleted_slugs_v2';

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
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
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
      let baseProjects: ProjectSummary[] = [];

      try {
        const res = await fetch('./ota/index.json', { cache: 'no-cache' });
        if (res.ok) {
          const data: OtaIndex = await res.json();
          baseProjects = data.projects || [];
        }
      } catch (e) {
        console.warn('Không tải được ./ota/index.json, dùng dữ liệu lưu trữ trình duyệt');
      }

      // Read deleted slugs from localStorage
      const deletedSlugs: string[] = JSON.parse(localStorage.getItem(STORAGE_DELETED_SLUGS) || '[]');
      // Filter out deleted projects
      let merged = baseProjects.filter((p) => !deletedSlugs.includes(p.slug));

      // Merge with custom added projects from localStorage
      const customProjects: ProjectSummary[] = JSON.parse(
        localStorage.getItem(STORAGE_CUSTOM_PROJECTS) || '[]'
      );

      for (const cp of customProjects) {
        if (deletedSlugs.includes(cp.slug)) continue;
        const existingIdx = merged.findIndex((p) => p.slug === cp.slug);
        if (existingIdx !== -1) {
          merged[existingIdx] = cp; // override with latest edits
        } else {
          merged.push(cp);
        }
      }

      setOtaData({
        generatedAt: new Date().toISOString(),
        version: '1.0.0',
        projects: merged,
      });
    } catch (err: any) {
      console.warn('Lỗi tải manifest:', err);
      setError('Đang sử dụng dữ liệu lưu trữ trình duyệt.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOtaIndex();
  }, []);

  const saveCustomProjectsToStorage = (projects: ProjectSummary[]) => {
    localStorage.setItem(STORAGE_CUSTOM_PROJECTS, JSON.stringify(projects));
  };

  const handleLoginSuccess = (newAuth: GitHubAuth) => {
    setAuth(newAuth);
    localStorage.setItem('esp32_ota_auth', JSON.stringify(newAuth));
  };

  const handleLogout = () => {
    setAuth(null);
    localStorage.removeItem('esp32_ota_auth');
  };

  // Add Project
  const handleNewProjectSuccess = (newProject: ProjectSummary) => {
    if (!otaData) return;
    const updatedProjects = [newProject, ...otaData.projects.filter((p) => p.slug !== newProject.slug)];
    setOtaData({
      ...otaData,
      projects: updatedProjects,
    });
    saveCustomProjectsToStorage(updatedProjects);
    setSelectedSlug(newProject.slug);

    if (auth) {
      setIsWorkflowOpen(true);
    }
  };

  // Delete Project
  const handleDeleteProject = (slugToDelete: string) => {
    if (!otaData) return;
    const deletedSlugs: string[] = JSON.parse(localStorage.getItem(STORAGE_DELETED_SLUGS) || '[]');
    if (!deletedSlugs.includes(slugToDelete)) {
      deletedSlugs.push(slugToDelete);
      localStorage.setItem(STORAGE_DELETED_SLUGS, JSON.stringify(deletedSlugs));
    }

    const updatedProjects = otaData.projects.filter((p) => p.slug !== slugToDelete);
    setOtaData({
      ...otaData,
      projects: updatedProjects,
    });
    saveCustomProjectsToStorage(updatedProjects);
    setSelectedSlug(null);
  };

  // Quick Action: Delete the 2 sample projects in 1 click
  const handleDeleteSampleProjects = () => {
    const sampleSlugs = ['smart-meter-c3', 'weather-station-s3'];
    sampleSlugs.forEach((slug) => handleDeleteProject(slug));
  };

  // Upload release
  const handleUploadSuccess = (newRelease: ReleaseConfig, commitSha?: string) => {
    if (!otaData || !selectedSlug) return;
    const updatedProjects = otaData.projects.map((p) => {
      if (p.slug !== selectedSlug) return p;
      const updatedReleases = [newRelease, ...p.releases.filter((r) => r.version !== newRelease.version)];
      return {
        ...p,
        releases: updatedReleases,
        latestByChannel: {
          ...p.latestByChannel,
          [newRelease.channel]: newRelease,
        },
      };
    });

    setOtaData({
      ...otaData,
      projects: updatedProjects,
    });
    saveCustomProjectsToStorage(updatedProjects);

    if (commitSha) {
      setLastCommitSha(commitSha);
      setIsWorkflowOpen(true);
    }
  };

  const handleReleaseUpdated = (updatedRelease: ReleaseConfig) => {
    if (!otaData || !selectedSlug) return;
    const updatedProjects = otaData.projects.map((p) => {
      if (p.slug !== selectedSlug) return p;
      return {
        ...p,
        releases: p.releases.map((r) => (r.version === updatedRelease.version ? updatedRelease : r)),
      };
    });
    setOtaData({
      ...otaData,
      projects: updatedProjects,
    });
    saveCustomProjectsToStorage(updatedProjects);
    if (auth) setIsWorkflowOpen(true);
  };

  const handleDeleteRelease = (versionToDelete: string) => {
    if (!otaData || !selectedSlug) return;
    if (!confirm(`Bạn có chắc chắn muốn xóa bản release v${versionToDelete}?`)) return;

    const updatedProjects = otaData.projects.map((p) => {
      if (p.slug !== selectedSlug) return p;
      const filtered = p.releases.filter((r) => r.version !== versionToDelete);
      return {
        ...p,
        releases: filtered,
      };
    });
    setOtaData({
      ...otaData,
      projects: updatedProjects,
    });
    saveCustomProjectsToStorage(updatedProjects);
  };

  const handlePinsUpdated = (updatedPins: DevicePins) => {
    if (!otaData || !selectedSlug) return;
    const updatedProjects = otaData.projects.map((p) => (p.slug === selectedSlug ? { ...p, pins: updatedPins } : p));
    setOtaData({
      ...otaData,
      projects: updatedProjects,
    });
    saveCustomProjectsToStorage(updatedProjects);
    if (auth) setIsWorkflowOpen(true);
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

  const hasSampleProjects = (otaData?.projects || []).some(
    (p) => p.slug === 'smart-meter-c3' || p.slug === 'weather-station-s3'
  );

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
        onOpenNewProject={() => setIsNewProjectOpen(true)}
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
            onDeleteProject={() => setIsDeleteOpen(true)}
            onDeleteRelease={handleDeleteRelease}
            baseUrl={baseUrl}
          />
        ) : (
          /* Projects Overview Grid */
          <div className="space-y-6">
            {/* Hero / Stat banner */}
            <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/30 border border-slate-800 p-6 sm:p-7 relative overflow-hidden shadow-2xl">
              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
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
                    Hệ thống OTA không cần backend, phục vụ manifest tĩnh qua GitHub Pages CDN với kiểm định chặt chẽ magic byte <code className="text-cyan-400 font-mono">0xE9</code>, chip ID, SHA-256 và cơ chế tự động rollback.
                  </p>
                </div>

                {/* Always-visible Add Project and Quick Clear Sample buttons */}
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

                  {/* PROMINENT ADD PROJECT BUTTON - ALWAYS ACCESSIBLE */}
                  <button
                    onClick={() => setIsNewProjectOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs transition shadow-lg shadow-cyan-950/60"
                  >
                    <FolderPlus className="w-4 h-4" />
                    <span>+ Thêm Dự Án Của Bạn</span>
                  </button>

                  {/* Clear Sample Projects Button if samples exist */}
                  {hasSampleProjects && (
                    <button
                      onClick={handleDeleteSampleProjects}
                      className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-950 hover:bg-rose-950/50 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-800/80 text-xs transition"
                      title="Xóa 2 dự án mẫu để làm việc với dự án thực tế của bạn"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa 2 Dự Án Mẫu</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

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
              <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-4">
                <Cpu className="w-12 h-12 text-slate-600 mx-auto" />
                <div>
                  <h3 className="text-base font-bold text-white mb-1">Chưa có dự án nào</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Bạn chưa có dự án nào trong danh sách. Hãy nhấn nút dưới đây để tạo dự án firmware thực tế đầu tiên của bạn!
                  </p>
                </div>
                <button
                  onClick={() => setIsNewProjectOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition shadow-lg shadow-cyan-950/60"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>+ Thêm Dự Án Ngay Bây Giờ</span>
                </button>
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

      <NewProjectModal
        isOpen={isNewProjectOpen}
        onClose={() => setIsNewProjectOpen(false)}
        auth={auth}
        onSuccess={handleNewProjectSuccess}
      />

      {selectedProject && (
        <UploadFirmwareModal
          isOpen={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
          project={selectedProject}
          auth={auth}
          onSuccess={handleUploadSuccess}
        />
      )}

      {selectedProject && (
        <EditPinsModal
          isOpen={isPinsOpen}
          onClose={() => setIsPinsOpen(false)}
          project={selectedProject}
          auth={auth}
          onSuccess={handlePinsUpdated}
        />
      )}

      {selectedProject && activeReleaseForEdit && (
        <EditReleaseModal
          isOpen={!!activeReleaseForEdit}
          onClose={() => setActiveReleaseForEdit(null)}
          projectSlug={selectedProject.slug}
          release={activeReleaseForEdit}
          auth={auth}
          onSuccess={handleReleaseUpdated}
        />
      )}

      {selectedProject && (
        <DeleteProjectModal
          isOpen={isDeleteOpen}
          onClose={() => setIsDeleteOpen(false)}
          project={selectedProject}
          auth={auth}
          onSuccess={handleDeleteProject}
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
