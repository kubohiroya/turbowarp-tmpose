import {readFile} from 'node:fs/promises';
import process from 'node:process';

const packageMetadata = JSON.parse(await readFile('package.json', 'utf8'));
const version = packageMetadata.version;
const runtimeVersion = `${version}-typescript`;
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
  if (!source.includes(runtimeVersion)) {
    errors.push(`${path} must contain runtime version ${runtimeVersion}`);
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
