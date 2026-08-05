import {execFileSync} from 'node:child_process';
import {access, cp, mkdtemp, rm, symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'tmpose-archive-'));
const archiveRoot = path.join(temporaryRoot, 'package');
const excludedTopLevel = new Set(['.git', 'dist', 'node_modules']);

try {
  await cp(repositoryRoot, archiveRoot, {
    recursive: true,
    filter(source) {
      const relative = path.relative(repositoryRoot, source);
      const topLevel = relative.split(path.sep)[0];
      return relative === '' || !excludedTopLevel.has(topLevel);
    }
  });
  await symlink(
    path.join(repositoryRoot, 'node_modules'),
    path.join(archiveRoot, 'node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir'
  );
  execFileSync('npm', ['run', 'prepack'], {
    cwd: archiveRoot,
    encoding: 'utf8',
    stdio: 'pipe'
  });
  for (const output of [
    'dist/tmpose.js',
    'dist/composition.js',
    'dist/types/composition.d.ts'
  ]) {
    await access(path.join(archiveRoot, output));
  }
} finally {
  await rm(temporaryRoot, {recursive: true, force: true});
}

console.log('GitHub archive prepack completed without repository metadata.');
