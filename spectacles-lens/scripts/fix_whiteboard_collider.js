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
      params: {
        name: tool,
        arguments: args
      }
    }));
    req.end();
  });
}

async function main() {
  const code = `
    const model = pluginSystem.findInterface(Editor.Model.IModel);
    const scene = model.project.scene;
    const obj = scene.findSceneObjectById(Editor.createId("202cf816-8f02-4710-bbbe-ac742c5cdc0c"));
    if (!obj) return { error: "Object not found" };

    const colliders = obj.getComponents("Physics.ColliderComponent");
    console.log("Found colliders count:", colliders.length);
    if (colliders.length > 0) {
      const col = colliders[0];
      col.fitVisual = true;
      console.log("Set fitVisual = true on collider");
    }
    return { success: true };
  `;
  const res = await callMcp('ExecuteEditorCode', { code });
  console.log('Result:', JSON.stringify(res, null, 2));
}

main().catch(console.error);
