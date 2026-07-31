import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

function npm(args) {
  return execFileSync('npm', args, { encoding: 'utf8', stdio: 'pipe' });
}

test('new articles require complete per-heading marker coverage without overwriting prior outputs', () => {
  const slug = `marker-coverage-${process.pid}-${Date.now()}`;
  const dir = `articles/${slug}`;
  mkdirSync(dir, { recursive: true });

  try {
    const source = [
      '<h2 id="first">最初の章</h2>',
      '<p>最初の章で推奨する内容です。</p>',
      '<h3 id="first-detail">料金の注意点</h3>',
      '<p><strong>月額料金を確認してください。</strong>追加料金や自動更新に注意が必要です。</p>',
      '<h2 id="second">次の章</h2>',
      '<p>次の章で確認する内容です。</p>',
    ].join('\n');

    writeFileSync(`${dir}/article.html`, source);
    writeFileSync(`${dir}/article-linked.html`, source);
    writeFileSync(`${dir}/decoration.json`, `${JSON.stringify({
      version: 2,
      enabled: true,
      outline: { enabled: true, title: '【この記事でわかること】' },
      markers: [],
      paragraph_splits: [],
      h3_anchor_lists: [],
    }, null, 2)}\n`);

    const sentinelHtml = '既存の装飾成果物\n';
    const sentinelManifest = '{"sentinel":true}\n';
    writeFileSync(`${dir}/article-decorated.html`, sentinelHtml);
    writeFileSync(`${dir}/decoration-manifest.json`, sentinelManifest);

    assert.throws(
      () => npm(['run', 'decorate', '--', '--slug', slug]),
      /本文がある見出しにmarker設定がありません/,
    );
    assert.equal(readFileSync(`${dir}/article-decorated.html`, 'utf8'), sentinelHtml);
    assert.equal(readFileSync(`${dir}/decoration-manifest.json`, 'utf8'), sentinelManifest);

    const config = {
      version: 2,
      enabled: true,
      outline: { enabled: true, title: '【この記事でわかること】' },
      markers: [
        { section: { level: 2, id: 'first' }, paragraph_index: 0, tone: 'positive', text: '最初の章で推奨する内容です。' },
        { section: { level: 3, id: 'first-detail' }, paragraph_index: 0, tone: 'negative', text: '追加料金や自動更新に注意が必要です。' },
        { section: { level: 2, id: 'second' }, paragraph_index: 0, tone: 'positive', text: '次の章で確認する内容です。' },
      ],
      paragraph_splits: [],
      h3_anchor_lists: [],
    };
    writeFileSync(`${dir}/decoration.json`, `${JSON.stringify(config, null, 2)}\n`);

    npm(['run', 'decorate', '--', '--slug', slug]);
    npm(['run', 'check:decoration', '--', '--slug', slug]);
    const firstHtml = readFileSync(`${dir}/article-decorated.html`, 'utf8');
    const firstManifest = readFileSync(`${dir}/decoration-manifest.json`, 'utf8');

    assert.equal((firstHtml.match(/#ffff7f/g) || []).length, 2);
    assert.equal((firstHtml.match(/color: #ff0000;/g) || []).length, 1);
    assert.match(firstHtml, /<strong>月額料金を確認してください。<\/strong><span style="color: #ff0000;">追加料金や自動更新に注意が必要です。<\/span>/);

    npm(['run', 'decorate', '--', '--slug', slug]);
    assert.equal(readFileSync(`${dir}/article-decorated.html`, 'utf8'), firstHtml);
    assert.equal(readFileSync(`${dir}/decoration-manifest.json`, 'utf8'), firstManifest);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
