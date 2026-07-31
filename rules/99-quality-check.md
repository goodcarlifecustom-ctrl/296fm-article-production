# 99 品質チェックルール

`npm run check -- --slug {slug}` で、新規記事ワークフローの成果物を検証する。

必須ファイル: `input.yml`、`metadata.json`、`research.md`、`serp.md`、`headings.csv`、`heading-analysis.md`、`heading-plan.md`、`draft.md`、`article.html`、`article-linked.html`、`article-decorated.html`、`external-links.md`。

主な検証項目:

- `target_media`、`article_type`、`main_keyword`、配列の `related_keywords`、`persona`、`article_purpose`、booleanの `post_to_wp` がある。
- `min_word_count`、`target_word_count`、`max_word_count`（互換名。日本語の可視本文文字数として扱い、metadataでは `min_char_count`、`target_char_count`、`max_char_count` も保存） が正の数値で、`min_word_count <= target_word_count <= max_word_count` を満たす。
- `metadata.json` の `title`、`slug`、`meta_description`、`search_intent`、`persona`、`article_type`、`target_word_count` が null/空/auto ではない。
- `status` は `draft`。
- `article.html`と`article-linked.html`はGutenbergブロックコメントの開始・終了が対応し、`article-decorated.html`はテーマ非依存の標準HTMLであり、いずれもH1を含まない。
- 既存ブロックの二重変換、記事全体の `wp:html` 化、Markdown見出し・リスト・画像記法・コードフェンス残存、front matter混入、タイトル重複、rendered HTML投稿を検出する。
- 装飾前HTMLに目次ショートコード、目次用nav、手動のH2/H3アンカーリンク一覧がなく、装飾後HTMLのH2一覧と設定駆動H3一覧を除いて見出しリンク一覧がなく、duplicate idとmissing targetがない。

- 記事冒頭が「結論：」「要点：」「ポイント：」などのラベルで始まっていない。
- H3直下が1段落だけで終わっていない。
- 各H3は原則2〜4段落で、「端的な回答」「理由や条件」「具体例または行動」を含む。
- H3末尾が「場合があります」「確認しましょう」だけの曖昧な促しで終わっていない。
- 100文字未満で完結する内容を独立H3にしていない。
- タイトル、スラッグ、キーワードがファイル間で一致する。
- 本文文字数が目標文字数から大きく外れていない。
- 外部URLのベタ書き、空aタグ、存在しない内部アンカー、秘密情報、コミット対象の `.env` がない。
- `post_to_wp:false` ならWordPress環境変数を要求しない。`true` なら投稿前条件を確認する。

## 標準HTML装飾の検証

- 装飾工程では最初のH2直前に `<p>【この記事でわかること】</p>` と通常の `<ul>` を1回だけ配置し、全H2へのアンカーリンクをH2順・文言一致で出力する。
- H2/H3/H4の既存IDを維持し、ない場合だけ安定IDを生成する。
- `article-decorated.html` にGutenbergブロックコメント、SWELL固有クラス・ショートコード、テーマ・プラグイン固有装飾を含めない。
- `article-linked.html`の通常本文を持つすべてのH2・H3に、意味に基づいて選ばれた`markers`設定が1件以上ある。`markers: []`や未設定見出しを完成扱いにしない。
- H3章内リンクは`h3_anchor_lists`に明示したH2だけへ生成し、設定していない章へ自動追加しない。
- `npm run decorate`と`npm run check:decoration`がPASSした後に`npm run check`を完了し、カバレッジ不足なら`markers`補完後に全検証を再実行する。
