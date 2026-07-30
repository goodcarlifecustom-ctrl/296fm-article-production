# バイク買取MAX 新規記事作成プロンプト

## 最小入力テンプレート

```yaml
main_keyword:
【メインキーワード】

related_keywords:
【関連キーワードをカンマ区切り、またはYAML配列で入力】

wordpress_draft:
true
```

## 標準ワークフロー

Codexは3項目を受け取ったら、同じタスク内で以下を順番に実行する。

1. AGENTS.mdとrulesを読む
2. 入力を正規化する
3. slugを決める
4. `npm run create` を実行
5. キーワード分析
6. `npm run extract` を実行
7. `research.md` を作成
8. 見出し構成を作成
9. H2・H3へ一意のIDを付けた`article.html`を作成
10. IDと本文を維持して外部リンクを追加し、`article-linked.html`を作成
11. Codex自身が各H2・H3から次の見出しまでの直接本文を読み、各対象見出しの最重要箇所を意味に基づいて選ぶ
12. 選択した箇所を`decoration.json`の`markers`へ記入し、必要に応じて`paragraph_splits`と`h3_anchor_lists`も記入
13. `npm run decorate -- --slug {slug}`を実行
14. `npm run check:decoration -- --slug {slug}`を実行し、カバレッジ不足なら指摘された見出しの`markers`を補完して13から再実行
15. `metadata.json`を完成させ、`npm test`を実行
16. `npm run check -- --slug {slug}`を実行し、すべてPASSした場合だけ完了処理へ進む
17. 必要に応じて`npm run finish -- --slug {slug}`を使う。ただし`finish`は意味選定や`markers`補完を行わないため、12までの完了後に限る
18. `post_to_wp: true`の場合だけWordPress下書き処理と`wp-result.md`を確認
19. 全検証PASS後に最終報告

各工程を別タスクへ分けない。記事作成とWordPress投稿は同じCodexタスク内で完了させる。

`npm run create`が生成する`markers: []`は雛形であり、装飾完了を意味しない。Node.jsへ意味選定を委ねたり、先頭文を一律に選んだりせず、Codexが記事本文の主張・推奨・注意・リスクを読んでpositive/negativeを判断する。

## 入力仕様

必須:

- `main_keyword`: 必須文字列。既存互換で `keyword` も可。
- `related_keywords`: 必須。YAML配列またはカンマ区切り文字列。
- `wordpress_draft`: 任意boolean。省略時 `true`。内部で `post_to_wp` へ正規化する。

任意上書き:

- `title`
- `slug`
- `target_word_count`
- `category`
- `target_media`
- `reference_urls`
- `notes`
- `post_to_wp`（後方互換。`wordpress_draft` が優先）

未入力項目はキーワード分析、競合調査、一次情報確認に基づいてCodexが自動生成する。

## 絶対条件

- WordPress投稿ステータスは常に `draft`。
- `wordpress_draft:false` または `post_to_wp:false` が明示された場合はWordPressへ接続しない。
- `.env` を作成せず、認証情報の実値を表示・保存しない。
- 競合調査に失敗した場合、架空の上位サイトや見出しを作らない。
- `article.html`、`heading-plan.md`、`article-decorated.html` にH1を入れない。
