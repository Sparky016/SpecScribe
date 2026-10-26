const http = require('http');

function call(tool, args) {
  return new Promise((resolve, reject) => {
    const req = http.request('http://localhost:50040/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer Gt0ObwXN9IV3ZQdjIcikYkRFixTh2tWCFSnItHtkC5iHp9qDqQ8pq0yvRA97OkVF'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: tool, arguments: args } }));
    req.end();
  });
}

async function main() {
  const code = `
    const model = pluginSystem.findInterface(Editor.Model.IModel);
    const scene = model.project.scene;
    function findRec(obj: any, name: string): any {
      if (obj.name === name) return obj;
      for (const child of obj.children) {
        const found = findRec(child, name);
        if (found) return found;
      }
      return null;
    }
    const wb = scene.sceneObjects.map(o => findRec(o, 'Whiteboard')).find(Boolean);
    const wbMesh = scene.sceneObjects.map(o => findRec(o, 'WhiteboardBoardMesh')).find(Boolean);
    const pal = scene.sceneObjects.map(o => findRec(o, 'SIKPinchPaletteRoot')).find(Boolean);
    return JSON.stringify({
      topLevel: scene.sceneObjects.map(o => o.name),
      wbParent: wb?.parent?.name,
      wbPos: wb ? { x: wb.localTransform.position.x, y: wb.localTransform.position.y, z: wb.localTransform.position.z } : null,
      wbMeshPos: wbMesh ? { x: wbMesh.localTransform.position.x, y: wbMesh.localTransform.position.y, z: wbMesh.localTransform.position.z } : null,
      palPos: pal ? { x: pal.localTransform.position.x, y: pal.localTransform.position.y, z: pal.localTransform.position.z } : null,
    }, null, 2);
  `;
  const res = await call('ExecuteEditorCode', { code });
  console.log(res.result ? res.result.content[0].text : JSON.stringify(res));
}

main().catch(console.error);
