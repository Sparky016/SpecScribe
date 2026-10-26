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
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: tool, arguments: args } }));
    req.end();
  });
}

async function main() {
  const code = `
    const model = pluginSystem.findInterface(Editor.Model.IModel);
    const scene = model.project.scene;
    const btn = scene.sceneObjects.find(o => o.name && o.name.includes('Decision'));
    if (!btn) return 'btn not found';
    const dump = {
      name: btn.name,
      transform: {
        position: btn.transform.position,
        scale: btn.transform.scale
      },
      components: btn.components.map(c => {
        const inf: any = { name: c.name };
        if (c.name === 'Text') {
          inf.size = c.size;
          inf.text = c.text;
        }
        if (c.name === 'RenderMeshVisual') {
          inf.mesh = c.mesh ? c.mesh.name : null;
          inf.material = c.material ? c.material.name : null;
        }
        return inf;
      })
    };
    return JSON.stringify(dump, null, 2);
  `;
  const res = await callMcp('ExecuteEditorCode', { code });
  console.log(res.result.content[0].text);
}

main().catch(console.error);
