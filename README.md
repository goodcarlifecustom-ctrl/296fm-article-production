# バイク買取MAX 新規記事作成ワークフロー

新規SEO記事をHTMLで作成し、必要な場合だけWordPress下書き投稿まで進めるためのワークフローです。装飾結果はテーマやプラグインに依存しない標準HTMLです。

対象メディア: https://poi-poi.co.jp/bike/

## 必須入力項目

- `target_media`: 対象メディア。必須。
- `article_type`: 記事タイプ。必須。
- `main_keyword`: メインキーワード。必須。
- `related_keywords`: 関連キーワード。YAML配列またはカンマ区切り文字列。必須。
- `persona`: 想定読者。必須。
- `article_purpose`: 記事の目的。必須。
- `min_word_count`: 最低文字数。必須、数値。
- `target_word_count`: 目標文字数。必須、数値。
- `max_word_count`: 上限文字数。必須、数値。
- `wordpress_draft`: WordPress下書き投稿まで行うか。省略時は `true`。

`status` はユーザー入力ではなくワークフローが常に `draft` を自動設定します。入力された場合も `draft` 以外は拒否します。

文字数は `min_word_count <= target_word_count <= max_word_count` を満たす必要があります。未入力、数字以外、大小関係不正の場合は記事ディレクトリ作成前に停止します。

`wordpress_draft` は「WordPressへ下書き同期するか」を表すユーザー向けフラグです。`post_to_wp` は後方互換の内部フラグで同じ意味です。両方を指定する場合は同じboolean値でなければ停止します。WordPressへ送信する場合もREST payloadの `status` は必ず `draft` です。

## 任意の上書き項目

`title`、`slug`、`category`、`reference_urls`、`notes` は任意です。通常は入力不要で、Codexがキーワード分析と調査に基づいて自動生成します。

## 記事ファイルだけ作成

```yaml
main_keyword:
ネオクラシックバイク おすすめ

related_keywords:
ネオクラシックバイク 初心者, ネオクラシックバイク 400cc, ネオクラシックバイク 比較

target_media: "https://poi-poi.co.jp/bike/"
article_type: "比較"
persona: "ネオクラシックバイク選びで迷っている初心者"
article_purpose: "候補の比較軸と選び方を理解してもらう"
min_word_count: 3000
target_word_count: 4000
max_word_count: 5000
wordpress_draft:
false
```

## WordPress下書きまで作成

```yaml
main_keyword:
CTN バイク買取 評判

related_keywords:
CTN バイク買取 口コミ, CTN バイク買取 査定, CTN バイク買取 一括査定

target_media: "https://poi-poi.co.jp/bike/"
article_type: "評判"
persona: "バイク一括査定サービスの利用を検討している人"
article_purpose: "評判の見方と申し込み前の注意点を理解してもらう"
min_word_count: 3000
target_word_count: 4000
max_word_count: 5000
wordpress_draft:
true
```

## npmコマンド

```bash
npm run create -- --input jobs/sample-new-article.yml
npm run create -- --main-keyword "CTN バイク買取 評判" --related-keywords "CTN バイク買取 口コミ,CTN バイク買取 査定" --target-media "https://poi-poi.co.jp/bike/" --article-type "評判" --persona "売却検討者" --article-purpose "評判の判断材料を示す" --min-word-count 3000 --target-word-count 4000 --max-word-count 5000 --wordpress-draft true
npm run extract -- --slug ctn-bike-kaitori-reviews
npm test
npm run check -- --slug ctn-bike-kaitori-reviews
```

`npm run check` は品質チェックがPASSした後、`post_to_wp: true` の記事だけ `npm run check:decoration`、`npm run wp:doctor`、`npm run wp:draft` を自動実行します。再実行や手動完了には同じ順序を実行する `npm run finish -- --slug <slug>` も使えます。`post_to_wp:false` の記事ではWordPress環境変数を要求せず、ネットワーク接続もしません。

