import {describe, expect, it} from 'vitest';
import policy from '../repo-policy.json' with {type: 'json'};
import definitions from '../src/block-definitions.json' with {type: 'json'};
import {createAssetCacheManifest, serializeAssetCacheManifest} from '../src/server-manifest.js';

describe('extension API manifest', () => {
  it('serializes the canonical block definitions deterministically', () => {
    const first = serializeAssetCacheManifest(policy.extension.id, definitions);
    const second = serializeAssetCacheManifest(policy.extension.id, structuredClone(definitions));
    const manifest = createAssetCacheManifest(policy.extension.id, definitions);

    expect(first).toBe(second);
    expect(first).toBe(`${JSON.stringify(manifest, null, 2)}\n`);
    expect(manifest.id).toBe(policy.extension.id);
    expect(manifest.blocks).toHaveLength(definitions.blocks.length);
    expect(manifest.blocks.map((block) => block.opcode)).toEqual(
      definitions.blocks.map((block) => block.opcode).sort()
    );
    expect(manifest.formatVersion).toBe(2);
    expect(manifest.blocks.every((block) => block.server?.supported === false)).toBe(true);
  });

  it('rejects an invalid extension ID', () => {
    expect(() => createAssetCacheManifest('Invalid-ID', definitions)).toThrow(
      'Extension manifest ID must contain only lowercase letters and numbers.'
    );
  });

  it('rejects duplicate opcodes', () => {
    expect(() =>
      createAssetCacheManifest(policy.extension.id, {
        blocks: [
          {opcode: 'same', blockType: 'COMMAND'},
          {opcode: 'same', blockType: 'REPORTER'}
        ]
      })
    ).toThrow('Duplicate block opcode: same');
  });

  it('rejects an argument that references an unknown menu', () => {
    expect(() =>
      createAssetCacheManifest(policy.extension.id, {
        blocks: [
          {
            opcode: 'choose',
            blockType: 'REPORTER',
            arguments: {VALUE: {type: 'STRING', menu: 'missing'}}
          }
        ]
      })
    ).toThrow('references unknown menu: missing');
  });
});
