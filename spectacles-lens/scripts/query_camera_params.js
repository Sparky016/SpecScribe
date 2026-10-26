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
    const cam = scene.sceneObjects.find(o => o.name === 'Camera Object');
    const camComp: any = cam ? cam.components.find(c => c.name === 'Camera') : null;
    return JSON.stringify({
      fov: camComp ? camComp.fov : null,
      aspect: camComp ? camComp.aspect : null,
      near: camComp ? camComp.near : null,
      far: camComp ? camComp.far : null,
      keys: camComp ? Object.keys(camComp) : []
    }, null, 2);
  `;
  const res = await callMcp('ExecuteEditorCode', { code });
  console.log(res.result ? res.result.content[0].text : JSON.stringify(res));
}

main().catch(console.error);
