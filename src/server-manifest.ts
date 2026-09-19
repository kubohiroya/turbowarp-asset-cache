import {createExtensionManifest, type ExtensionManifest, type ExtensionManifestBlock} from '@kubohiroya/turbowarp-extension-manifest';

export interface AssetCacheManifestBlock extends ExtensionManifestBlock {
  resultType: 'boolean' | 'string' | 'void';
  effect: 'control' | 'pure' | 'storage-write';
  immutable: boolean;
  errors: string[];
  server: {supported: false};
}

export interface AssetCacheManifest extends Omit<ExtensionManifest, 'formatVersion' | 'blocks'> {
  formatVersion: 2;
  blocks: AssetCacheManifestBlock[];
}

export function createAssetCacheManifest(id: string, definitions: unknown): AssetCacheManifest {
  const base = createExtensionManifest(id, definitions);
  return {
    formatVersion: 2,
    id: base.id,
    blocks: base.blocks.map((block) => ({
      ...block,
      resultType: resultType(block.blockType),
      effect: block.opcode.includes('CachedAsset') ? 'storage-write' : isReporter(block.blockType) ? 'pure' : 'control',
      immutable: isReporter(block.blockType),
      errors: [],
      server: {supported: false}
    })),
    menus: base.menus
  };
}

export function serializeAssetCacheManifest(id: string, definitions: unknown): string {
  return `${JSON.stringify(createAssetCacheManifest(id, definitions), null, 2)}\n`;
}

function isReporter(blockType: string): boolean {
  return blockType === 'REPORTER' || blockType === 'BOOLEAN';
}

function resultType(blockType: string): 'boolean' | 'string' | 'void' {
  if (blockType === 'BOOLEAN') return 'boolean';
  if (blockType === 'REPORTER') return 'string';
  return 'void';
}
