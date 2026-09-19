import {AnimatedAssetManagerExtension} from './animation.js';

if (!Scratch.extensions.unsandboxed) {
  throw new Error('Asset Cache must run unsandboxed.');
}

Scratch.extensions.register(new AnimatedAssetManagerExtension());
