import {readFileSync} from 'node:fs';
import {expect, test} from 'vitest';

test('built extension exposes a Japanese description without hiding core security metadata', () => {
  const source = readFileSync(new URL('../dist/asset-cache.js', import.meta.url), 'utf8');
  const header = source.match(/^(?:\/\/[^\n]*(?:\n|$))*/)?.[0] ?? '';
  expect(header).toContain('// Description[ja]: TurboWarpで画像・音声・実行時テキストの素材を登録・保持し、表示・再生します。');
  expect(header).toMatch(/^\/\/ Description: .+$/m);
  expect(header).toMatch(/^\/\/ Unsandboxed: required$/m);
  for (const field of ['Name', 'ID', 'Description', 'By', 'License', 'Unsandboxed']) {
    expect(header.indexOf('// '+field+':')).toBeGreaterThanOrEqual(0);
    expect(header.indexOf('// '+field+':')).toBeLessThan(header.indexOf('// Description[ja]:'));
  }
});
