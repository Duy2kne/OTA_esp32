/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { calculateMd5, calculateRolloutSlot, calculateSha256 } from '../src/lib/crypto-utils.ts';
import type { EspChip, ReleaseConfig } from '../src/lib/ota-types.ts';
import {
  CHIP_ID_MAP,
  compareSemver,
  generateChannelManifest,
  isValidSemver,
  parseEspBinaryHeader,
  pickLatestReleaseForChannel,
  validateReleaseBinary,
} from '../src/lib/ota-validator.ts';

function createMockBinary(chip: EspChip, magic = 0xe9, customLen = 64): Uint8Array {
  const chipId = CHIP_ID_MAP[chip];
  const buf = new Uint8Array(customLen);
  buf[0] = magic;
  buf[1] = 0x03;
  buf[2] = 0x02;
  buf[3] = 0x10;
  // chip ID at 12..13
  buf[12] = chipId & 0xff;
  buf[13] = (chipId >> 8) & 0xff;
  for (let i = 16; i < customLen; i++) {
    buf[i] = (i * 7) & 0xff;
  }
  return buf;
}

describe('Semver validation and comparison', () => {
  it('validates semver strings correctly', () => {
    expect(isValidSemver('1.0.0')).toBe(true);
    expect(isValidSemver('v1.2.3')).toBe(true);
    expect(isValidSemver('2.0.0-beta.1')).toBe(true);
    expect(isValidSemver('1.0.0+build123')).toBe(true);
    expect(isValidSemver('invalid')).toBe(false);
    expect(isValidSemver('1.0')).toBe(false);
    expect(isValidSemver('1.0.0.0')).toBe(false);
  });

  it('compares versions accurately', () => {
    expect(compareSemver('1.2.0', '1.1.9')).toBeGreaterThan(0);
    expect(compareSemver('1.0.0', '2.0.0')).toBeLessThan(0);
    expect(compareSemver('1.1.0', '1.1.0-beta.1')).toBeGreaterThan(0); // Stable > Prerelease
    expect(compareSemver('1.1.0-beta.2', '1.1.0-beta.1')).toBeGreaterThan(0);
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
  });
});

describe('ESP32 Image Header Parser', () => {
  it('parses valid ESP32-C3 header', () => {
    const bin = createMockBinary('esp32c3');
    const header = parseEspBinaryHeader(bin);

    expect(header.isValidMagic).toBe(true);
    expect(header.magic).toBe(0xe9);
    expect(header.chipId).toBe(5);
    expect(header.chipName).toContain('ESP32-C3');
  });

  it('fails or flags invalid magic byte', () => {
    const bin = createMockBinary('esp32', 0x55);
    const header = parseEspBinaryHeader(bin);
    expect(header.isValidMagic).toBe(false);
  });
});

describe('Release Binary Validation', () => {
  it('passes validation when checksums, size, chip, and semver match', async () => {
    const bin = createMockBinary('esp32c3');
    const sha256 = await calculateSha256(bin);
    const md5 = calculateMd5(bin);

    const release: ReleaseConfig = {
      version: '1.4.2',
      channel: 'stable',
      notes: 'Initial stable release',
      rollout: 100,
      mandatory: false,
      status: 'active',
      createdAt: new Date().toISOString(),
      sha256,
      md5,
      size: bin.length,
    };

    const res = await validateReleaseBinary(bin, release, 'esp32c3');
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it('fails validation when chip ID does not match expected chip', async () => {
    const bin = createMockBinary('esp32s3'); // Built for S3
    const sha256 = await calculateSha256(bin);
    const md5 = calculateMd5(bin);

    const release: ReleaseConfig = {
      version: '1.4.2',
      channel: 'stable',
      notes: 'Release',
      rollout: 100,
      mandatory: false,
      status: 'active',
      createdAt: new Date().toISOString(),
      sha256,
      md5,
      size: bin.length,
    };

    // Project expects esp32c3
    const res = await validateReleaseBinary(bin, release, 'esp32c3');
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('Chip ID'))).toBe(true);
  });

  it('fails validation on wrong sha256 or md5', async () => {
    const bin = createMockBinary('esp32');
    const md5 = calculateMd5(bin);

    const release: ReleaseConfig = {
      version: '1.0.0',
      channel: 'stable',
      notes: 'Release',
      rollout: 100,
      mandatory: false,
      status: 'active',
      createdAt: new Date().toISOString(),
      sha256: 'deadbeef00000000000000000000000000000000000000000000000000000000',
      md5,
      size: bin.length,
    };

    const res = await validateReleaseBinary(bin, release, 'esp32');
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('SHA-256 không khớp'))).toBe(true);
  });
});

describe('Manifest Channel Selection', () => {
  it('selects latest active release and ignores paused/revoked releases', () => {
    const releases: ReleaseConfig[] = [
      {
        version: '1.0.0',
        channel: 'stable',
        notes: 'v1.0.0',
        rollout: 100,
        mandatory: false,
        status: 'active',
        createdAt: '2026-01-01T00:00:00Z',
        sha256: 'aaa',
        md5: 'bbb',
        size: 1000,
      },
      {
        version: '1.1.0',
        channel: 'stable',
        notes: 'v1.1.0 paused',
        rollout: 100,
        mandatory: false,
        status: 'paused', // Paused! Should not be picked
        createdAt: '2026-02-01T00:00:00Z',
        sha256: 'ccc',
        md5: 'ddd',
        size: 1050,
      },
      {
        version: '1.0.1',
        channel: 'stable',
        notes: 'v1.0.1 hotfix active',
        rollout: 100,
        mandatory: false,
        status: 'active',
        createdAt: '2026-01-15T00:00:00Z',
        sha256: 'eee',
        md5: 'fff',
        size: 1020,
      },
    ];

    const latest = pickLatestReleaseForChannel(releases, 'stable');
    expect(latest).not.toBeNull();
    expect(latest?.version).toBe('1.0.1'); // Highest active version
  });

  it('generates relative path in manifest', () => {
    const releases: ReleaseConfig[] = [
      {
        version: '2.0.0',
        channel: 'stable',
        notes: 'Release 2.0.0',
        rollout: 100,
        mandatory: true,
        status: 'active',
        createdAt: '2026-03-01T00:00:00Z',
        sha256: '123',
        md5: '456',
        size: 2048,
      },
    ];

    const manifest = generateChannelManifest('my-sensor', { name: 'Sensor', description: '', chip: 'esp32', channels: ['stable'] }, 'stable', releases, {
      'DEVICE_TEST_01': '2.0.0'
    });

    expect(manifest.release).not.toBeNull();
    expect(manifest.release?.path).toBe('my-sensor/2.0.0/firmware.bin');
    expect(manifest.pins['DEVICE_TEST_01']).toBe('2.0.0');
  });
});

describe('Rollout calculation hashing', () => {
  it('hashes deterministically within 0-99 range', () => {
    const slot1 = calculateRolloutSlot('MAC_24:0A:C4:00:11:22', '1.0.0');
    const slot2 = calculateRolloutSlot('MAC_24:0A:C4:00:11:22', '1.0.0');
    expect(slot1).toBe(slot2);
    expect(slot1).toBeGreaterThanOrEqual(0);
    expect(slot1).toBeLessThan(100);

    // Different device gets deterministic slot
    const slotOther = calculateRolloutSlot('MAC_24:0A:C4:00:99:88', '1.0.0');
    expect(slotOther).toBeGreaterThanOrEqual(0);
    expect(slotOther).toBeLessThan(100);
  });
});
