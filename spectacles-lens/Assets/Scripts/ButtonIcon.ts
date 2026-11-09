/**
 * Puts an icon on the front face of a palette button (a box mesh) instead of a text label.
 *
 * The icon is a runtime quad child of the button, sized from the button mesh's own bounds, drawn with a clone
 * of the diagram overlay's transparent textured material. Any Text on the button is cleared so only the icon
 * shows. Safe no-op outside the Lens runtime (tests) or when any piece is missing.
 */

/** Fraction of the button face's shorter side the icon covers. */
const ICON_FILL = 0.72;

let baseMaterial: Material | undefined;

/** `loadIcon` must call requireAsset with a literal path in the caller's file (paths resolve at compile time). */
export function applyButtonIcon(button: SceneObject | undefined, loadIcon: () => Texture): boolean {
  try {
    if (!button || typeof MeshBuilder === 'undefined') return false;
    const box = button.getComponent('Component.RenderMeshVisual') as RenderMeshVisual;
    if (!box || !box.mesh) return false;

    const icon = loadIcon();
    baseMaterial = baseMaterial || (requireAsset('../Materials/Mat_DiagramOverlay.mat') as Material);
    if (!icon || !baseMaterial) return false;

    const text = button.getComponent('Component.Text') as Text;
    if (text) text.text = '';

    // Square quad centred on the front (+Z) face, in the button's local units.
    const min = box.mesh.aabbMin;
    const max = box.mesh.aabbMax;
    const half = (Math.min(max.x - min.x, max.y - min.y) * ICON_FILL) / 2;
    const cx = (min.x + max.x) / 2;
    const cy = (min.y + max.y) / 2;
    const z = max.z + (max.z - min.z) * 0.02;

    const builder = new MeshBuilder([
      { name: 'position', components: 3 },
      { name: 'normal', components: 3, normalized: true },
      { name: 'texture0', components: 2 }
    ]);
    builder.topology = MeshTopology.Triangles;
    builder.indexType = MeshIndexType.UInt16;
    // prettier-ignore
    builder.appendVerticesInterleaved([
      cx - half, cy - half, z, 0, 0, 1, 0, 0,
      cx + half, cy - half, z, 0, 0, 1, 1, 0,
      cx + half, cy + half, z, 0, 0, 1, 1, 1,
      cx - half, cy + half, z, 0, 0, 1, 0, 1
    ]);
    builder.appendIndices([0, 1, 2, 2, 3, 0, 0, 2, 1, 2, 0, 3]); // both windings: visible whatever the cull mode
    builder.updateMesh();

    const iconObj = global.scene.createSceneObject(`${button.name}Icon`);
    iconObj.setParent(button);
    const rmv = iconObj.createComponent('Component.RenderMeshVisual') as RenderMeshVisual;
    rmv.mesh = builder.getMesh();
    const material = baseMaterial.clone();
    material.mainPass.baseTex = icon;
    material.mainPass.baseColor = new vec4(1, 1, 1, 1);
    rmv.mainMaterial = material;
    rmv.setRenderOrder(box.getRenderOrder() + 1);
    return true;
  } catch (e) {
    print(`[ButtonIcon] applyButtonIcon failed for ${button ? button.name : '?'}: ${e}`);
    return false;
  }
}
