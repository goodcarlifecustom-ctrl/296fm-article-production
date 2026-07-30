import { readFile, writeFile, rename, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as parse5 from 'parse5';

export const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
export const parseFragment = (html) => parse5.parseFragment(html);
export const serialize = (root) => `${parse5.serialize(root).replace(/\n{3,}/g, '\n\n').trim()}\n`;
export const text = (node) => !node ? '' : node.nodeName === '#text' ? node.value || '' : (node.childNodes || []).map(text).join('');
export function walk(node, callback) { callback(node); for (const child of node.childNodes || []) walk(child, callback); }
export function els(root, tagName) { const result = []; walk(root, (node) => { if (node.tagName === tagName) result.push(node); }); return result; }
export const attr = (node, name) => node.attrs?.find((item) => item.name === name)?.value || '';
export function setAttr(node, name, value) { node.attrs ||= []; const current = node.attrs.find((item) => item.name === name); if (current) current.value = value; else node.attrs.push({ name, value }); }
export const hasClass = (node, name) => (` ${attr(node, 'class')} `).includes(` ${name} `);
export function parent(root, target) { let result = null; walk(root, (node) => { if ((node.childNodes || []).includes(target)) result = node; }); return result; }
export function replace(root, target, nodes) { const owner = parent(root, target); if (!owner) return; owner.childNodes.splice(owner.childNodes.indexOf(target), 1, ...nodes); }
export function before(root, target, nodes) { const owner = parent(root, target); owner.childNodes.splice(owner.childNodes.indexOf(target), 0, ...nodes); }
export function after(root, target, nodes) { const owner = parent(root, target); owner.childNodes.splice(owner.childNodes.indexOf(target) + 1, 0, ...nodes); }
export const fragNodes = (html) => parseFragment(html).childNodes;
export const esc = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
export const escAttr = (value) => esc(value).replaceAll('"', '&quot;');
export const STANDARD_MARKER_STYLE = 'background: linear-gradient(transparent 70%, #ffff7f 0%);';
export const NEGATIVE_MARKER_STYLE = 'color: #ff0000;';
export const isIn = (root, node, predicate) => { for (let item = parent(root, node); item; item = parent(root, item)) if (predicate(item)) return true; return false; };

export async function loadDecorationConfig(dir) {
  const file = path.join(dir, 'decoration.json');
  if (!existsSync(file)) throw new Error('decoration.json がありません');
  const config = JSON.parse(await readFile(file, 'utf8'));
  if (config.enabled !== true) throw new Error('decoration.enabled が true ではありません');
  return config;
}
export async function atomicWrite(file, content) { const temporary = `${file}.tmp-${process.pid}`; await writeFile(temporary, content); await rename(temporary, file); }
export async function sourceFile(dir) { const linked = path.join(dir, 'article-linked.html'); return existsSync(linked) && (await stat(linked)).size > 0 ? linked : path.join(dir, 'article.html'); }

export function sectionNodes(root, heading) {
  const owner = parent(root, heading); const level = Number(heading.tagName.slice(1)); const result = [];
  for (const node of owner.childNodes.slice(owner.childNodes.indexOf(heading) + 1)) { if (/^h[1-6]$/.test(node.tagName || '') && Number(node.tagName.slice(1)) <= level) break; result.push(node); }
  return result;
}
export function findSection(root, section) {
  const matches = els(root, `h${section.level || 2}`).filter((heading) => section.id ? attr(heading, 'id') === section.id : text(heading).trim() === section.heading);
  if (matches.length !== 1) throw new Error(`セクションを一意に特定できません: ${JSON.stringify(section)}`);
  return matches[0];
}
export function assignHeadingIds(root) {
  const used = new Set(els(root, 'h2').concat(els(root, 'h3'), els(root, 'h4')).map((heading) => attr(heading, 'id')).filter(Boolean));
  for (const [index, h2] of els(root, 'h2').entries()) {
    if (!attr(h2, 'id')) { let id = `h2-${String(index + 1).padStart(2, '0')}`; while (used.has(id)) id += '-2'; setAttr(h2, 'id', id); used.add(id); }
    let childIndex = 0;
    for (const heading of sectionNodes(root, h2).filter((node) => node.tagName === 'h3' || node.tagName === 'h4')) if (!attr(heading, 'id')) { childIndex++; let id = `${attr(h2, 'id')}-${String(childIndex).padStart(2, '0')}`; while (used.has(id)) id += '-2'; setAttr(heading, 'id', id); used.add(id); }
  }
}

const FORBIDDEN_CLASS = /^(?:swell(?:-|$)|swl(?:-|$)|cap_box(?:_|$)|is-style-|wp-block-|has-swl-|mark_yellow$)/i;
export function removePlatformMarkup(root) {
  // Comments are editor serialization, not article content.
  walk(root, (node) => { if (node.childNodes) node.childNodes = node.childNodes.filter((child) => child.nodeName !== '#comment'); });
  // Remove only the legacy marker wrapper. Its child nodes are moved in place so
  // the article text and any pre-existing inline HTML remain unchanged.
  for (const node of [...els(root, 'span'), ...els(root, 'mark')].filter((item) => /(?:swl-marker|mark_yellow|has-swl-)/i.test(attr(item, 'class')))) {
    replace(root, node, node.childNodes || []);
  }
  // Unwrap SWELL cap boxes. Their title and body text remain, except generated navigation,
  // which is rebuilt once in the standard format below.
  for (const box of els(root, 'div').filter((item) => /(?:swell-block-|(?:^|\s)cap_box(?:\s|$))/.test(attr(item, 'class')))) {
    const titleNode = els(box, 'div').find((item) => /(?:^|\s)cap_box_ttl(?:\s|$)/.test(attr(item, 'class')));
    const title = text(titleNode).trim();
    if (/^(?:【?この記事でわかること】?|この章でわかること)$/.test(title)) { replace(root, box, []); continue; }
    const contentNode = els(box, 'div').find((item) => /(?:^|\s)cap_box_content(?:\s|$)/.test(attr(item, 'class')));
    const nodes = [...(title ? fragNodes(`<p><strong>${esc(title)}</strong></p>`) : []), ...(contentNode?.childNodes || [])];
    replace(root, box, nodes);
  }
  walk(root, (node) => {
    if (!node.attrs) return;
    const classes = attr(node, 'class').split(/\s+/).filter(Boolean).filter((name) => !FORBIDDEN_CLASS.test(name));
    node.attrs = node.attrs.filter((item) => item.name !== 'class' && !item.name.startsWith('data-generated-'));
    if (classes.length) node.attrs.push({ name: 'class', value: classes.join(' ') });
  });
}

function directSectionNodes(root, heading) {
  const nodes = sectionNodes(root, heading);
  const nextHeading = nodes.findIndex((node) => /^h[1-6]$/.test(node.tagName || ''));
  return nextHeading < 0 ? nodes : nodes.slice(0, nextHeading);
}

function markerCandidate(root, heading) {
  return directSectionNodes(root, heading).find((node) => node.tagName === 'p' && text(node).trim() && !els(node, 'a').length && !isIn(root, node, (parentNode) => ['li', 'table', 'blockquote'].includes(parentNode.tagName)));
}

export function applyConfiguredMarkers(root, markers = []) {
  for (const marker of markers) {
    if (!['positive', 'negative'].includes(marker.tone)) throw new Error(`marker toneが不正です: ${marker.tone}`);
    const heading = findSection(root, marker.section); const paragraphs = directSectionNodes(root, heading).filter((node) => node.tagName === 'p');
    const scope = Number.isInteger(marker.paragraph_index) ? [paragraphs[marker.paragraph_index]].filter(Boolean) : paragraphs;
    const matches = [];
    for (const paragraph of scope) walk(paragraph, (node) => { if (node.nodeName === '#text' && !isIn(root, node, (parentNode) => ['a', 'code', 'strong', 'em', 'span'].includes(parentNode.tagName)) && (node.value || '').includes(marker.text)) matches.push(node); });
    if (matches.length !== 1) throw new Error(`マーカー文字列を一意に特定できません: ${marker.text}`);
    const candidate = matches[0]; const value = candidate.value || ''; const offset = value.indexOf(marker.text);
    const nodes = [];
    if (offset) nodes.push(...fragNodes(esc(value.slice(0, offset))));
    const style = marker.tone === 'negative' ? NEGATIVE_MARKER_STYLE : STANDARD_MARKER_STYLE;
    nodes.push(...fragNodes(`<span style="${style}">${esc(marker.text)}</span>`));
    if (offset + marker.text.length < value.length) nodes.push(...fragNodes(esc(value.slice(offset + marker.text.length))));
    replace(root, candidate, nodes);
  }
}

function markerMatchesHeading(marker, heading) {
  const section = marker.section || {};
  if (section.id) return section.id === attr(heading, 'id');
  return Number(section.level || 2) === Number(heading.tagName.slice(1)) && section.heading === text(heading).trim();
}

function hasMarkerEligibleText(root, paragraph) {
  let found = false;
  walk(paragraph, (node) => {
    if (node.nodeName === '#text' && (node.value || '').trim() && !isIn(root, node, (parentNode) => ['a', 'code', 'strong', 'em', 'span'].includes(parentNode.tagName))) found = true;
  });
  return found;
}

export function validateMarkerCoverage(root, markers = []) {
  const errors = [];
  for (const heading of [...els(root, 'h2'), ...els(root, 'h3')]) {
    const paragraphs = directSectionNodes(root, heading).filter((node) => node.tagName === 'p' && hasMarkerEligibleText(root, node));
    if (!paragraphs.length) continue;
    const configured = markers.filter((marker) => markerMatchesHeading(marker, heading));
    if (!configured.length) errors.push(`本文がある見出しにmarker設定がありません: ${text(heading).trim()}`);
  }
  return errors;
}

export function applyConfiguredParagraphSplits(root, splits = []) {
  for (const split of splits) {
    const heading = findSection(root, split.section); const paragraphs = directSectionNodes(root, heading).filter((node) => node.tagName === 'p'); const paragraph = paragraphs[split.paragraph_index];
    if (!paragraph || (paragraph.childNodes || []).some((node) => node.nodeName !== '#text')) throw new Error(`段落分割対象を特定できません: ${JSON.stringify(split.section)}`);
    const value = text(paragraph); const boundaries = split.after || [];
    if (!Array.isArray(boundaries) || !boundaries.length) throw new Error('段落分割のafterが空です');
    const chunks = []; let start = 0;
    for (const boundary of boundaries) { const index = value.indexOf(boundary, start); if (index < 0) throw new Error(`段落分割位置が見つかりません: ${boundary}`); const end = index + boundary.length; chunks.push(value.slice(start, end)); start = end; }
    if (start < value.length) chunks.push(value.slice(start));
    replace(root, paragraph, chunks.filter((chunk) => chunk.trim()).map((chunk) => fragNodes(`<p>${esc(chunk.trim())}</p>`)[0]));
  }
}

export function insertOutline(root, title = '【この記事でわかること】') {
  const headings = els(root, 'h2'); if (!headings.length) return;
  // Remove a previous standard outline immediately before the first H2.
  const owner = parent(root, headings[0]); const index = owner.childNodes.indexOf(headings[0]);
  const meaningful = owner.childNodes.slice(0, index).filter((node) => node.nodeName !== '#text' || text(node).trim());
  for (let i = meaningful.length - 2; i >= 0; i--) if (meaningful[i].tagName === 'p' && text(meaningful[i]).trim() === title && meaningful[i + 1]?.tagName === 'ul') { replace(root, meaningful[i + 1], []); replace(root, meaningful[i], []); break; }
  const items = headings.map((heading) => `<li><a href="#${escAttr(attr(heading, 'id'))}">${esc(text(heading).trim())}</a></li>`).join('');
  before(root, headings[0], fragNodes(`<p>${esc(title)}</p><ul>${items}</ul>`));
}

export function insertSectionNavigation(root, configured = []) {
  for (const item of configured) {
    const matches = els(root, 'h2').filter((h2) => attr(h2, 'id') === item.headingId); if (matches.length !== 1) throw new Error(`H3章内リンク対象を一意に特定できません: ${item.headingId}`);
    const h2 = matches[0];
    const nodes = sectionNodes(root, h2); const h3s = nodes.filter((node) => node.tagName === 'h3'); if (!h3s.length) throw new Error(`H3章内リンク対象にH3がありません: ${item.headingId}`);
    const firstH3 = nodes.findIndex((node) => node.tagName === 'h3'); const intro = nodes.slice(0, firstH3).filter((node) => node.nodeName !== '#text' || text(node).trim());
    const links = h3s.map((h3) => `<li><a href="#${escAttr(attr(h3, 'id'))}">${esc(text(h3).trim())}</a></li>`).join('');
    const navigation = fragNodes(`<p data-decoration="section-navigation" data-heading-id="${escAttr(item.headingId)}">${esc(item.title || '【この章でわかること】')}</p><ul data-decoration="section-navigation" data-heading-id="${escAttr(item.headingId)}">${links}</ul>`);
    after(root, intro.at(-1) || h2, navigation);
  }
}

export function normalLinkSignatures(html) { return els(parseFragment(html), 'a').map((a) => ({ href: attr(a, 'href'), text: text(a).replace(/\s+/g, ' ').trim(), target: attr(a, 'target'), rel: attr(a, 'rel'), title: attr(a, 'title') })).filter((a) => /^(https?:\/\/|\/)/i.test(a.href)); }
export function validateNormalLinks(html, { requireAny = false } = {}) { const links = normalLinkSignatures(html); const errors = []; if (requireAny && !links.length) errors.push('通常リンクが存在しません'); for (const link of links) { if (!link.text) errors.push(`アンカーテキストが空の通常リンクがあります: ${link.href}`); if (/^https?:\/\/[^\s]+$/i.test(link.text)) errors.push(`URLベタ書きのアンカーテキストがあります: ${link.href}`); } return errors; }
export function compareNormalLinks(beforeHtml, afterHtml) { const before = normalLinkSignatures(beforeHtml); const after = normalLinkSignatures(afterHtml); return JSON.stringify(before) === JSON.stringify(after) ? [] : [`装飾前後で通常リンクが一致しません（before=${before.length}, after=${after.length}）`]; }
export function validateExternalLinksAgainstSources(html, sourceTexts = [], { articleSlug = '', sourceDirs = [] } = {}) { const adopted = new Set(sourceTexts.flatMap((source) => [...String(source).matchAll(/https?:\/\/[^\s)>\]]+/g)].map((match) => match[0]))); const errors = []; for (const dir of sourceDirs) if (articleSlug && !String(dir).includes(`articles/${articleSlug}`)) errors.push(`記事slugと異なるリンク資料を読み込んでいます: ${dir}`); for (const link of normalLinkSignatures(html).filter((item) => /^https?:\/\//.test(item.href))) if (!adopted.has(link.href)) errors.push(`採用資料にない外部URLがあります: ${link.href}`); return errors; }

export const FORBIDDEN_DECORATION = /<!--\s*\/?wp:|swell-block-|swl-|cap_box|is-style-|wp-block-|has-swl-|\[swell_[^\]]*\]/i;
export function validateAnchorNavigation(html) {
  const root = parseFragment(html); const errors = []; const headings = els(root, 'h2');
  for (const heading of headings.concat(els(root, 'h3'), els(root, 'h4'))) if (!attr(heading, 'id')) errors.push(`${heading.tagName.toUpperCase()} IDなし: ${text(heading).trim()}`);
  const labels = els(root, 'p').filter((node) => text(node).trim() === '【この記事でわかること】');
  if (labels.length !== 1) errors.push(`「この記事でわかること」は1回必要です: ${labels.length}件`);
  if (labels.length === 1) { const owner = parent(root, labels[0]); const list = owner.childNodes[owner.childNodes.indexOf(labels[0]) + 1]; const firstH2 = headings[0]; if (!list || list.tagName !== 'ul' || owner.childNodes.indexOf(labels[0]) > owner.childNodes.indexOf(firstH2)) errors.push('「この記事でわかること」は最初のH2直前にp/ulで配置してください'); else { const links = els(list, 'a'); if (links.length !== headings.length) errors.push('H2件数とアンカーリンク数が一致しません'); links.forEach((link, index) => { if (headings[index] && (attr(link, 'href') !== `#${attr(headings[index], 'id')}` || text(link).trim() !== text(headings[index]).trim())) errors.push('H2アンカーリンクの順序・リンク先・文言が一致しません'); }); } }
  for (const h2 of headings) {
    const h3s = sectionNodes(root, h2).filter((node) => node.tagName === 'h3'); const nodes = sectionNodes(root, h2); const labels = nodes.filter((node) => node.tagName === 'p' && attr(node, 'data-decoration') === 'section-navigation');
    if (!labels.length) continue;
    if (labels.length !== 1) { errors.push(`H3章内リンクが重複しています: ${text(h2).trim()}`); continue; }
    const owner = parent(root, labels[0]); const list = owner.childNodes[owner.childNodes.indexOf(labels[0]) + 1]; const links = list?.tagName === 'ul' ? els(list, 'a') : [];
    if (links.length !== h3s.length || links.some((link, index) => attr(link, 'href') !== `#${attr(h3s[index], 'id')}` || text(link).trim() !== text(h3s[index]).trim())) errors.push(`H3章内リンクの件数・順序・文言が一致しません: ${text(h2).trim()}`);
  }
  return errors;
}
export function validateConfiguredSectionNavigation(root, configured = []) {
  const errors = []; const labels = els(root, 'p').filter((node) => attr(node, 'data-decoration') === 'section-navigation');
  if (labels.length !== configured.length) errors.push(`H3章内リンク設定数と出力数が一致しません: ${configured.length} != ${labels.length}`);
  for (const item of configured) if (labels.filter((node) => attr(node, 'data-heading-id') === item.headingId).length !== 1) errors.push(`設定したH3章内リンクがありません: ${item.headingId}`);
  return errors;
}
export function validateStandardMarkers(root) {
  const errors = []; const allowed = new Set([STANDARD_MARKER_STYLE, NEGATIVE_MARKER_STYLE]); const markers = els(root, 'span').filter((node) => allowed.has(attr(node, 'style')) || attr(node, 'style').includes('linear-gradient') || /(?:^|;)\s*color\s*:/i.test(attr(node, 'style')));
  for (const marker of markers) {
    if (!allowed.has(attr(marker, 'style'))) errors.push('標準HTMLマーカーのstyleが不正です');
    if (!text(marker).trim()) errors.push('空の標準HTMLマーカーがあります');
    if (isIn(root, marker, (node) => ['a', 'li', 'ul', 'ol', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'h2', 'h3', 'h4'].includes(node.tagName))) errors.push('禁止箇所に標準HTMLマーカーがあります');
  }
  return errors;
}
export function validateConfiguredMarkers(root, configured = []) {
  const errors = []; const actual = els(root, 'span').filter((node) => [STANDARD_MARKER_STYLE, NEGATIVE_MARKER_STYLE].includes(attr(node, 'style')));
  if (actual.length !== configured.length) errors.push(`設定マーカー数と出力数が一致しません: ${configured.length} != ${actual.length}`);
  for (const marker of configured) {
    const style = marker.tone === 'negative' ? NEGATIVE_MARKER_STYLE : STANDARD_MARKER_STYLE;
    const matches = actual.filter((node) => attr(node, 'style') === style && text(node) === marker.text);
    if (matches.length !== 1) errors.push(`設定マーカーが出力と一致しません: ${marker.text}`);
  }
  return errors;
}
export function validateDecoratedHtml(html) { const root = parseFragment(html); const errors = [...validateAnchorNavigation(html), ...validateStandardMarkers(root)]; if (FORBIDDEN_DECORATION.test(html)) errors.push('テーマ・プラグイン固有コードまたはGutenbergブロックコードがあります'); const ids = [...html.matchAll(/\sid=["']([^"']+)["']/gi)].map((match) => match[1]); if (new Set(ids).size !== ids.length) errors.push('IDが重複しています'); const known = new Set(ids); for (const target of [...html.matchAll(/href=["']#([^"']*)["']/gi)].map((match) => match[1])) if (!target || !known.has(target)) errors.push(`不正アンカー: #${target}`); return [...new Set(errors)]; }
export function stripGeneratedText(root) { const clone = parseFragment(serialize(root)); removePlatformMarkup(clone); for (const node of [...els(clone, 'p'), ...els(clone, 'ul')].filter((item) => attr(item, 'data-decoration') === 'section-navigation')) replace(clone, node, []); const label = els(clone, 'p').find((node) => text(node).trim() === '【この記事でわかること】'); if (label) { const owner = parent(clone, label); const following = owner.childNodes.slice(owner.childNodes.indexOf(label) + 1).find((node) => node.nodeName !== '#text' || text(node).trim()); if (following?.tagName === 'ul') replace(clone, following, []); replace(clone, label, []); } return text(clone).replace(/\s+/g, ''); }

export const articleDir = (slug) => path.join('articles', slug);
export async function readDecorated(slug) { const file = path.join(articleDir(slug), 'article-decorated.html'); if (!existsSync(file)) throw new Error('article-decorated.html が存在しません'); const html = await readFile(file, 'utf8'); return { file, html, hash: sha256(html) }; }
export async function writeDecorationManifest(slug) { const { html, hash } = await readDecorated(slug); const errors = validateDecoratedHtml(html); if (errors.length) throw new Error(errors.join('\n')); const manifest = { slug, file: 'article-decorated.html', sha256: hash }; await writeFile(path.join(articleDir(slug), 'decoration-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`); return manifest; }
export async function checkDecorationManifest(slug, { requireManifest = true } = {}) { const { html, hash } = await readDecorated(slug); const errors = validateDecoratedHtml(html); const file = path.join(articleDir(slug), 'decoration-manifest.json'); if (!existsSync(file)) { if (requireManifest) errors.push('decoration-manifest.json が存在しません'); } else { const manifest = JSON.parse(await readFile(file, 'utf8')); if ((manifest.sha256 || manifest.decorated_sha256) !== hash) errors.push('装飾マニフェストとHTMLが一致しません'); } if (errors.length) throw new Error(errors.join('\n')); return { sha256: hash }; }
