import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {TMPoseExtension} from '../src/extension.js';

beforeEach(() => {
  vi.stubGlobal('document', {
    scripts: [],
    createElement: vi.fn(),
    head: {appendChild: vi.fn()},
    querySelector: vi.fn(),
    querySelectorAll: vi.fn(() => [])
  });
  vi.stubGlobal('Scratch', {
    BlockType: {COMMAND: 'command', REPORTER: 'reporter', BOOLEAN: 'boolean', HAT: 'hat'},
    ArgumentType: {STRING: 'string', NUMBER: 'number', BOOLEAN: 'boolean'},
    translate: (value: string | {default: string}) => typeof value === 'string' ? value : value.default,
    extensions: {unsandboxed: true, register: vi.fn()}
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('TMPoseExtension', () => {
  it('exposes the expected extension ID and blocks', () => {
    const info = new TMPoseExtension().getInfo() as {id: string; blocks: unknown[]};
    expect(info.id).toBe('tmpose');
    expect(info.blocks).toHaveLength(24);
  });

  it('normalizes a model URL with a trailing slash', () => {
    const extension = new TMPoseExtension();
    extension.setModelURL({URL: 'https://example.com/model'});
    expect(extension.modelURL).toBe('https://example.com/model/');
  });
});
