const http = require('http');

function call(tool, args) {
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
    
    const summary = scene.sceneObjects.map(o => ({
      name: o.name,
      parent: o.parent ? o.parent.name : null,
      layer: o.layer,
      position: o.localTransform ? {
        x: o.localTransform.position.x,
        y: o.localTransform.position.y,
        z: o.localTransform.position.z
      } : null,
      rotation: o.localTransform ? {
        x: o.localTransform.rotation.x,
        y: o.localTransform.rotation.y,
        z: o.localTransform.rotation.z
      } : null,
      scale: o.localTransform ? {
        x: o.localTransform.scale.x,
        y: o.localTransform.scale.y,
        z: o.localTransform.scale.z
      } : null,
      components: o.components.map(c => c.name)
    }));

    return JSON.stringify(summary, null, 2);
  `;
  const res = await call('ExecuteEditorCode', { code });
  if (res.result && res.result.content && res.result.content[0]) {
    console.log(res.result.content[0].text);
  } else {
    console.log(JSON.stringify(res, null, 2));
  }
}

main().catch(console.error);
