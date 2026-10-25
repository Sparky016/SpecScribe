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
    const cam = scene.sceneObjects.find(o => o.name === 'Camera Object');
    const agent = scene.sceneObjects.find(o => o.name === 'RaisingHandAgentRoot');
    if (cam && agent) {
      agent.parent = cam;
      agent.localTransform.position = new vec3(26, 13, -65);
      agent.localTransform.rotation = new vec3(6, -12, 0);
      agent.localTransform.scale = new vec3(1, 1, 1);
    }
    return JSON.stringify({
      parent: agent.parent ? agent.parent.name : null,
      pos: { x: agent.localTransform.position.x, y: agent.localTransform.position.y, z: agent.localTransform.position.z }
    });
  `;
  const res = await call('ExecuteEditorCode', { code });
  console.log(res.result ? res.result.content[0].text : JSON.stringify(res));
}

main().catch(console.error);
