#!/usr/bin/env node
/**
 * Downloads optional assets listed in public/assets/manifest.json.
 *   npm run fetch-assets            download missing entries with a url or repo
 *   npm run fetch-assets -- --check list what is present / missing
 * Model packs are fetched as GitHub repository archives (zip) and unpacked with the system `unzip`.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = 'public/assets';
const manifest = JSON.parse(await (await import('node:fs/promises')).readFile(join(root, 'manifest.json'), 'utf8'));
const check = process.argv.includes('--check');
for (const e of manifest.entries) {
  const target = join(root, e.file);
  const present = existsSync(target);
  if (check || present) { console.log(`${present ? 'ok     ' : 'missing'} ${e.id} -> ${e.file} (${e.license})`); continue; }
  try {
    if (e.repo) {
      const zip = join(root, `${e.id}.zip`); mkdirSync(target, { recursive: true });
      const res = await fetch(`https://codeload.github.com/${e.repo}/zip/refs/heads/main`); if (!res.ok) throw new Error(`HTTP ${res.status}`);
      writeFileSync(zip, Buffer.from(await res.arrayBuffer())); execFileSync('unzip', ['-q', '-o', zip, '-d', target]); console.log(`fetched ${e.id}`);
    } else if (e.url) {
      mkdirSync(dirname(target), { recursive: true });
      const res = await fetch(e.url); if (!res.ok) throw new Error(`HTTP ${res.status}`);
      writeFileSync(target, Buffer.from(await res.arrayBuffer())); console.log(`fetched ${e.id}`);
    } else console.log(`skip    ${e.id}: no url set (drop the file at ${target} manually)`);
  } catch (err) { console.warn(`failed  ${e.id}: ${err.message}`); }
}
