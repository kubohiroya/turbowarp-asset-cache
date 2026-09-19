import { type ExtensionManifest, type ExtensionManifestBlock } from '@kubohiroya/turbowarp-extension-manifest';
export interface AssetCacheManifestBlock extends ExtensionManifestBlock {
    resultType: 'boolean' | 'string' | 'void';
    effect: 'control' | 'pure' | 'storage-write';
    immutable: boolean;
    errors: string[];
    server: {
        supported: false;
    };
}
export interface AssetCacheManifest extends Omit<ExtensionManifest, 'formatVersion' | 'blocks'> {
    formatVersion: 2;
    blocks: AssetCacheManifestBlock[];
}
export declare function createAssetCacheManifest(id: string, definitions: unknown): AssetCacheManifest;
export declare function serializeAssetCacheManifest(id: string, definitions: unknown): string;
