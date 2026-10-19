/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { calculateMd5, calculateSha256 } from './crypto-utils.ts';
import type {
  ChannelManifest,
  DevicePins,
  EspChip,
  ManifestRelease,
  ProjectConfig,
  ProjectSummary,
  ReleaseChannel,
  ReleaseConfig,
} from './ota-types.ts';

export const ESP_IMAGE_MAGIC = 0xe9;

export const CHIP_ID_MAP: Record<EspChip, number> = {
  esp32: 0,
  esp32c3: 5,
  esp32s3: 9,
};

export const CHIP_NAME_MAP: Record<number, string> = {
  0: 'ESP32 (Original)',
  2: 'ESP32-S2',
  5: 'ESP32-C3',
  9: 'ESP32-S3',
  12: 'ESP32-C2',
  13: 'ESP32-C6',
  16: 'ESP32-H2',
};

// Strict semver parser matching standard SemVer 2.0.0
const SEMVER_REGEX =
  /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

export function isValidSemver(v: string): boolean {
  return SEMVER_REGEX.test(v.trim());
}

export interface ParsedSemver {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
  raw: string;
}

export function parseSemver(v: string): ParsedSemver | null {
  const match = v.trim().match(SEMVER_REGEX);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4],
    build: match[5],
    raw: v.trim(),
  };
}

/**
 * Compare two semver strings:
 * Returns > 0 if a > b, < 0 if a < b, 0 if equal
 */
export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return a.localeCompare(b);

  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  if (pa.patch !== pb.patch) return pa.patch - pb.patch;

  // Prerelease comparison: non-prerelease has higher precedence than prerelease
  if (!pa.prerelease && pb.prerelease) return 1;
  if (pa.prerelease && !pb.prerelease) return -1;
  if (!pa.prerelease && !pb.prerelease) return 0;

  // Compare prerelease identifiers
  const partsA = (pa.prerelease || '').split('.');
  const partsB = (pb.prerelease || '').split('.');
  const maxLen = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < maxLen; i++) {
    const partA = partsA[i];
    const partB = partsB[i];

    if (partA === undefined) return -1;
    if (partB === undefined) return 1;

    const numA = parseInt(partA, 10);
    const numB = parseInt(partB, 10);
    const isNumA = !isNaN(numA) && numA.toString() === partA;
    const isNumB = !isNaN(numB) && numB.toString() === partB;

    if (isNumA && isNumB) {
      if (numA !== numB) return numA - numB;
    } else if (isNumA && !isNumB) {
      return -1;
    } else if (!isNumA && isNumB) {
      return 1;
    } else {
      if (partA !== partB) return partA.localeCompare(partB);
    }
  }

  return 0;
}

export interface BinaryHeaderInfo {
  magic: number;
  segments: number;
  spiMode: number;
  spiSpeedSize: number;
  entryAddress: number;
  chipId: number;
  chipName: string;
  size: number;
  isValidMagic: boolean;
}

export function parseEspBinaryHeader(bytes: Uint8Array): BinaryHeaderInfo {
  if (bytes.length < 16) {
    throw new Error(`File binary quá nhỏ (${bytes.length} bytes), tối thiểu 16 bytes cho ESP image header`);
  }

  const magic = bytes[0];
  const segments = bytes[1];
  const spiMode = bytes[2];
  const spiSpeedSize = bytes[3];
  const entryAddress = (bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24)) >>> 0;
  const chipId = bytes[12] | (bytes[13] << 8);

  const chipName = CHIP_NAME_MAP[chipId] || `Unknown Chip (ID: 0x${chipId.toString(16).padStart(4, '0')})`;

  return {
    magic,
    segments,
    spiMode,
    spiSpeedSize,
    entryAddress,
    chipId,
    chipName,
    size: bytes.length,
    isValidMagic: magic === ESP_IMAGE_MAGIC,
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  computed?: {
    sha256: string;
    md5: string;
    size: number;
    header: BinaryHeaderInfo;
  };
}

