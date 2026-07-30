import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadArticle } from '../scripts/wordpress-utils.mjs';
import { validateDecoratedHtml } from '../scripts/decoration-utils.mjs';

for (const slug of ['bike-kaitori-osusume', 'bike-kaitori']) {
  test(`completed decoration is standard HTML for ${slug}`, () => {
    const html = readFileSync(`articles/${slug}/article-decorated.html`, 'utf8');
    assert.deepEqual(validateDecoratedHtml(html), []);
    assert.match(html, /<p>【この記事でわかること】<\/p><ul>/);
    assert.match(html, /<h2\b/);
    assert.doesNotMatch(html, /<!--\s*\/?wp:|swell-block-|swl-|cap_box|is-style-|wp-block-/i);
  });
}

test('WordPress payload source is exactly standard article-decorated.html content', async () => {
  const slug = 'bike-kaitori-osusume';
  const decorated = readFileSync(`articles/${slug}/article-decorated.html`, 'utf8').replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '').trimStart();
  const article = await loadArticle(slug);
  assert.equal(article.source, `articles/${slug}/article-decorated.html`);
  assert.equal(article.content, decorated);
  assert.doesNotMatch(article.content, /^---/m);
  assert.doesNotMatch(article.content, /<!--\s*wp:/);
});
