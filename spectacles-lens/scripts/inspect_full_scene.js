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
    const lines = [];
    function dump(obj, depth = 0) {
      const indent = '  '.repeat(depth);
      let info = indent + obj.name + ' (' + obj.id.toString() + ')';
      const pos = obj.localTransform.position;
      const rot = obj.localTransform.rotation;
      const sc = obj.localTransform.scale;
      info += ' pos=(' + pos.x.toFixed(1) + ',' + pos.y.toFixed(1) + ',' + pos.z.toFixed(1) + ')';
      info += ' rot=(' + rot.x.toFixed(1) + ',' + rot.y.toFixed(1) + ',' + rot.z.toFixed(1) + ')';
      info += ' sc=(' + sc.x.toFixed(1) + ',' + sc.y.toFixed(1) + ',' + sc.z.toFixed(1) + ')';
      lines.push(info);
      for (const child of obj.children) {
        dump(child, depth + 1);
      }
    }
    for (const root of scene.rootObjects) {
      dump(root);
    }
    return lines.join('\\n');
  `;
  const res = await callMcp('ExecuteEditorCode', { code });
  console.log(res.result.content[0].text);
}

main().catch(console.error);
