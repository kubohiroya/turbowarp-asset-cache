import {defineConfig} from 'vite';
import {turboWarpExtension} from '@kubohiroya/vite-plugin-turbowarp-extension';
import definitions from './src/block-definitions.json' with {type: 'json'};
import {serializeAssetCacheManifest} from './src/server-manifest.js';
import {normalizeBundleIndentation} from './vite-indent-plugin.js';

const EXTENSION_ID = 'kubohiroyaassetcache';

export default defineConfig({
  plugins: [
    turboWarpExtension({
      id: EXTENSION_ID,
      name: 'Asset Cache',
      description: 'Register, cache, display, and play image, audio, and runtime text assets in TurboWarp.',
      descriptions: {ja: 'TurboWarpで画像・音声・実行時テキストの素材を登録・保持し、表示・再生します。'},
      author: 'Hiroya Kubo',
      license: 'MPL-2.0',
      unsandboxed: 'required',
      fileName: 'asset-cache.js'
    }),
    {
      name: 'asset-cache-manifest',
      apply: 'build',
      enforce: 'post',
      generateBundle() {
        this.emitFile({type: 'asset', fileName: 'extension-manifest.json', source: serializeAssetCacheManifest(EXTENSION_ID, definitions)});
      }
    },
    normalizeBundleIndentation()
  ]
});
