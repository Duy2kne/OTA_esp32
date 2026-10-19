/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type EspChip = 'esp32' | 'esp32c3' | 'esp32s3';

export type ReleaseChannel = 'stable' | 'beta';

export type ReleaseStatus = 'active' | 'paused' | 'revoked';

export interface ProjectConfig {
  name: string;
  description: string;
  chip: EspChip;
  channels: ReleaseChannel[];
  createdAt?: string;
}

export interface ReleaseConfig {
  version: string;
  channel: ReleaseChannel;
  notes: string;
  rollout: number; // 0 - 100
  mandatory: boolean;
  minVersion?: string;
  status: ReleaseStatus;
  createdAt: string;
  sha256: string;
  md5: string;
  size: number;
}

export interface DevicePins {
  [deviceId: string]: string; // deviceId -> version
}

export interface ManifestRelease {
  version: string;
  path: string; // Relative path to ota/ directory, e.g. "smart-meter/1.0.0/firmware.bin"
  size: number;
  sha256: string;
  md5: string;
  rollout: number;
  mandatory: boolean;
  minVersion?: string;
  notes?: string;
  status: ReleaseStatus;
  publishedAt: string;
}

export interface ChannelManifest {
  project: string;
  channel: ReleaseChannel;
  chip: EspChip;
  generatedAt: string;
  release: ManifestRelease | null;
  pins: DevicePins;
}

export interface ProjectSummary {
  slug: string;
  config: ProjectConfig;
  releases: ReleaseConfig[];
  pins: DevicePins;
  latestByChannel: Record<ReleaseChannel, ReleaseConfig | null>;
}

export interface OtaIndex {
  generatedAt: string;
  version: string;
  projects: ProjectSummary[];
}
