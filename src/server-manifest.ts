import {
  createExtensionManifest,
  serializeExtensionManifest,
  type ExtensionManifest,
  type ExtensionManifestBlock
} from '@kubohiroya/turbowarp-extension-manifest';

/** The format version 2 fields, which the package models as optional on a block. */
export type AssetCacheBlockMetadata = Required<
  Pick<ExtensionManifestBlock, 'effect' | 'errors' | 'immutable' | 'resultType' | 'server'>
>;

/**
 * Derives this extension's format version 2 metadata from its block definitions.
 *
 * The contract itself — which fields exist and what values they may take — belongs to
 * @kubohiroya/turbowarp-extension-manifest. Only the policy is local: which of these blocks writes
 * to the asset store, and which merely reports.
 */
export function assetCacheBlockMetadata(definitions: unknown): Record<string, AssetCacheBlockMetadata> {
  const blocks = (definitions as {blocks: {opcode: string; blockType: string}[]}).blocks;
  const metadata: Record<string, AssetCacheBlockMetadata> = {};
  for (const block of blocks) {
    metadata[block.opcode] = {
      resultType: resultType(block.blockType),
      effect: block.opcode.includes('CachedAsset')
        ? 'storage-write'
        : isReporter(block.blockType)
          ? 'pure'
          : 'control',
      immutable: isReporter(block.blockType),
      errors: [],
      // Nothing here is lowered on a server yet.
      server: {supported: false}
    };
  }
  return metadata;
}

export function createAssetCacheManifest(id: string, definitions: unknown): ExtensionManifest {
  return createExtensionManifest(id, definitions, options(definitions));
}

export function serializeAssetCacheManifest(id: string, definitions: unknown): string {
  return serializeExtensionManifest(id, definitions, options(definitions));
}

function options(definitions: unknown) {
  return {formatVersion: 2, blockMetadata: assetCacheBlockMetadata(definitions)} as const;
}

function isReporter(blockType: string): boolean {
  return blockType === 'REPORTER' || blockType === 'BOOLEAN';
}

function resultType(blockType: string): 'boolean' | 'string' | 'void' {
  if (blockType === 'BOOLEAN') return 'boolean';
  if (blockType === 'REPORTER') return 'string';
  return 'void';
}
