/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  DevicePins,
  OtaIndex,
  ProjectConfig,
  ProjectSummary,
  ReleaseChannel,
  ReleaseConfig,
} from '../src/lib/ota-types.ts';
import {
  generateChannelManifest,
  pickLatestReleaseForChannel,
  validateReleaseBinary,
} from '../src/lib/ota-validator.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const firmwareDir = path.join(rootDir, 'firmware');
const publicOtaDir = path.join(rootDir, 'public', 'ota');

async function runBuild() {
  console.log('⚡ [OTA Builder] Bắt đầu duyệt và kiểm tra thư mục firmware...');

  if (!fs.existsSync(firmwareDir)) {
    console.warn('⚠️ [OTA Builder] Thư mục firmware/ chưa tồn tại. Tạo thư mục rỗng...');
    fs.mkdirSync(firmwareDir, { recursive: true });
  }

  // Ensure clean target directory
  if (fs.existsSync(publicOtaDir)) {
    fs.rmSync(publicOtaDir, { recursive: true, force: true });
  }
  fs.mkdirSync(publicOtaDir, { recursive: true });

  const projectDirs = fs
    .readdirSync(firmwareDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  if (projectDirs.length === 0) {
    console.log('ℹ️ [OTA Builder] Không tìm thấy dự án firmware nào trong firmware/');
  }

  const projectSummaries: ProjectSummary[] = [];

  for (const slug of projectDirs) {
    const projectPath = path.join(firmwareDir, slug);
    const projectJsonPath = path.join(projectPath, 'project.json');

    if (!fs.existsSync(projectJsonPath)) {
      console.error(`❌ [LỖI] Dự án '${slug}' thiếu file project.json`);
      process.exit(1);
    }

    let projectConfig: ProjectConfig;
    try {
      projectConfig = JSON.parse(fs.readFileSync(projectJsonPath, 'utf-8'));
    } catch (e: any) {
      console.error(`❌ [LỖI] File project.json của '${slug}' bị lỗi cú pháp JSON: ${e.message}`);
      process.exit(1);
    }

    // Read optional pins.json
    const pinsPath = path.join(projectPath, 'pins.json');
    let pins: DevicePins = {};
    if (fs.existsSync(pinsPath)) {
      try {
        pins = JSON.parse(fs.readFileSync(pinsPath, 'utf-8'));
      } catch (e: any) {
        console.error(`❌ [LỖI] File pins.json của '${slug}' bị lỗi cú pháp JSON: ${e.message}`);
        process.exit(1);
      }
    }

    const releasesDir = path.join(projectPath, 'releases');
    const releases: ReleaseConfig[] = [];
    const seenVersions = new Set<string>();

    if (fs.existsSync(releasesDir)) {
      const versionDirs = fs
        .readdirSync(releasesDir, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);

      for (const version of versionDirs) {
        if (seenVersions.has(version)) {
          console.error(`❌ [LỖI] Trùng lặp phiên bản '${version}' trong dự án '${slug}'`);
          process.exit(1);
        }
        seenVersions.add(version);

        const versionPath = path.join(releasesDir, version);
        const releaseJsonPath = path.join(versionPath, 'release.json');
        const binPath = path.join(versionPath, 'firmware.bin');

        if (!fs.existsSync(releaseJsonPath)) {
          console.error(`❌ [LỖI] Dự án '${slug}' phiên bản '${version}' thiếu file release.json`);
          process.exit(1);
        }

        if (!fs.existsSync(binPath)) {
          console.error(`❌ [LỖI] Dự án '${slug}' phiên bản '${version}' thiếu file firmware.bin`);
          process.exit(1);
        }

        let releaseConfig: ReleaseConfig;
        try {
          releaseConfig = JSON.parse(fs.readFileSync(releaseJsonPath, 'utf-8'));
        } catch (e: any) {
          console.error(
            `❌ [LỖI] release.json của '${slug}@${version}' bị lỗi cú pháp JSON: ${e.message}`
          );
          process.exit(1);
        }

        if (releaseConfig.version !== version) {
          console.error(
            `❌ [LỖI] Version trong thư mục ('${version}') không khớp version trong release.json ('${releaseConfig.version}') của '${slug}'`
          );
          process.exit(1);
        }

        // Read binary and validate
        const binBuffer = fs.readFileSync(binPath);
        const binBytes = new Uint8Array(binBuffer);

        console.log(`🔍 Đang kiểm tra binary: ${slug} @ ${version}...`);
        const validation = await validateReleaseBinary(binBytes, releaseConfig, projectConfig.chip);

        if (!validation.valid) {
          console.error(`❌ [LỖI KIỂM ĐỊNH] Phát hiện lỗi tại ${slug}@${version}:`);
          for (const err of validation.errors) {
            console.error(`   - ${err}`);
          }
          process.exit(1);
        }

        releases.push(releaseConfig);

        // Copy binary to public/ota/<slug>/<version>/firmware.bin
        const targetBinDir = path.join(publicOtaDir, slug, version);
        fs.mkdirSync(targetBinDir, { recursive: true });
        fs.copyFileSync(binPath, path.join(targetBinDir, 'firmware.bin'));
      }
    }

    // Determine latest release per channel
    const channels = projectConfig.channels || ['stable', 'beta'];
    const latestByChannel: Record<ReleaseChannel, ReleaseConfig | null> = {
      stable: null,
      beta: null,
    };

    for (const ch of channels) {
      latestByChannel[ch] = pickLatestReleaseForChannel(releases, ch);

      // Generate ota/<slug>/<channel>.json
      const manifest = generateChannelManifest(slug, projectConfig, ch, releases, pins);
      const manifestTargetDir = path.join(publicOtaDir, slug);
      fs.mkdirSync(manifestTargetDir, { recursive: true });
      fs.writeFileSync(
        path.join(manifestTargetDir, `${ch}.json`),
        JSON.stringify(manifest, null, 2),
        'utf-8'
      );
    }

    projectSummaries.push({
      slug,
      config: projectConfig,
      releases,
      pins,
      latestByChannel,
    });

    console.log(
      `✅ Dự án '${slug}' (${projectConfig.chip}): ${releases.length} releases, channels: [${channels.join(', ')}]`
    );
  }

  // Generate ota/index.json
  const otaIndex: OtaIndex = {
    generatedAt: new Date().toISOString(),
    version: '1.0.0',
    projects: projectSummaries,
  };

  fs.writeFileSync(
    path.join(publicOtaDir, 'index.json'),
    JSON.stringify(otaIndex, null, 2),
    'utf-8'
  );

  console.log(
    `🎉 [OTA Builder Hoàn Tất] Đã sinh manifests và copy binaries vào public/ota/ thành công.`
  );
}

runBuild().catch((err) => {
  console.error('❌ [OTA Builder Fatal Error]:', err);
  process.exit(1);
});
