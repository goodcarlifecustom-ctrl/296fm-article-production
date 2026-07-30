import path from 'node:path';
import { existsSync } from 'node:fs';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { argvValue } from './workflow-utils.mjs';
import { assignHeadingIds, compareNormalLinks, loadDecorationConfig, parseFragment, removePlatformMarkup, sha256, sourceFile, stripGeneratedText, validateConfiguredMarkers, validateConfiguredSectionNavigation, validateDecoratedHtml, validateMarkerCoverage, validateNormalLinks } from './decoration-utils.mjs';

export async function checkDecoration(slug) {
  const dir = path.join('articles', slug); const details = []; let ok = true; const fail = (message) => { ok = false; details.push(`NG: ${message}`); }; const pass = (message) => details.push(`OK: ${message}`);
  const decoratedFile = path.join(dir, 'article-decorated.html'); let html = '';
  if (!existsSync(decoratedFile) || (await stat(decoratedFile)).size === 0) fail('article-decorated.htmlがありません'); else html = await readFile(decoratedFile, 'utf8');
  let config = {}; try { config = await loadDecorationConfig(dir); if (config.version !== 2) fail('decoration.jsonのversionは2である必要があります'); else pass('標準HTML装飾設定を確認'); } catch (error) { fail(error.message); }
  if (/<h1\b/i.test(html)) fail('H1があります'); else pass('H1なし');
  for (const error of validateDecoratedHtml(html)) fail(error);
  for (const error of validateConfiguredMarkers(parseFragment(html), config.markers || [])) fail(error);
  for (const error of validateConfiguredSectionNavigation(parseFragment(html), config.h3_anchor_lists || [])) fail(error);
  if (ok) pass('標準HTML、H2アンカー一覧、IDを確認');
  try {
    const source = await sourceFile(dir); const sourceHtml = await readFile(source, 'utf8'); const sourceRoot = parseFragment(sourceHtml); removePlatformMarkup(sourceRoot); assignHeadingIds(sourceRoot); for (const error of validateMarkerCoverage(sourceRoot, config.markers || [])) fail(error);
    if (stripGeneratedText(parseFragment(sourceHtml)) !== stripGeneratedText(parseFragment(html))) fail('装飾前後の本文テキスト不一致'); else pass('本文テキスト整合');
    const linkErrors = [...validateNormalLinks(sourceHtml), ...validateNormalLinks(html), ...compareNormalLinks(sourceHtml, html)]; if (linkErrors.length) linkErrors.forEach(fail); else pass('装飾前後の通常リンク保持を確認');
    const manifest = JSON.parse(await readFile(path.join(dir, 'decoration-manifest.json'), 'utf8')); if (manifest.format !== 'standard-html' || manifest.decorated_sha256 !== sha256(html)) fail('装飾マニフェストが出力と一致しません'); else pass('装飾マニフェストを確認');
  } catch (error) { fail(error.message); }
  const nextAction = ok ? '' : '\n## 原因と次アクション\n\n上記のNG項目が原因です。装飾元の本文・見出しを無断変更せず、該当する入力成果物または装飾処理を修正してから、装飾生成と検証を再実行してください。\n';
  const report = `# 装飾チェックレポート\n\n- slug: ${slug}\n- result: ${ok ? 'PASS' : 'FAIL'}\n\n## 詳細\n\n${details.map((item) => `- ${item}`).join('\n')}\n${nextAction}`; await writeFile(path.join(dir, 'check-report.md'), report); console.log(report); if (!ok) throw new Error('decoration check failed');
}
const slug = argvValue(process.argv, 'slug'); if (!slug) { console.error('Usage: npm run check:decoration -- --slug <slug>'); process.exit(1); } checkDecoration(slug).catch(() => process.exit(1));
