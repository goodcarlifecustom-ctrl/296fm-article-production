import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { compareNormalLinks, parseFragment, stripGeneratedText, validateDecoratedHtml, validateExternalLinksAgainstSources, validateNormalLinks } from '../scripts/decoration-utils.mjs';

const fixture = 'test/fixtures/decoration-article';
const run = (args) => execFileSync('npm', args, { encoding: 'utf8', stdio: 'pipe' });
function prepare(slug) { rmSync(`articles/${slug}`, { recursive: true, force: true }); mkdirSync(`articles/${slug}`, { recursive: true }); cpSync(fixture, `articles/${slug}`, { recursive: true }); }

test('decoration emits idempotent, platform-independent standard HTML', () => {
  const slug = 'standard-decoration-fixture'; prepare(slug);
  try {
    const source = readFileSync(`articles/${slug}/article.html`, 'utf8');
    run(['run', 'decorate', '--', '--slug', slug]); const first = readFileSync(`articles/${slug}/article-decorated.html`, 'utf8');
    run(['run', 'decorate', '--', '--slug', slug]); const second = readFileSync(`articles/${slug}/article-decorated.html`, 'utf8');
    assert.equal(first, second); assert.equal(readFileSync(`articles/${slug}/article.html`, 'utf8'), source);
    assert.match(first, /<p>【この記事でわかること】<\/p>\s*<ul><li><a href="#h2-01">/);
    assert.match(first, /<span style="background: linear-gradient\(transparent 70%, #ffff7f 0%\);">/);
    assert.match(first, /<span style="color: #ff0000;">/);
    assert.match(first, /<strong>査定条件<\/strong>/);
    assert.doesNotMatch(first, /<!--\s*\/?wp:|swell-block-|swl-|cap_box|is-style-|wp-block-|has-swl-/i);
    assert.deepEqual(validateDecoratedHtml(first), []);
    run(['run', 'check:decoration', '--', '--slug', slug]);
  } finally { rmSync(`articles/${slug}`, { recursive: true, force: true }); }
});

test('existing SWELL boxes and markers retain text while becoming standard HTML', () => {
  const slug = 'legacy-swell-fixture'; prepare(slug);
  try {
    writeFileSync(`articles/${slug}/article.html`, '<!-- wp:paragraph --><p><span class="swl-marker mark_yellow">導入の重要点です。</span></p><!-- /wp:paragraph --><!-- wp:loos/cap-block --><div class="swell-block-capbox cap_box"><div class="cap_box_ttl"><span>確認事項</span></div><div class="cap_box_content"><ul class="wp-block-list"><li>本文項目</li></ul></div></div><!-- /wp:loos/cap-block --><h2>見出し</h2><p>本文です。</p>');
    writeFileSync(`articles/${slug}/decoration.json`, JSON.stringify({ version: 2, enabled: true, outline: { enabled: true, title: '【この記事でわかること】' }, markers: [{ section: { level: 2, heading: '見出し' }, tone: 'positive', text: '本文です。' }], paragraph_splits: [] }));
    rmSync(`articles/${slug}/article-linked.html`, { force: true });
    run(['run', 'decorate', '--', '--slug', slug]); const html = readFileSync(`articles/${slug}/article-decorated.html`, 'utf8');
    assert.match(html, /<span style="background: linear-gradient\(transparent 70%, #ffff7f 0%\);">本文です。<\/span>/); assert.doesNotMatch(html, /<strong>導入の重要点です。<\/strong>/); assert.match(html, /<p><strong>確認事項<\/strong><\/p>/); assert.match(html, /<li>本文項目<\/li>/);
    assert.doesNotMatch(html, /<!--\s*\/?wp:|swell|swl-|cap_box|wp-block-/i);
  } finally { rmSync(`articles/${slug}`, { recursive: true, force: true }); }
});

test('validation rejects proprietary markup and malformed outline', () => {
  assert.match(validateDecoratedHtml('<p>【この記事でわかること】</p><ul></ul><h2 id="a" class="wp-block-heading">見出し</h2>').join('\n'), /テーマ・プラグイン固有/);
  assert.match(validateDecoratedHtml('<h2 id="a">見出し</h2>').join('\n'), /1回必要/);
});

