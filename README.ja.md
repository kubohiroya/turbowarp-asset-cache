# TurboWarp-Asset-Cache

<img src="assets/block-icon.svg" alt="" width="48" height="48">

[English](README.md) | 日本語

TurboWarpのプロジェクト向けに、画像・音声・実行時テキストをブラウザ内へ保持するasset cacheです。
composition hostには、OPFSを明示的に選べるhybridなbinary backingを提供します。外部ファイル、
プロジェクト内のコスチューム／背景／音、Temporary Variablesのテキスト参照を登録し、TurboWarpのblockや
composition hostから利用できるようにします。

Asset Cacheは従来の`isLoaded`とcacheのlifecycle semanticsを意図的に維持しています。汎用のサーバー
object storeではなく、format 2 manifestではすべてのblockを`server.supported: false`としています。
移植可能なnamespace/keyの永続化とサーバー側への移送には
[`@kubohiroya/turbowarp-kvs`](https://github.com/kubohiroya/turbowarp-kvs)を使ってください。

`@kubohiroya/turbowarp-asset-manager`は非推奨です。composition利用側は、asset登録・描画・再生・
DOM image resource・検証済みremote cache APIについて、importパスを
`@kubohiroya/turbowarp-asset-cache/composition`へ置き換えられます。binary object、bundle、
session backingのAPIは`@kubohiroya/turbowarp-kvs`から直接importしてください。standaloneの
プロジェクトでは、拡張機能IDも`kubohiroyaassetmanager`から`kubohiroyaassetcache`へ置き換える必要が
あります。公開済みのSB3成果物は、元の拡張機能に固定したままにしてください。

## 最小デモ

[Open in TurboWarp Editor](https://turbowarp.org/editor?project_url=https%3A%2F%2Fkubohiroya.github.io%2Fturbowarp-asset-cache%2Fsamples%2Fshow-cached-svg.sb3) · [Download SB3](https://kubohiroya.github.io/turbowarp-asset-cache/samples/show-cached-svg.sb3)

緑の旗で自作SVGの星を取得・登録・表示し、`Result` がtrueになります。Spaceで通常コスチュームに戻し、このサンプルの資源だけをメモリとキャッシュから削除します。`Result` はfalseになります。

公式TurboWarp Editorでカスタム拡張の確認画面の **Run extension without sandbox** をチェックし、**Allow** を選択してください。SB3はこのリポジトリの配布JSを内包します。 SVGは同じGitHub Pagesから取得します。追加拡張は不要です。

## ユーザーガイド

導入手順、安全上の注意、レシピ、図入りのblock解説は
[English user guide](https://kubohiroya.github.io/turbowarp-asset-cache/)または
[日本語ユーザーガイド](https://kubohiroya.github.io/turbowarp-asset-cache/ja/)を参照してください。

## できること

- 画像、音声、プロジェクトasset、実行時テキストを論理的なasset名で登録します。
- 登録済みの画像やテキストを、スプライト、クローン、ステージへ適用します。
- 登録済みの音声を再生し、actorのアニメーション列にも対応します。
- host拡張機能向けに、blockを使わないComposition APIを提供します。
- SVGとremote binaryの入力を、利用前およびcacheへの書き込み前に検証します。
- アプリケーションshell向けに、story単位のIndexedDB cache制御を利用できる状態に保ちます。
- 既定はIndexedDBのまま、composition hostが検証済みbinary objectのbyte列にOPFSを選べるようにします。

## 統合方法を選ぶ

TurboWarpのプロジェクトが`dist/asset-cache.js`を直接読み込み、パレットにAsset Cacheのblockを並べる場合は
Standalone拡張機能を使います。

別のunsandboxed拡張機能やアプリケーションshellが`@kubohiroya/turbowarp-asset-cache/composition`を
importし、registryを内部に閉じたまま、パレットへAsset Cacheのblockを追加したくない場合はComposition APIを
使います。

独立したプレビューVMでは、`createAssetManagerComposition.supportsRuntimeIsolation === true`を確認し、
`createAssetManagerComposition(undefined, {runtime: previewVm.runtime})`で描画とイベント購読の所有先を指定します。
省略時は従来どおり拡張機能のホストruntimeを使います。終了時の`releaseAll()`は、そのcompositionが所有する
`STOP_FOR_TARGET`購読も解除します。同じcompositionへ再登録すると必要な購読を再開します。

## 動作条件と安全性

standaloneでの利用には、TurboWarp Desktop、またはunsandboxedなカスタム拡張機能を読み込める他の
TurboWarp環境が必要です。実行時テキストの描画には、さらにTemporary Variables（`lmsTempVars2`）と
Animated Text（`text`）が必要です。

SVG入力は既定で拒否します。remote binaryのcache entryは、保存前にサイズ・content-type・SHA-256を
検証します。IndexedDBは機密の境界ではなく補助的なcacheとして扱います。

メンテナはNode.js 24以降と、Corepack経由のpnpmを使います。インストール例とCDN URLのsource of truthは
`package.json`のversionです。

## セキュリティダイアログの説明言語

この版のビルドでは、既定の英語説明に加えて`Description[ja]`コメントへ日本語の説明を出力します。このメタデータに対応した共通セキュリティダイアログは、Editorが日本語なら日本語の説明を表示し、対応する翻訳がなければ元の説明を表示します。

説明の翻訳は必要な実行モードを変えません。この拡張は引き続き`Unsandboxed: required`です。

## インストール

[`dist/asset-cache.js`](dist/asset-cache.js)をダウンロードし、TurboWarp Desktopでローカルの
カスタム拡張機能として読み込みます。確認されたら**サンドボックス化せずに実行**を有効にします。

ビルド済みのJavaScriptファイルをこのリポジトリにcommitしてあるため、Node.jsのインストールやビルドの実行は
必要ありません。

versionを付けたnpm packageにも、同じレビュー済みビルドが入っています。

```bash
pnpm add --save-exact @kubohiroya/turbowarp-asset-cache@0.6.1
```

`node_modules/@kubohiroya/turbowarp-asset-cache/dist/asset-cache.js`を読み込むか、version固定の
CDN URLを使います。

```text
https://cdn.jsdelivr.net/npm/@kubohiroya/turbowarp-asset-cache@0.6.1/dist/asset-cache.js
```

## クイックスタート

1. `dist/asset-cache.js`をunsandboxedなTurboWarp拡張機能として読み込みます。
2. `register resource [RESOURCE_ID] as asset [NAME]`でリソースを登録します。
3. `show asset [NAME] on this sprite`、`set stage backdrop to asset [NAME]`、または音声blockでassetを使います。
4. プロジェクトのlifecycleや保存方針として明示的な後片付けが必要な場合は、cacheと削除のblockを使います。

## Compositionの例

```js
import {createAssetManagerComposition} from '@kubohiroya/turbowarp-asset-cache/composition';

const assets = createAssetManagerComposition();
await assets.registerEmbeddedAsset({
  name: 'Opening',
  sourceName: 'opening.svg',
  mimeType: 'image/svg+xml',
  bytes: new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')
});
await assets.applyToStage('Opening');
assets.releaseAll();
```

## 統合の全体像

- standaloneのプロジェクトは、リソース識別子、実行時テキスト、診断、actorアニメーション、読み込み互換性、
  拡張機能IDの移行について[Runtime and Standalone Contracts](docs/runtime-contracts.md)を参照してください。
- composition hostは、埋め込みasset、構造化locator、音声voice、DOM image resource、SVG検証、
  story単位のcache、検証済みremote binary、binary bundle、session限定のbinary backingについて
  [Composition API](docs/composition-api.md)を参照してください。
- blockの利用者とドキュメントのメンテナは、生成されたblock表について
  [Block Reference](docs/block-reference.md)を参照してください。

## 開発

```bash
npm install --global corepack@latest
corepack enable
pnpm install --frozen-lockfile
pnpm run check
```

block APIの正式なsourceは`src/block-definitions.json`です。変更したらblockのドキュメントを再生成します。

```bash
pnpm run docs
```

ビルドは`dist/asset-cache.js`、`dist/extension-manifest.json`、`dist/composition.js`、
`dist/types/composition.d.ts`を生成します。決定的なformat 2 manifestはすべてのblock signatureを記録し、
Asset Cacheのパレット全体をブラウザ専用として明示します。拡張機能、block metadata、Compositionのsourceを
変更したら、再ビルドした成果物をcommitしてください。

## リリース

公開前にローカルでリリース検査を実行します。

```bash
pnpm run pack:check
pnpm run release:check
```

npm packageのアーカイブには、README、LICENSE、Standalone bundle、拡張機能API manifest、
Composition bundle、Compositionの型宣言を含める必要があります。

## ライセンス

SPDX-License-Identifier: MPL-2.0
