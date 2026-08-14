import {readFile} from 'node:fs/promises';
import process from 'node:process';

const packageMetadata = JSON.parse(await readFile('package.json', 'utf8'));
const version = packageMetadata.version;
const pinnedPackage = `@kubohiroya/turbowarp-tmpose@${version}`;
const errors = [];

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  errors.push(`package.json contains an invalid version: ${version}`);
}

const readme = await readFile('README.md', 'utf8');
if (readme.split(pinnedPackage).length - 1 < 2) {
  errors.push(`README.md must contain version-pinned install and CDN examples for ${pinnedPackage}`);
}

for (const path of ['docs/index.html', 'docs/ja/index.html']) {
  const source = await readFile(path, 'utf8');
  if (source.split(`v${version}`).length - 1 !== 1 || !source.includes(`TMPose ${version}`)) {
    errors.push(`${path} must expose version ${version} in the badge and accessible brand label`);
  }
}

for (const path of ['dist/tmpose.js', 'dist/composition.js']) {
  const source = await readFile(path, 'utf8');
  if (!source.includes(`version = "${version}"`)) {
    errors.push(`${path} must embed package version ${version}`);
  }
  if (!source.includes('packageMetadata.version}-typescript')) {
    errors.push(`${path} must derive the runtime version from package metadata`);
  }
}

const browserRuntime = await readFile('dist/runtime.js', 'utf8');
if (!browserRuntime.includes(`version:"${version}"`)) {
  errors.push(`dist/runtime.js must embed package version ${version}`);
}
if (
  !browserRuntime.startsWith('/*! @license Includes TensorFlow.js 1.3.1') ||
  !browserRuntime.includes(`/blob/v${version}/THIRD_PARTY_NOTICES.md`)
) {
  errors.push('dist/runtime.js must retain the versioned third-party license notice');
}
if (
  browserRuntime.split(' has already been set. Overwriting the platform with ').length - 1 !== 1 ||
  browserRuntime.split(' backend was already registered. Reusing existing backend factory.').length -
    1 !==
    1
) {
  errors.push('dist/runtime.js must contain one TensorFlow.js browser platform and WebGL backend');
}

const notices = await readFile('THIRD_PARTY_NOTICES.md', 'utf8');
const distributedNotices = await readFile('dist/THIRD_PARTY_NOTICES.md', 'utf8');
if (notices !== distributedNotices) {
  errors.push('dist/THIRD_PARTY_NOTICES.md must match the repository notice');
}

if (process.env.GITHUB_REF_TYPE === 'tag') {
  const expectedTag = `v${version}`;
  if (process.env.GITHUB_REF_NAME !== expectedTag) {
    errors.push(`release tag ${process.env.GITHUB_REF_NAME ?? '<missing>'} must equal ${expectedTag}`);
  }
}

if (errors.length > 0) {
  throw new Error(`Release consistency check failed:\n- ${errors.join('\n- ')}`);
}

process.stdout.write(`Release metadata is aligned with ${version}.\n`);
