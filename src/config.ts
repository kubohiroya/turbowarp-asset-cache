export const extensionConfig = {
  id: 'kubohiroyaassetcache',
  slug: 'asset-cache',
  name: 'Asset Cache',
  description:
    'Register, cache, display, and play image, audio, and runtime text assets in TurboWarp.',
  descriptions: {ja: 'TurboWarpで画像・音声・実行時テキストの素材を登録・保持し、表示・再生します。'},
  author: 'Hiroya Kubo',
  license: 'MPL-2.0',
  unsandboxed: 'required',
  docsURI: 'https://kubohiroya.github.io/turbowarp-asset-cache/',
  color1: '#5b7cfa',
  color2: '#425ed8',
  color3: '#2f46aa',
  blockIconURI: `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect x="4" y="8" width="40" height="32" rx="6" fill="#59C059"/><path d="M14 20h12l3 3h7v12a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2V22a2 2 0 0 1 2-2z" fill="#fff"/><path d="M24 17v8M21 22l3 3 3-3" fill="none" stroke="#59C059" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  )}`
} as const;