## 通常の記事生成入口

Codexによる通常生成の入口は`AGENTS.md`と`prompt.md`です。Codexはそこから`rules/00`〜`rules/05`、`rules/99`を順番に読みます。`npm run create`はディレクトリと雛形を作るだけで、本文や意味に基づくマーカーを自動生成しません。

通常作業は、`article.html`作成、`article-linked.html`作成、H2・H3 ID確認、直接本文の読解、`markers`作成、必要な`paragraph_splits`・`h3_anchor_lists`作成、`npm run decorate`、`npm run check:decoration`、`npm run check`の順です。`npm run finish`はこれらの意味選定を代行せず、完成済み設定を使ってdecorate以降を再実行する完了処理です。

## 出力ファイルの役割

- `input.yml`: 正規化済み入力。`status: draft`、`wordpress_draft`、`post_to_wp`、対象メディア、文字数設定を含む。
- `metadata.json`: タイトル、スラッグ、メタディスクリプション、検索意図、WordPress下書きID/URLなどの機械可読メタデータ。
- `research.md`: キーワード分析、競合調査、一次情報、選定基準、リンク一覧、未確認事項。
- `serp.md`: 検索クエリ、参考URL、除外URL、抽出見出し概要。
- `headings.csv`: 競合ページのH2/H3抽出結果。
- `heading-analysis.md`: 共通論点、採用/不採用理由、見出し構成根拠。
- `heading-plan.md`: H2/H3/H4のみのHTML見出し構成。H1は禁止。
- `draft.md`: 作業用Markdown。WordPress送信用本文ではありません。
- `article.html`: Gutenbergブロックマークアップ本文。H1は禁止。
- `article-linked.html`: 外部リンク追加後のGutenbergブロックマークアップ本文。
- `article-decorated.html`: テーマ非依存の標準HTMLで装飾した本文。front matter除去後にWordPress投稿対象。
- `external-links.md`: 外部リンク候補、採用理由、確認日。
- `check-report.md`: 品質チェック結果。
- `wp-result.md`: WordPress下書き投稿成功時の結果。

## WordPress投稿の安全条件

WordPress投稿は必ず `draft` です。`wordpress_draft:false` / `post_to_wp:false` のサンプルジョブでは投稿処理を行いません。送信する `content` は `article-decorated.html` からfront matterを除去した標準HTMLで、作業ログ、metadata、Markdown原稿、rendered HTMLは含めません。環境変数は `WP_SITE_URL` または `WP_REST_ROOT`、`WP_USERNAME`、`WP_APPLICATION_PASSWORD` または後方互換の `WP_APP_PASSWORD` をプロセス環境変数から読み、`.env` は必須にしません。投稿前にRESTルートGET、認証確認、作成権限確認、同一スラッグ重複確認、品質チェックを行います。既存投稿の更新・削除、別スラッグ投稿、公開投稿は行いません。

## 標準HTML装飾フロー

新規記事では `decoration.json` を生成し、`article-linked.html`（なければ `article.html`）から `article-decorated.html` を冪等に生成します。装飾結果にはSWELL・Gutenberg固有コードを含めず、`post_to_wp: false`（files_only）の場合はWordPressへ接続しません。

```bash
npm run decorate -- --slug <slug>
npm run check:decoration -- --slug <slug>
```

装飾処理では、H2/H3/H4の安定ID、最初のH2直前のH2リンク一覧、`h3_anchor_lists`で明示した章だけのH3リンク一覧、`decoration.json`で明示したpositive/negativeマーカーと意味境界での段落分割、`decoration-manifest.json` を生成・検証します。見出し数を条件に章内リンクを自動生成したり、先頭文を機械的に強調したり、文字数だけで段落を分割したりしません。

本文を持つH2・H3には見出し単位で`markers`設定が必要です。新規作成直後の空配列は設定前の状態を表し、本文完成後も`markers: []`のままでは`decorate`と`check:decoration`をPASSできません。
