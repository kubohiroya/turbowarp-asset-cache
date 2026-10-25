import {extensionConfig} from './config.js';
import {AnimatedAssetManagerExtension} from './animation.js';

if (extensionConfig.unsandboxed === 'required' && !Scratch.extensions.unsandboxed) {
  throw new Error(`${extensionConfig.name} must run unsandboxed.`);
}

Scratch.extensions.register(new AnimatedAssetManagerExtension());
