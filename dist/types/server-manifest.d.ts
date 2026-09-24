import { type ExtensionManifest, type ExtensionManifestBlock } from '@kubohiroya/turbowarp-extension-manifest';
/** The format version 2 fields, which the package models as optional on a block. */
export type AssetCacheBlockMetadata = Required<Pick<ExtensionManifestBlock, 'effect' | 'errors' | 'immutable' | 'resultType' | 'server'>>;
/**
 * Derives this extension's format version 2 metadata from its block definitions.
 *
 * The contract itself — which fields exist and what values they may take — belongs to
 * @kubohiroya/turbowarp-extension-manifest. Only the policy is local: which of these blocks writes
 * to the asset store, and which merely reports.
 */
export declare function assetCacheBlockMetadata(definitions: unknown): Record<string, AssetCacheBlockMetadata>;
export declare function createAssetCacheManifest(id: string, definitions: unknown): ExtensionManifest;
export declare function serializeAssetCacheManifest(id: string, definitions: unknown): string;
