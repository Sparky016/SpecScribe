const http = require('http');

function callMcp(tool, args) {
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
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: tool, arguments: args }
    }));
    req.end();
  });
}

async function main() {
  const code = `
    const model = pluginSystem.findInterface(Editor.Model.IModel);
    const scene = model.project.scene;
    const btn = scene.sceneObjects.find(o => o.name === 'BtnAddDecision');
    if (!btn) return 'not found';
    const textComp: any = btn.components.find(c => c.name === 'Text');
    const rmvComp: any = btn.components.find(c => c.name === 'Render Mesh Visual');
    return JSON.stringify({
      btnPos: { x: btn.localTransform.position.x, y: btn.localTransform.position.y, z: btn.localTransform.position.z },
      btnScale: { x: btn.localTransform.scale.x, y: btn.localTransform.scale.y, z: btn.localTransform.scale.z },
      text: textComp ? { text: textComp.text, size: textComp.size } : null,
      rmv: rmvComp ? { mesh: rmvComp.mesh.name, mat: rmvComp.materials.map((m: any) => m ? m.name : 'null') } : null
    }, null, 2);
  `;
  const res = await callMcp('ExecuteEditorCode', { code });
  console.log(res.result ? res.result.content[0].text : JSON.stringify(res));
}

main().catch(console.error);
