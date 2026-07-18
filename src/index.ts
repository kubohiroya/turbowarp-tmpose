import {TMPoseExtension} from './extension.js';

if (!Scratch.extensions.unsandboxed) {
  throw new Error('TMPose must run without the extension sandbox.');
}

const extension = new TMPoseExtension();
Scratch.extensions.register(extension);
if (Scratch.vm?.runtime) {
  Scratch.vm.runtime.ext_tmpose = extension;
}
