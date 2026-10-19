/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Cpu, ArrowRight, Layers, Pin, Copy, Check, Radio } from 'lucide-react';
import type { ProjectSummary } from '../lib/ota-types.ts';

interface ProjectCardProps {
  project: ProjectSummary;
  onSelect: () => void;
  baseUrl: string;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, onSelect, baseUrl }) => {
  const [copied, setCopied] = useState(false);

  const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const defaultManifestUrl = `${cleanBase}${project.slug}/stable.json`;

  const handleCopyManifest = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(defaultManifestUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getChipStyle = (chip: string) => {
    switch (chip) {
      case 'esp32c3':
        return {
          border: 'border-cyan-500/30 hover:border-cyan-500/60',
          badge: 'bg-cyan-950/80 border-cyan-800 text-cyan-300',
          label: 'ESP32-C3',
        };
      case 'esp32s3':
        return {
          border: 'border-purple-500/30 hover:border-purple-500/60',
          badge: 'bg-purple-950/80 border-purple-800 text-purple-300',
          label: 'ESP32-S3',
        };
      default:
        return {
          border: 'border-blue-500/30 hover:border-blue-500/60',
          badge: 'bg-blue-950/80 border-blue-800 text-blue-300',
          label: 'ESP32',
        };
    }
  };

  const chipStyle = getChipStyle(project.config.chip);
  const pinCount = Object.keys(project.pins || {}).length;

  return (
    <div
      onClick={onSelect}
      className={`group rounded-2xl bg-slate-900 border ${chipStyle.border} p-5 cursor-pointer shadow-lg hover:shadow-cyan-950/20 transition-all duration-200 flex flex-col justify-between`}
    >
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white group-hover:text-cyan-300 transition line-clamp-1">
                {project.config.name}
              </h3>
              <span className="font-mono text-[11px] text-slate-500">{project.slug}</span>
            </div>
          </div>
          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${chipStyle.badge}`}>
            {chipStyle.label}
          </span>
        </div>

        {/* Description */}
        <p className="text-xs text-slate-400 line-clamp-2 mb-4 leading-relaxed">
          {project.config.description || 'Chưa có mô tả cho dự án này.'}
        </p>

        {/* Channel Status */}
        <div className="space-y-1.5 mb-4">
          {project.config.channels.map((ch) => {
            const rel = project.latestByChannel[ch];
            return (
              <div
                key={ch}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-850 text-xs font-mono"
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span className="text-slate-300 uppercase font-semibold text-[10px]">{ch}</span>
                </div>
                {rel ? (
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold">v{rel.version}</span>
                    <span className="text-[10px] text-cyan-400">({rel.rollout}%)</span>
                  </div>
                ) : (
                  <span className="text-slate-600 text-[11px]">—</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
          <span className="flex items-center gap-1">
            <Layers className="w-3 h-3 text-slate-500" />
            {project.releases.length} bản
          </span>
          {pinCount > 0 && (
            <span className="flex items-center gap-1 text-amber-400">
              <Pin className="w-3 h-3" />
              {pinCount} pins
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopyManifest}
            title="Copy URL manifest (stable)"
            className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <div className="flex items-center gap-1 text-cyan-400 font-semibold group-hover:translate-x-0.5 transition">
            <span>Chi tiết</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
};
