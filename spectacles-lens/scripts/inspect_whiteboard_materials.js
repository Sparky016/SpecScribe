const http = require('http');

function callMcp(tool, args) {
  return new Promise((resolve, reject) => {
    const req = http.request('http://localhost:50040/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': require('./lib/mcpClient').authHeader()
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
    const wb = scene.sceneObjects.find(o => o.name === 'WhiteboardBackplate');
    const overlay = scene.sceneObjects.find(o => o.name === 'WhiteboardOverlayAnchor');
    
    function inspectRmv(obj) {
      if (!obj) return null;
      const rmv = obj.components.find(c => c.name === 'Render Mesh Visual');
      if (!rmv) return { error: 'no RMV' };
      return {
        mesh: rmv.mesh ? rmv.mesh.name : null,
        materialsCount: rmv.materials ? rmv.materials.length : 0,
        materials: rmv.materials ? rmv.materials.map(m => m ? m.name : 'null') : []
      };
    }
    
    return JSON.stringify({
      wb: inspectRmv(wb),
      overlay: inspectRmv(overlay)
    }, null, 2);
  `;

  const res = await callMcp('ExecuteEditorCode', { code });
  console.log(res.result ? res.result.content[0].text : JSON.stringify(res));
}

main().catch(console.error);
