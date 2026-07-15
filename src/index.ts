import {TMPoseExtension} from './extension.js';

if (!Scratch.extensions.unsandboxed) {
  throw new Error('TMPose must run without the extension sandbox.');
}

Scratch.extensions.register(new TMPoseExtension());
