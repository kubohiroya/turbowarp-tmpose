import {copyFile, readFile, writeFile} from 'node:fs/promises';

const packageMetadata = JSON.parse(await readFile('package.json', 'utf8'));
const noticeUrl =
  `https://github.com/kubohiroya/turbowarp-tmpose/blob/v${packageMetadata.version}/` +
  'THIRD_PARTY_NOTICES.md';
const licenseBanner =
  `/*! @license Includes TensorFlow.js 1.3.1, Teachable Machine Pose 0.8.3, ` +
  `and PoseNet 2.2.2 ` +
  `(Apache-2.0). See ${noticeUrl}. */\n`;
const runtimePath = 'dist/runtime.js';
const browserRuntime = await readFile(runtimePath, 'utf8');

if (!browserRuntime.startsWith(licenseBanner)) {
  await writeFile(runtimePath, licenseBanner + browserRuntime);
}

await copyFile('THIRD_PARTY_NOTICES.md', 'dist/THIRD_PARTY_NOTICES.md');
