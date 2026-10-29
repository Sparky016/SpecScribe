/**
 * Shared scene-graph search helpers.
 *
 * Previously duplicated in RaisingHandAgentController and SpatialInterfaceManager.
 * The two copies had identical search logic (depth-first, first match wins across
 * root objects, errors logged and null returned); only the log prefix differed, so
 * the consolidated version logs under "[SceneUtils]".
 */

/** Depth-first search of a SceneObject subtree for the first object with the given name. */
export function searchHierarchy(obj: SceneObject, name: string): SceneObject | null {
  if (obj.name === name) {
    return obj;
  }
  const count = obj.getChildrenCount();
  for (let i = 0; i < count; i++) {
    const found = searchHierarchy(obj.getChild(i), name);
    if (found) return found;
  }
  return null;
}

/** Searches every root object of the active scene for the first SceneObject with the given name. */
export function findSceneObject(name: string): SceneObject | null {
  try {
    if (typeof global !== 'undefined' && (global as any).scene) {
      const sc = (global as any).scene;
      const count = sc.getRootObjectsCount();
      for (let i = 0; i < count; i++) {
        const found = searchHierarchy(sc.getRootObject(i), name);
        if (found) return found;
      }
    }
  } catch (e) {
    print(`[SceneUtils] findSceneObject failed: ${e}`);
  }
  return null;
}
