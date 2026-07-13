import {readFile, writeFile} from 'node:fs/promises';

const start = '<!-- BEGIN GENERATED BLOCKS -->';
const end = '<!-- END GENERATED BLOCKS -->';
const definitions = JSON.parse(await readFile('src/block-definitions.json', 'utf8'));
const readme = await readFile('README.md', 'utf8');

const lines = [start, ''];
for (const block of definitions.blocks) {
  lines.push(`### \`${block.text}\``, '', block.description, '');
  lines.push('| Property | Value |', '|---|---|');
  lines.push(`| Type | ${block.blockType} |`);
  lines.push(`| Opcode | \`${block.opcode}\` |`);
  for (const [name, argument] of Object.entries(block.arguments ?? {})) {
    const details = [argument.type];
    if ('defaultValue' in argument) details.push(`default: \`${String(argument.defaultValue).replaceAll('\n', '\\n')}\``);
    if (argument.menu) details.push(`menu: \`${argument.menu}\``);
    lines.push(`| \`${name}\` | ${details.join(', ')} |`);
  }
  lines.push('');
}
lines.push(end);

const startIndex = readme.indexOf(start);
const endIndex = readme.indexOf(end);
if (startIndex < 0 || endIndex < 0 || endIndex < startIndex) {
  throw new Error('README generation markers are missing or invalid.');
}

const updated = readme.slice(0, startIndex) + lines.join('\n') + readme.slice(endIndex + end.length);
await writeFile('README.md', updated);