test('only configured positive and negative markers are emitted', () => {
  const slug = 'configured-marker-fixture'; prepare(slug);
  try {
    writeFileSync(`articles/${slug}/article.html`, '<h2>判断基準</h2><p>推奨できる条件です。注意が必要な条件です。指定外の文章です。</p>');
    writeFileSync(`articles/${slug}/decoration.json`, JSON.stringify({ version: 2, enabled: true, outline: { enabled: true, title: '【この記事でわかること】' }, markers: [{ section: { level: 2, heading: '判断基準' }, tone: 'positive', text: '推奨できる条件です。' }, { section: { level: 2, heading: '判断基準' }, tone: 'negative', text: '注意が必要な条件です。' }], paragraph_splits: [] }));
    rmSync(`articles/${slug}/article-linked.html`, { force: true }); run(['run', 'decorate', '--', '--slug', slug]);
    const html = readFileSync(`articles/${slug}/article-decorated.html`, 'utf8');
    assert.match(html, /#ffff7f 0%\);">推奨できる条件です。<\/span>/); assert.match(html, /style="color: #ff0000;">注意が必要な条件です。<\/span>/);
    assert.match(html, /<\/span>指定外の文章です。/); assert.equal((html.match(/<span style=/g) || []).length, 2);
  } finally { rmSync(`articles/${slug}`, { recursive: true, force: true }); }
});

test('H3 navigation is generated only for configured H2 IDs', () => {
  const slug = 'configured-h3-navigation-fixture'; prepare(slug);
  try {
    const html = '<h2 id="without-list">一覧なし</h2><h3 id="a">A</h3><h3 id="b">B</h3><h3 id="c">C</h3><h2 id="with-list">一覧あり</h2><h3 id="d">D</h3>';
    writeFileSync(`articles/${slug}/article.html`, html); writeFileSync(`articles/${slug}/decoration.json`, JSON.stringify({ version: 2, enabled: true, outline: { enabled: true, title: '【この記事でわかること】' }, h3_anchor_lists: [{ headingId: 'with-list' }], markers: [], paragraph_splits: [] }));
    rmSync(`articles/${slug}/article-linked.html`, { force: true }); run(['run', 'decorate', '--', '--slug', slug]);
    const output = readFileSync(`articles/${slug}/article-decorated.html`, 'utf8'); assert.equal((output.match(/data-decoration="section-navigation"/g) || []).length, 2); assert.match(output, /data-heading-id="with-list"/); assert.doesNotMatch(output, /data-heading-id="without-list"/);
  } finally { rmSync(`articles/${slug}`, { recursive: true, force: true }); }
});

test('decoration splits a long plain paragraph without changing its text', () => {
  const slug = 'paragraph-split-fixture'; prepare(slug);
  try {
    const first = `最初の説明です。${'重要な条件を具体的に確認します。'.repeat(10)}`;
    const second = `${'次の手順を落ち着いて確認します。'.repeat(10)}`;
    writeFileSync(`articles/${slug}/article.html`, `<h2>長文の確認</h2><p>${first}${second}</p>`);
    writeFileSync(`articles/${slug}/decoration.json`, JSON.stringify({ version: 2, enabled: true, outline: { enabled: true, title: '【この記事でわかること】' }, markers: [{ section: { level: 2, heading: '長文の確認' }, paragraph_index: 0, tone: 'positive', text: '最初の説明です。' }], paragraph_splits: [{ section: { level: 2, heading: '長文の確認' }, paragraph_index: 0, after: [first] }] }));
    rmSync(`articles/${slug}/article-linked.html`, { force: true });
    run(['run', 'decorate', '--', '--slug', slug]);
    const html = readFileSync(`articles/${slug}/article-decorated.html`, 'utf8');
    assert.ok((html.match(/<p>/g) || []).length >= 3);
    assert.equal(stripGeneratedText(parseFragment(html)), stripGeneratedText(parseFragment(`<h2>長文の確認</h2><p>${first}${second}</p>`)));
  } finally { rmSync(`articles/${slug}`, { recursive: true, force: true }); }
});

test('new article requires complete marker coverage, preserves prior outputs on failure, and decorates idempotently', () => {
  const slug = 'new-article-marker-coverage-e2e'; rmSync(`articles/${slug}`, { recursive: true, force: true });
  try {
    run(['run', 'create', '--', '--main-keyword', '新規記事 マーカー', '--related-keywords', '新規記事 装飾', '--target-media', 'https://poi-poi.co.jp/bike/', '--article-type', 'テスト', '--persona', '検証担当者', '--article-purpose', '装飾カバレッジを検証する', '--min-word-count', '50', '--target-word-count', '100', '--max-word-count', '1000', '--wordpress-draft', 'false', '--slug', slug]);
    const dir = `articles/${slug}`; const source = '<h2 id="first">最初の章</h2><p>最初の章で推奨する内容です。</p><h3 id="first-detail">最初の詳細</h3><p>詳細で注意する内容です。</p><h2 id="second">次の章</h2><p>次の章で確認する内容です。</p>';
    writeFileSync(`${dir}/article.html`, source); writeFileSync(`${dir}/article-linked.html`, source);
    const initialConfig = readFileSync(`${dir}/decoration.json`, 'utf8'); assert.deepEqual(JSON.parse(initialConfig).markers, []);
    const previousHtml = '既存の装飾成果物\n'; const previousManifest = '{"sentinel":true}\n'; writeFileSync(`${dir}/article-decorated.html`, previousHtml); writeFileSync(`${dir}/decoration-manifest.json`, previousManifest);
    assert.throws(() => run(['run', 'decorate', '--', '--slug', slug]), /本文がある見出しにmarker設定がありません/);
    assert.equal(readFileSync(`${dir}/article-decorated.html`, 'utf8'), previousHtml); assert.equal(readFileSync(`${dir}/decoration-manifest.json`, 'utf8'), previousManifest); assert.equal(readFileSync(`${dir}/decoration.json`, 'utf8'), initialConfig);
    const config = JSON.parse(initialConfig); config.markers = [
      { section: { level: 2, id: 'first' }, paragraph_index: 0, tone: 'positive', text: '最初の章で推奨する内容です。' },
      { section: { level: 3, id: 'first-detail' }, paragraph_index: 0, tone: 'negative', text: '詳細で注意する内容です。' },
      { section: { level: 2, id: 'second' }, paragraph_index: 0, tone: 'positive', text: '次の章で確認する内容です。' },
    ]; writeFileSync(`${dir}/decoration.json`, JSON.stringify(config, null, 2) + '\n');
    run(['run', 'decorate', '--', '--slug', slug]); run(['run', 'check:decoration', '--', '--slug', slug]);
    const firstHtml = readFileSync(`${dir}/article-decorated.html`, 'utf8'); const firstManifest = readFileSync(`${dir}/decoration-manifest.json`, 'utf8');
    assert.equal((firstHtml.match(/#ffff7f/g) || []).length, 2); assert.equal((firstHtml.match(/color: #ff0000;/g) || []).length, 1);
    run(['run', 'decorate', '--', '--slug', slug]); assert.equal(readFileSync(`${dir}/article-decorated.html`, 'utf8'), firstHtml); assert.equal(readFileSync(`${dir}/decoration-manifest.json`, 'utf8'), firstManifest);
  } finally { rmSync(`articles/${slug}`, { recursive: true, force: true }); }
});

test('normal link parity and source validation remain available', () => {
  const html = '<p><a href="https://example.com/info">公式情報</a></p>'; assert.deepEqual(compareNormalLinks(html, html), []); assert.deepEqual(validateNormalLinks(html), []);
  assert.deepEqual(validateExternalLinksAgainstSources(html, ['https://example.com/info'], { articleSlug: 'sample', sourceDirs: ['articles/sample/research.md'] }), []);
});
