/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateMd5, calculateSha256 } from '../src/lib/crypto-utils.ts';
import { CHIP_ID_MAP } from '../src/lib/ota-validator.ts';
import type { EspChip, ProjectConfig, ReleaseConfig } from '../src/lib/ota-types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const firmwareDir = path.join(rootDir, 'firmware');

function createMockEspBinary(chip: EspChip, payloadText: string): Uint8Array {
  const chipId = CHIP_ID_MAP[chip];
  const payloadBytes = Buffer.from(payloadText, 'utf-8');
  const totalLength = 128 + payloadBytes.length;
  const buffer = Buffer.alloc(totalLength);

  // ESP Image Header
  buffer[0] = 0xe9; // Magic byte
  buffer[1] = 0x03; // Segment count
  buffer[2] = 0x02; // SPI mode (DIO)
  buffer[3] = 0x10; // SPI size/freq (4MB, 40MHz)

  // Entry point (0x40380000)
  buffer.writeUInt32LE(0x40380000, 4);

  // Chip ID at offset 12..13 (uint16_t LE)
  buffer.writeUInt16LE(chipId, 12);

  // Fill some header info
  buffer.write('ESP_OTA_HEADER_V1', 16, 'ascii');

  // Write payload
  payloadBytes.copy(buffer, 64);

  return new Uint8Array(buffer);
}

async function createRelease(
  projectSlug: string,
  chip: EspChip,
  version: string,
  channel: 'stable' | 'beta',
  notes: string,
  rollout: number,
  mandatory: boolean,
  status: 'active' | 'paused' | 'revoked',
  minVersion?: string
) {
  const releaseDir = path.join(firmwareDir, projectSlug, 'releases', version);
  fs.mkdirSync(releaseDir, { recursive: true });

  const payload = `FIRMWARE_APP=${projectSlug};VERSION=${version};CHIP=${chip};CHANNEL=${channel};BUILD_DATE=${new Date().toISOString()};PAYLOAD_TEST_DATA=OK`;
  const binBytes = createMockEspBinary(chip, payload);
  const sha256 = await calculateSha256(binBytes);
  const md5 = calculateMd5(binBytes);

  fs.writeFileSync(path.join(releaseDir, 'firmware.bin'), Buffer.from(binBytes));

  const releaseJson: ReleaseConfig = {
    version,
    channel,
    notes,
    rollout,
    mandatory,
    minVersion,
    status,
    createdAt: new Date().toISOString(),
    sha256,
    md5,
    size: binBytes.length,
  };

  fs.writeFileSync(
    path.join(releaseDir, 'release.json'),
    JSON.stringify(releaseJson, null, 2),
    'utf-8'
  );
}

async function main() {
  console.log('Generating sample firmware projects...');

  // 1. Smart Meter (ESP32-C3)
  const c3Slug = 'smart-meter-c3';
  const c3Dir = path.join(firmwareDir, c3Slug);
  fs.mkdirSync(c3Dir, { recursive: true });

  const c3Project: ProjectConfig = {
    name: 'Đồng Hồ Đo Năng Lượng Smart Meter',
    description: 'Thiết bị đo công suất, dòng áp kWh truyền dữ liệu qua MQTT và WiFi',
    chip: 'esp32c3',
    channels: ['stable', 'beta'],
  };
  fs.writeFileSync(path.join(c3Dir, 'project.json'), JSON.stringify(c3Project, null, 2), 'utf-8');

  // Pins for C3
  const c3Pins = {
    'C3_TEST_LAB_01': '1.1.0-beta.1',
    '84:F7:03:1A:2B:3C': '1.0.0',
  };
  fs.writeFileSync(path.join(c3Dir, 'pins.json'), JSON.stringify(c3Pins, null, 2), 'utf-8');

  await createRelease(
    c3Slug,
    'esp32c3',
    '1.0.0',
    'stable',
    'Bản phát hành đầu tiên: giám sát điện áp, dòng điện và cos phi',
    100,
    false,
    'active'
  );

  await createRelease(
    c3Slug,
    'esp32c3',
    '1.1.0-beta.1',
    'beta',
    'Thử nghiệm giao thức MQTT over TLS và tính năng bù sai số nhiệt độ',
    50,
    false,
    'active'
  );

  // 2. Weather Station (ESP32-S3)
  const s3Slug = 'weather-station-s3';
  const s3Dir = path.join(firmwareDir, s3Slug);
  fs.mkdirSync(s3Dir, { recursive: true });

  const s3Project: ProjectConfig = {
    name: 'Trạm Quan Trắc Không Khí S3',
    description: 'Cảm biến PM2.5, CO2, nhiệt độ độ ẩm với màn hình e-Paper và pin năng lượng',
    chip: 'esp32s3',
    channels: ['stable', 'beta'],
  };
  fs.writeFileSync(path.join(s3Dir, 'project.json'), JSON.stringify(s3Project, null, 2), 'utf-8');

  await createRelease(
    s3Slug,
    'esp32s3',
    '2.0.0',
    'stable',
    'Nâng cấp giao diện hiển thị E-Paper, tối ưu hóa deep sleep giảm 40% pin',
    100,
    true,
    'active',
    '1.0.0'
  );

  console.log('Sample projects generated successfully!');
}

main().catch(console.error);