export async function validateReleaseBinary(
  bytes: Uint8Array,
  release: ReleaseConfig,
  expectedChip: EspChip
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Semver check
  if (!isValidSemver(release.version)) {
    errors.push(`Phiên bản '${release.version}' không đúng chuẩn SemVer 2.0 (ví dụ: 1.0.0, 1.2.3-beta.1)`);
  }

  // 2. Binary Header check
  let header: BinaryHeaderInfo;
  try {
    header = parseEspBinaryHeader(bytes);
  } catch (err: any) {
    return {
      valid: false,
      errors: [err.message || 'Không thể đọc header binary'],
      warnings,
    };
  }

  if (!header.isValidMagic) {
    errors.push(
      `Byte đầu tiên của .bin là 0x${header.magic.toString(16).toUpperCase()} (phải là 0xE9 theo chuẩn ESP-IDF / Arduino ESP32)`
    );
  }

  const expectedChipId = CHIP_ID_MAP[expectedChip];
  if (header.chipId !== expectedChipId) {
    errors.push(
      `Chip ID trong header (0x${header.chipId.toString(16)} - ${header.chipName}) không khớp với cấu hình dự án '${expectedChip}' (yêu cầu chip ID: 0x${expectedChipId.toString(16)})`
    );
  }

  // 3. Size check
  if (bytes.length !== release.size) {
    errors.push(`Kích thước file không khớp: thực tế ${bytes.length} bytes, trong release.json ghi ${release.size} bytes`);
  }

  // 4. SHA-256 and MD5 check
  const actualSha256 = await calculateSha256(bytes);
  if (actualSha256.toLowerCase() !== release.sha256.toLowerCase().trim()) {
    errors.push(
      `SHA-256 không khớp: file thực tế '${actualSha256}', release.json khai báo '${release.sha256}'`
    );
  }

  const actualMd5 = calculateMd5(bytes);
  if (actualMd5.toLowerCase() !== release.md5.toLowerCase().trim()) {
    errors.push(`MD5 không khớp: file thực tế '${actualMd5}', release.json khai báo '${release.md5}'`);
  }

  // 5. Rollout check
  if (typeof release.rollout !== 'number' || release.rollout < 0 || release.rollout > 100) {
    errors.push(`Tỉ lệ rollout (${release.rollout}) không hợp lệ, phải nằm trong khoảng 0 đến 100`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    computed: {
      sha256: actualSha256,
      md5: actualMd5,
      size: bytes.length,
      header,
    },
  };
}

export function pickLatestReleaseForChannel(
  releases: ReleaseConfig[],
  channel: ReleaseChannel
): ReleaseConfig | null {
  const activeReleases = releases.filter(
    (r) => r.channel === channel && r.status === 'active'
  );

  if (activeReleases.length === 0) return null;

  // Sort descending by semver
  activeReleases.sort((a, b) => compareSemver(b.version, a.version));

  return activeReleases[0];
}

export function generateChannelManifest(
  slug: string,
  projectConfig: ProjectConfig,
  channel: ReleaseChannel,
  releases: ReleaseConfig[],
  pins: DevicePins = {}
): ChannelManifest {
  const latestRelease = pickLatestReleaseForChannel(releases, channel);

  let manifestRelease: ManifestRelease | null = null;
  if (latestRelease) {
    manifestRelease = {
      version: latestRelease.version,
      path: `${slug}/${latestRelease.version}/firmware.bin`,
      size: latestRelease.size,
      sha256: latestRelease.sha256,
      md5: latestRelease.md5,
      rollout: latestRelease.rollout,
      mandatory: latestRelease.mandatory,
      minVersion: latestRelease.minVersion,
      notes: latestRelease.notes,
      status: latestRelease.status,
      publishedAt: latestRelease.createdAt,
    };
  }

  return {
    project: slug,
    channel,
    chip: projectConfig.chip,
    generatedAt: new Date().toISOString(),
    release: manifestRelease,
    pins: pins || {},
  };
}
