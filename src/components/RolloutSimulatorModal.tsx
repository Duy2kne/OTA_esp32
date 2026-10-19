/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Calculator, CheckCircle2, XCircle, ArrowRight, Info } from 'lucide-react';
import { calculateRolloutSlot } from '../lib/crypto-utils.ts';

interface RolloutSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultVersion?: string;
}

export const RolloutSimulatorModal: React.FC<RolloutSimulatorModalProps> = ({
  isOpen,
  onClose,
  defaultVersion = '1.1.0',
}) => {
  const [deviceId, setDeviceId] = useState('24:0A:C4:01:2A:3B');
  const [version, setVersion] = useState(defaultVersion);
  const [rollout, setRollout] = useState(40);
  const [isPinned, setIsPinned] = useState(false);

  if (!isOpen) return null;

  const cleanDeviceId = deviceId.replace(/[: -]/g, '').toUpperCase();
  const slot = calculateRolloutSlot(cleanDeviceId, version);
  const isEligible = isPinned || slot < rollout;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-800 text-cyan-400">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Giả Lập Thuật Toán Rollout</h3>
              <p className="text-xs text-slate-400 font-mono">hash(deviceId + ":" + version) % 100</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Inputs */}
        <div className="mt-5 space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Device ID hoặc Địa chỉ MAC (WiFi MAC / eFuse):
            </label>
            <input
              type="text"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              placeholder="VD: 24:0A:C4:01:2A:3B hoặc NODE_01"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Phiên bản mục tiêu:
              </label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="VD: 1.1.0"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Tỉ lệ Rollout: <span className="text-cyan-400 font-mono">{rollout}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={rollout}
                onChange={(e) => setRollout(parseInt(e.target.value, 10))}
                className="w-full mt-2 accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="pinnedCheck"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="w-4 h-4 rounded border-slate-700 bg-slate-950 accent-cyan-400"
            />
            <label htmlFor="pinnedCheck" className="text-xs text-slate-300 cursor-pointer">
              Thiết bị được <span className="text-amber-400 font-semibold">Ghim (Pin)</span> cố định vào phiên bản này
            </label>
          </div>

          {/* Result Card */}
          <div className={`p-4 rounded-xl border ${isEligible ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300' : 'bg-rose-950/20 border-rose-500/40 text-rose-300'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {isEligible ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-400" />
                )}
                <span className="font-bold text-sm">
                  {isPinned
                    ? 'ĐƯỢC CẬP NHẬT (Do Ghim Cố Định)'
                    : isEligible
                    ? `ĐƯỢC CẬP NHẬT (Slot ${slot} < ${rollout}%)`
                    : `BỊ HOÃN CẬP NHẬT (Slot ${slot} ≥ ${rollout}%)`}
                </span>
              </div>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
                Slot: #{slot}
              </span>
            </div>

            {/* Spectrum Visualizer */}
            <div className="mt-3">
              <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-mono">
                <span>0% (Được update)</span>
                <span>Rollout hiện tại: {rollout}%</span>
                <span>100%</span>
              </div>
              <div className="relative h-4 rounded-full bg-slate-800 overflow-hidden border border-slate-700">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500/60 to-cyan-500/60 transition-all duration-300"
                  style={{ width: `${rollout}%` }}
                />
                {/* Pointer for current device slot */}
                <div
                  className="absolute top-0 bottom-0 w-1.5 bg-white shadow-md shadow-white -ml-0.5"
                  style={{ left: `${slot}%` }}
                  title={`Thiết bị ở slot ${slot}%`}
                />
              </div>
              <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">
                Vạch trắng là vị trí slot của thiết bị (<strong>{slot}</strong>). Vì thuật toán hash là xác định (deterministic), thiết bị này sẽ luôn luôn rơi vào slot <strong>{slot}</strong> đối với phiên bản <strong>{version}</strong>, bảo đảm không bị nhảy qua nhảy lại giữa các lần query.
              </p>
            </div>
          </div>
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
