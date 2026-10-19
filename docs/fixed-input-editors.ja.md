# 固定入力エディターの契約

対応GUIの起動時に`blockEditorDialogs=1&blockEditorFixedInputs=1`を指定し、再読込した場合だけ登録する。既定OFFで、旧GUIやCLIに固定登録APIがなければ何もしない。公開するブロック・引数・既定値・`docsURI`・既存データ形式は変更しない。

| ブロック | 対象 | UIと保存 |
|---|---|---|
| `setTextStyle` | `PROPERTY` / `VALUE` | PROPERTYの固定5選択とVALUEの有限分岐。animation/alignは選択、fontは自由入力、colorは色、widthは数値文字列。VALUEは常にSTRINGで空文字reset可能 |
| `loadingCostumeAt` | `INDEX` | 数値UI。新入力は有限の数値表記。小数・負数を許容し、既存runtimeの切捨て・下限補正・循環を維持。非表示の互換ブロック |

Schemaの正本は`schemas/block-editor-fixed-inputs.schema.json`。`getInfo()`と`src/text-style.ts`の`normalizeTextStyleProperty` / `normalizeTextStyleValue`、`src/extension.ts`の`loadingCostumeAt`がruntime契約の正本であり、棚卸しやUI候補だけを受け入れ根拠にしない。新Schemaは登録用の各fragmentに投影し、ネットワークSchema参照を行わない。NP-finite-new-input-v1の対象はINDEXであり、STRINGであるVALUE.widthへ一律適用しない。widthのSchemaはSTRING構造を確認し、CPの正の有限値/resetをpure normalizerで意味検証する。STRINGの数値UIとprogrammatic候補はともに`0x10`・`+20`等を既存runtimeと同じく受け入れる。JSON数値文法のbuffer検査はINDEX等のnumber型投影に限定し、widthと区別する。

既存alias（`typing`、短縮色、大小文字、旧数値表記）は表示投影だけでは書き換えない。PROPERTYの修復・変更時は最終branchで必要なVALUEを検査し、不適合なら修正/resetまで全patchを拒否する。selectorがreporter・欠落・非対応ならVALUEは読取専用。reporterを評価・置換しない。未知literal selectorは既知値へ修復可能で、未変更なら未知rawも保持する。NAMEや素材registry、font候補providerには触れない。

同じ画面で分岐を切り替えてもdraftを保持し、保存失敗後も保持する。取消・dispose・project/target/登録の失効では共通sessionが破棄する。再openは現在のrawから開始し、旧draftを復活させない。登録はgetInfoに存在するopcodeだけを対象とし、同じinstance/APIへの重複登録を行わず、API置換・部分失敗・runtime終了・disposeでcleanupする。

共通依存はGit commit `485f0e550e622235624b5e9176820161aeeba252`に固定する。開発用の型とpure数値parserを使い、登録はhostの`registerFixedInputEditor`へoptionsを渡す。既存composition APIにGUI/React実行依存を追加しない。runtime同梱JSと公開入口の型が外部common参照を要求しないことをbuildとpack consumerで確認する。

`tests/fixed-input-editors.test.ts`でCP-asset-cacheのBC01〜05/14全6fixture、全5branchのruntime比較、空文字reset、有限数値と精度表記、旧raw保持、登録とcleanupを検証する。Asset Managerは別ownerであり、この結果を流用して合格とはしない。文書入口は`docs/index.html`と`docs/ja/index.html`の各固定アンカーから到達でき、Markdown再生成ではこれらの静的HTML説明を削除しない。

切戻しは固定フラグをOFFにして再読込する。依存を戻す場合はmanifest・lock・実解決を一組で戻す。既存raw値やsb3の移行は不要。今回の作業はローカルのみで、commit・push・PR・merge・Pages公開・npm公開・Issue操作は含まない。
