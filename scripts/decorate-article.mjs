import path from 'node:path';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { argvValue } from './workflow-utils.mjs';
import { applyConfiguredMarkers, applyConfiguredParagraphSplits, assignHeadingIds, atomicWrite, compareNormalLinks, els, insertOutline, insertSectionNavigation, loadDecorationConfig, parseFragment, removePlatformMarkup, serialize, sha256, sourceFile, validateDecoratedHtml, validateNormalLinks } from './decoration-utils.mjs';

const DEFAULT_DECORATION = { version: 2, enabled: true, outline: { enabled: true, title: '【この記事でわかること】' }, h3_anchor_lists: [], markers: [], paragraph_splits: [] };
async function configFor(dir) { return existsSync(path.join(dir, 'decoration.json')) ? loadDecorationConfig(dir) : structuredClone(DEFAULT_DECORATION); }

export async function decorate(slug) {
  const dir = path.join('articles', slug); const config = await configFor(dir); const source = await sourceFile(dir); const sourceHtml = await readFile(source, 'utf8'); const root = parseFragment(sourceHtml);
  removePlatformMarkup(root); assignHeadingIds(root); applyConfiguredParagraphSplits(root, config.paragraph_splits || []); applyConfiguredMarkers(root, config.markers || []);
  if (!els(root, 'h2').length) throw new Error('H2がありません');
  if (config.outline?.enabled === false) throw new Error('outline.enabled は false にできません');
  insertOutline(root, config.outline?.title || '【この記事でわかること】');
  insertSectionNavigation(root, config.h3_anchor_lists || []);
  const output = serialize(root); const errors = [...validateDecoratedHtml(output), ...validateNormalLinks(output), ...compareNormalLinks(sourceHtml, output)];
  if (errors.length) throw new Error(errors.join('\n'));
  await writeFile(path.join(dir, 'decoration.json'), `${JSON.stringify(config, null, 2)}\n`);
  await writeFile(path.join(dir, 'decoration-manifest.json'), `${JSON.stringify({ version: 2, source_file: path.basename(source), source_sha256: sha256(sourceHtml), decorated_sha256: sha256(output), format: 'standard-html' }, null, 2)}\n`);
  await atomicWrite(path.join(dir, 'article-decorated.html'), output); console.log(`Decorated ${slug} as standard HTML`);
}
const slug = argvValue(process.argv, 'slug'); if (!slug) { console.error('Usage: npm run decorate -- --slug <slug>'); process.exit(1); } decorate(slug).catch((error) => { console.error(error.message); process.exit(1); });
