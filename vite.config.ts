import {defineConfig} from 'vite';
import {turboWarpExtension} from '@kubohiroya/vite-plugin-turbowarp-extension';
import definitions from './src/block-definitions.json' with {type: 'json'};
import {serializeAssetCacheManifest} from './src/server-manifest.js';
import {normalizeBundleIndentation} from './vite-indent-plugin.js';
import {extensionConfig} from './src/config.js';

export default defineConfig({
  plugins: [
    turboWarpExtension({
      id: extensionConfig.id,
      name: extensionConfig.name,
      description: extensionConfig.description,
      descriptions: extensionConfig.descriptions,
      author: extensionConfig.author,
      license: extensionConfig.license,
      unsandboxed: extensionConfig.unsandboxed,
      fileName: `${extensionConfig.slug}.js`
    }),
    {
      name: 'asset-cache-manifest',
      apply: 'build',
      enforce: 'post',
      generateBundle() {
        this.emitFile({type: 'asset', fileName: 'extension-manifest.json', source: serializeAssetCacheManifest(extensionConfig.id, definitions)});
      }
    },
    normalizeBundleIndentation()
  ]
});
