# 最小デモ

[Editorで開く](https://turbowarp.org/editor?project_url=https%3A%2F%2Fkubohiroya.github.io%2Fturbowarp-asset-cache%2Fsamples%2Fshow-cached-svg.sb3) · [SB3をダウンロード](https://kubohiroya.github.io/turbowarp-asset-cache/samples/show-cached-svg.sb3)

緑の旗で自作SVGの星を取得・登録・表示し、`Result` がtrueになります。Spaceで通常コスチュームに戻し、このサンプルの資源だけをメモリとキャッシュから削除します。`Result` はfalseになります。

公式TurboWarp Editorでカスタム拡張の確認画面の **Run extension without sandbox** をチェックし、**Allow** を選択してください。SB3はこのリポジトリの配布JSを内包します。 SVGは同じGitHub Pagesから取得します。追加拡張は不要です。

`show-cached-svg/project.json` とSVGが編集用ソースです。`samples/manifest.json` が配布設定と期待値です。編集後はNode.js 26で `node scripts/build-samples.mjs`、`node scripts/build-samples.mjs --check`、`node --test scripts/verify-samples.mjs` を実行し、生成SB3をコミットしてください。`node scripts/prepare-pages.mjs` は既存docs/distと配布ファイルを `_site` に配置します。本体フラグの既定値は変更しません。
