# 04 外部リンク追加ルール

記事の信頼性を高めるため、一次情報や信頼できる外部リンクを追加する。出力は `external-links.md` と `article-linked.html`。

- 国土交通省、警察庁、自治体、公式サービス情報などを優先する。
- 競合買取業者への不要な送客リンクは避ける。
- リンクテキストは自然にし、外部URLのベタ書きは避ける。
- 確認日と採用理由を `research.md` と `external-links.md` に記録する。
- `article.html`の本文、H2・H3の文言・順序・IDを維持したまま`article-linked.html`を作成する。リンク追加後に各H2・H3の直接本文を確定し、その確定版を読んで`decoration.json`の`markers`を作成する。
