# 音声instanceの共通controller

追跡: [Issue #6](https://github.com/kubohiroya/turbowarp-asset-cache/issues/6)。開発中の追加APIで、既存公開版に同名APIがあることを示す文書ではありません。

`createAudioPlayback({asset: 'Music'}, {gain: 0.7, muted: false, playbackRate: 1, fadeIn: 0.5, fadeOut: 1.5})` は、停止状態の独立したinstanceを返します。`asset` と `url` のどちらか一つが必須です。直接URLは認証情報を含まないHTTP(S)に限定し、anonymous CORSで読み込みます。別originのサーバーにはAccess-Control-Allow-Originが必要です。これは後からsetGainで増幅する場合も必要となる[Web AudioのCORS仕様](https://webaudio.github.io/web-audio-api/#MediaElementAudioSourceNode-security)に従います。準備だけではnative `play()` を呼びません。有効化フラグは不要です。

```js
const playback = await assets.createAudioPlayback({asset: 'Music'}, {gain: 0.7, fadeIn: 0.5, fadeOut: 1.5});
try {
  await playback.play({restart: true, loop: true, gain: 1.5, fadeIn: 0.5, fadeOut: 1.5, signal});
  playback.pause();
  await playback.seek(1.5, signal);
  await playback.setGain(2);
  playback.setMuted(false);
  playback.setPlaybackRate(1.5);
  await playback.play({signal});
  await playback.stop({fadeOut: 0.5});
} finally {
  playback.dispose();
}
```

- `play` はnative再生の開始まで待ちます。`restart` は先頭へ戻す指定（既定false）、`loop` を省略すると直前の設定を保ちます。
- `ended` は現在の再生の終了待ちPromiseです。`play` ごとに更新されるため、`await playback.play(); await playback.ended;` の順で使います。自然終了・pause・stop・置換・disposeで待機を完了し、再生失敗やAbortSignalによる中断はrejectします。
- `pause` は位置を保持します。`stop({fadeOut, signal})` は再生中ならフェードアウト完了まで待ち、ループを解除して先頭へ戻します。0秒・一時停止中・未再生なら即時停止です。いずれもinstanceと素材を保持し、再利用できます。フェードを使うstopはPromiseをawaitしてください。
- `seek` は必要ならmetadataを最大10秒待ちます。負の秒、有限でない秒、長さを超える秒を拒否します。待機中のabort/disposeでもlistenerとtimerを回収します。
- gainは0以上の有限数（既定1）、mutedは真偽値、playbackRateは0.25〜4です。音量などは同じ素材の別instanceへ影響しません。gain=0で無音、1で原音、2で2倍です。playのgain省略時は現在値を保持します。100%超の増幅には共有AudioContextとinstanceごとのGainNodeを使い、native volumeは減衰とフェードに使います。極端なgainはWeb Audioのfloat表現上限内で出力します。増幅後のsetGainはAudioContextの再開を待つ場合があるためawaitしてください。
- `dispose` は冪等です。sourceを外してnative音声と増幅nodeを解放し、最後の増幅instanceでは共有AudioContextもcloseします。所有するObject URLを一度だけrevokeします。直接HTTP(S) URLをrevokeすることはありません。

`createAudioVoice` と外部ファイルの `playSound` も同じnative controllerへ委譲します。voiceの `ended` / `setGain` / `stop` の契約は維持します。プロジェクト素材の旧 `playSound` はScratch SoundBankの互換adapterとして残します。

明示的に準備したcontrollerは旧 `stopSound(asset)` の停止範囲に含めません。ID単位の所有者はcontrollerの `pause` / `stop` / `dispose` を使ってください。`releaseAsset` は該当素材のinstanceを回収し、compositionの `releaseAll` は直接URLも含めて所有するinstanceを回収します。別compositionのinstanceは対象にしません。全体停止の `stopAllSounds` は従来どおり全音声を停止します。

autoplay拒否は `PLAYBACK_FAILED` の `cause` にブラウザの `NotAllowedError` を保持します。アプリはこの原因をDSL側の診断へ変換できます。ポリシーを回避する起動フラグやURLスイッチは追加しません。

切り戻しはconsumerを先に旧APIへ戻し、依存版を前版へ固定して行います。旧consumerのvoice APIは変更不要です。


## フェード

`fadeIn` / `fadeOut` は0以上の有限な秒数で、既定は0です。準備時に設定し、`play` の同名optionでその再生を上書きできます。再生開始はnative play成功までを待ち、フェードイン完了までは待ちません。`ended` はフェードインを含む再生全体の自然終了を待ちます。

フェードは実時間で線形に変化します。設定gainと音量倍率を分離するため、`gain` と `setGain` はフェード中も元の設定音量を扱います。短い素材で開始と終了のフェードが重なる場合は小さい倍率を使います。

非ループは残りのmedia時間を現在の再生速度で換算し、終了前のfadeOutへ追従します。seek・rate変更・duration確定でも再計算します。長さが不明なら自動の終了予測はできないため、明示的なstopを使います。ループの各周回ではfadeOutを行いません。

`stop` の秒数省略時はその再生のfadeOutを使い、現在の音量倍率から0へ下げます。完了後はgainを保持して再利用できます。stop中の自然終了は待機を完了し、native errorは失敗を返します。新しいplay・pause・disposeは古いフェードとstop待機をキャンセルし、timerを残しません。stopのAbortSignalはフェードを中断して即時停止し、呼び出しをAbortErrorでrejectします。

sceneや素材の解放に使うdisposeはフェードを待たず即時に解放します。旧createAudioVoiceのstopとBGM crossfadeの既存契約は変えません。
