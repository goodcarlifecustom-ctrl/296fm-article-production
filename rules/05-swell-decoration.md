# 05 標準HTML装飾

`npm run decorate -- --slug <slug>` で `article-linked.html`（なければ `article.html`）から `article-decorated.html` を生成する。ファイル名は互換性のため維持するが、SWELL、Gutenberg、WordPressテーマ、プラグインには依存しない。

## 必須ルール

- 記事全体の最初のH2直前に `<p>【この記事でわかること】</p>` と `<ul>` を1回だけ置き、全H2へのリンクを見出し順・見出し文言どおりに並べる。
- H2/H3/H4の既存IDを維持し、IDがない見出しにだけ安定したIDを付ける。
- 既存のSWELLマーカーはラッパーだけを除去し、内側の本文と既存インラインHTMLをそのまま残す。マーカーを `<strong>` など別の強調要素へ置換しない。
- マーカーは `decoration.json` の `markers` に明示された文字列だけへ適用する。先頭文や最初の適用可能文を機械的に選ばない。positiveは `<span style="background: linear-gradient(transparent 70%, #ffff7f 0%);">…</span>`、negativeは `<span style="color: #ff0000;">…</span>` とし、リンク、見出し、リスト、表には適用しない。
- `article-linked.html`（なければ`article.html`）の各H2・H3から次の見出しまでにマーカー適用可能な通常本文がある場合、その見出しを対象とする`markers`設定を1件以上必須とする。`markers: []`のまま装飾を完成扱いにしない。
- 段落分割は `paragraph_splits` に意味上の境界となる文末を明示した場合だけ行う。文字数だけで機械分割せず、本文の文言と順序を変えない。
- H3章内リンクは `decoration.json` の `h3_anchor_lists` に `headingId`を明示したH2だけへ生成する。H3件数による自動生成は禁止し、生成対象ではH3順・文言・リンク先を検証する。
- 既存capboxはタイトルを通常の段落、内容を通常のリストや段落として残す。ただし旧式の自動アンカー一覧は削除し、必須のH2一覧だけを再生成する。
- 装飾元、見出し文言・順序、通常リンク、表、FAQ、メタデータを変更しない。
- 毎回装飾前ソースから生成し、同じ処理を繰り返しても結果を変えない。

## 禁止コード

装飾結果には `<!-- wp:... -->`、`swell-block-*`、`swl-*`、`cap_box`、`is-style-*`、`wp-block-*`、SWELL専用マーカー、ショートコードを含めない。標準の `<p>`、`<ul>`、`<ol>`、`<li>`、`<a>`、`<span>`、`<strong>`、`<h2>`、`<h3>`、`<h4>`、`<table>` などを使う。

## 設定と検証

`npm run create`直後の`decoration.json`は雛形であり、`markers: []`は未完成を表す。`article-linked.html`完成後、Codexが次を順番に行う。

1. H2・H3の一意なIDを確認する。
2. 各H2・H3から次の見出しまでの直接本文を読む。
3. 通常本文がある各見出しから、主張、推奨行動、判断基準、注意、リスクのうち最重要箇所を1件以上選ぶ。
4. 推奨・利点・重要判断は`positive`、注意・制約・リスクは`negative`として、見出しID、段落位置、本文と完全一致する文字列を`markers`へ記入する。
5. 意味上分ける必要がある段落だけ`paragraph_splits`へ、章内リンクが必要なH2だけ`h3_anchor_lists`へ記入する。
6. `npm run decorate -- --slug <slug>`、続けて`npm run check:decoration -- --slug <slug>`を実行する。
7. カバレッジ不足で失敗した場合は、エラーに示された見出し本文をCodexが読み直して`markers`を補完し、両コマンドを再実行する。

先頭文の自動採用、キーワード一致だけのtone判定、Node.jsによる意味選定は禁止する。装飾検証では固有コード、アウトライン、ID、設定マーカーと出力の一致、見出し単位のカバレッジ、本文・通常リンクの保持、マニフェスト、H1禁止を確認する。`files_only` / `post_to_wp: false`では投稿処理を行わない。
