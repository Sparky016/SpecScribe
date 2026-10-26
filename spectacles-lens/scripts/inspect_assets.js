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

async function run() {
  const code = `
    const model = pluginSystem.findInterface(Editor.Model.IModel);
    const scene = model.project.scene;
    const assets = model.project.assets;
    
    // Find Mat_CritiqueCard and Mesh_ButtonBox
    const foundAssets: any[] = [];
    for (const a of (assets as any).items || []) {
      if (a.name.includes('Critique') || a.name.includes('ButtonBox') || a.name.includes('Card') || a.name.includes('Pill')) {
        foundAssets.push({ id: a.id, name: a.name, type: a.type });
      }
    }
    return JSON.stringify(foundAssets, null, 2);
  `;
  const res = await callMcp('ExecuteEditorCode', { code });
  if (res.result && res.result.content) {
    console.log(res.result.content[0].text);
  } else {
    console.log(JSON.stringify(res, null, 2));
  }
}

run();
