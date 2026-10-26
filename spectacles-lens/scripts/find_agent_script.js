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
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: tool, arguments: args } }));
    req.end();
  });
}

async function run() {
  const code = `
    const model = pluginSystem.findInterface(Editor.Model.IModel);
    const scene = model.project.scene;
    const ctrl = scene.sceneObjects.find((o: any) => o.name === 'SpecScribeControllers');
    const aiH = scene.sceneObjects.find((o: any) => o.name === 'AiPreviewAgent Handler');
    function getDetails(o: any) {
      if (!o) return null;
      return {
        name: o.name,
        enabled: o.enabled,
        components: o.components.map((c: any) => ({
          name: c.name,
          typeName: (c as any).typeName || c.constructor.name,
          props: Object.keys(c)
        }))
      };
    }
    return JSON.stringify({ ctrl: getDetails(ctrl), aiH: getDetails(aiH) }, null, 2);
  `;
  const res = await call('ExecuteEditorCode', { code });
  console.log(res.result ? res.result.content[0].text : JSON.stringify(res));
}

run().catch(console.error);
