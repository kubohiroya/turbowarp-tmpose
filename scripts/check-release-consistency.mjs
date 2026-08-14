import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
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
  !browserRuntime.includes('PoseNet 2.2.2') ||
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

const poseNetModule = await readFile('dist/posenet.js', 'utf8');
if (
  !poseNetModule.includes(`version = "${version}"`) ||
  !poseNetModule.includes('version: packageMetadata.version')
) {
  errors.push(`dist/posenet.js must embed package version ${version}`);
}

const poseNetFiles = [
  {
    path: 'model-stride16.json',
    size: 49_720,
    sha256: 'dd63bf2d3b983e8c80020749f135164beda00a33374c8a7be230b9598f24f798'
  },
  {
    path: 'group1-shard1of2.bin',
    size: 4_194_304,
    sha256: 'ce6afc62f89782d43139fab76c641b281a82dee2cd2759aa036c4b28aea16439'
  },
  {
    path: 'group1-shard2of2.bin',
    size: 838_476,
    sha256: '2a35b8cfb86eb50928931e03dc30c0972fdd375f148b177ee40676b81a17692d'
  }
];
for (const expected of poseNetFiles) {
  const path = `dist/posenet/mobilenet-v1-075-stride16/${expected.path}`;
  const bytes = await readFile(path);
  if (
    bytes.byteLength !== expected.size ||
    createHash('sha256').update(bytes).digest('hex') !== expected.sha256
  ) {
    errors.push(`${path} must match the pinned PoseNet model supply`);
  }
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
