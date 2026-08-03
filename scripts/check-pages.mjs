import {access, readFile, readdir} from 'node:fs/promises';
import {dirname, join, normalize, relative, resolve} from 'node:path';

const docsRoot = resolve('docs');
const htmlFiles = [];

async function collectHtmlFiles(directory) {
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collectHtmlFiles(path);
    else if (entry.name.endsWith('.html')) htmlFiles.push(path);
  }
}

function localReferences(html) {
  return [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((reference) => !reference.startsWith('#'))
    .filter((reference) => !/^(?:https?:|mailto:|data:)/.test(reference));
}

function resolveReference(pagePath, reference) {
  const pathOnly = decodeURIComponent(reference.split(/[?#]/, 1)[0]);
  const target = pathOnly.startsWith('/')
    ? join(docsRoot, pathOnly.replace(/^\/turbowarp-tmpose\/?/, ''))
    : resolve(dirname(pagePath), pathOnly);
  return target.endsWith('/') ? join(target, 'index.html') : target;
}

await collectHtmlFiles(docsRoot);

const errors = [];
for (const pagePath of htmlFiles) {
  const html = await readFile(pagePath, 'utf8');
  for (const reference of localReferences(html)) {
    const target = normalize(resolveReference(pagePath, reference));
    if (!target.startsWith(docsRoot)) {
      errors.push(`${relative('.', pagePath)}: reference escapes docs/: ${reference}`);
      continue;
    }
    try {
      await access(target);
    } catch {
      errors.push(`${relative('.', pagePath)}: missing ${reference}`);
    }
  }
}

for (const required of ['docs/index.html', 'docs/ja/index.html', 'docs/.nojekyll']) {
  try {
    await access(required);
  } catch {
    errors.push(`missing required Pages file: ${required}`);
  }
}

if (errors.length > 0) {
  throw new Error(`GitHub Pages validation failed:\n${errors.join('\n')}`);
}

console.log(`Validated ${htmlFiles.length} HTML pages and their local assets.`);
