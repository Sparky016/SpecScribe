import { test, describe, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setupLensGlobalMocks } from './lens_mock_environment.mjs';

setupLensGlobalMocks();

class TreeObject {
  constructor(name, children = []) {
    this.name = name;
    this.children = children;
  }
  getChildrenCount() { return this.children.length; }
  getChild(i) { return this.children[i]; }
}

describe('Task 44: shared scene-search helpers', () => {
  let SceneUtils;
  const originalScene = global.scene;
  const originalPrint = global.print;

  before(async () => {
    SceneUtils = await import('../dist/Assets/Scripts/SceneUtils.js');
  });

  beforeEach(() => {
    global.scene = undefined;
  });

  afterEach(() => {
    global.scene = originalScene;
    global.print = originalPrint;
  });

  test('searchHierarchy finds a deeply nested object depth-first', () => {
    const target = new TreeObject('Target');
    const root = new TreeObject('Root', [
      new TreeObject('A', [new TreeObject('A1')]),
      new TreeObject('B', [new TreeObject('B1', [target])])
    ]);
    assert.equal(SceneUtils.searchHierarchy(root, 'Target'), target);
  });

  test('searchHierarchy returns the first match in depth-first order', () => {
    const first = new TreeObject('Dup');
    const second = new TreeObject('Dup');
    const root = new TreeObject('Root', [new TreeObject('X', [first]), second]);
    assert.equal(SceneUtils.searchHierarchy(root, 'Dup'), first);
  });

  test('searchHierarchy returns null when the name is absent', () => {
    const root = new TreeObject('Root', [new TreeObject('A')]);
    assert.equal(SceneUtils.searchHierarchy(root, 'Missing'), null);
  });

  test('findSceneObject returns null when no scene global is available', () => {
    assert.equal(SceneUtils.findSceneObject('Anything'), null);
  });

  test('findSceneObject searches every root object and returns the first match', () => {
    const match = new TreeObject('Wanted');
    global.scene = {
      getRootObjectsCount: () => 2,
      getRootObject: (i) => (i === 0
        ? new TreeObject('RootA', [new TreeObject('Other')])
        : new TreeObject('RootB', [match]))
    };
    assert.equal(SceneUtils.findSceneObject('Wanted'), match);
  });

  test('findSceneObject logs and returns null when the scene access throws', () => {
    const logged = [];
    global.print = (msg) => logged.push(String(msg));
    global.scene = {
      getRootObjectsCount: () => { throw new Error('boom'); }
    };
    assert.equal(SceneUtils.findSceneObject('Wanted'), null);
    assert.equal(logged.length, 1);
    assert.match(logged[0], /\[SceneUtils\] findSceneObject failed/);
  });
});

describe('Task 44: duplicated helpers removed from scene scripts', () => {
  const scriptsDir = new URL('../Assets/Scripts/', import.meta.url);
  const read = (file) => readFileSync(new URL(file, scriptsDir), 'utf8');

  test('RaisingHandAgentController and SpatialInterfaceManager do not define the helpers', () => {
    for (const file of ['RaisingHandAgentController.ts', 'SpatialInterfaceManager.ts']) {
      const src = read(file);
      assert.doesNotMatch(src, /(private\s+)?findSceneObject\s*\(\s*name\s*:/, file);
      assert.doesNotMatch(src, /(private\s+)?searchHierarchy\s*\(\s*obj\s*:/, file);
      assert.match(src, /import \{ findSceneObject \} from '\.\/SceneUtils';/, file);
    }
  });

  test('SceneUtils.ts is the only file that defines the helpers', () => {
    const utils = read('SceneUtils.ts');
    assert.match(utils, /export function findSceneObject\(/);
    assert.match(utils, /export function searchHierarchy\(/);
  });
});
