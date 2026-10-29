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
    const card = scene.sceneObjects.find(o => o.name === 'ExpandedCritiqueCard');
    const pill = scene.sceneObjects.find(o => o.name === 'HandRaisedPillBadge');
    const cardText = card ? card.components.find(c => c.name === 'Text') : null;
    const pillText = pill ? pill.components.find(c => c.name === 'Text') : null;
    
    return JSON.stringify({
      cardScale: card ? card.localTransform.scale : null,
      cardPos: card ? card.localTransform.position : null,
      cardTextSize: cardText ? cardText.size : null,
      pillScale: pill ? pill.localTransform.scale : null,
      pillPos: pill ? pill.localTransform.position : null,
      pillTextSize: pillText ? pillText.size : null
    }, null, 2);
  `;
  const res = await call('ExecuteEditorCode', { code });
  console.log(res.result ? res.result.content[0].text : JSON.stringify(res, null, 2));
}

main().catch(console.error);
