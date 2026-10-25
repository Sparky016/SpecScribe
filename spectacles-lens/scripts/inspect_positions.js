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
    const find = n => scene.sceneObjects.find(o => o.name === n);
    const cam = find('Camera Object');
    const pal = find('SIKPinchPaletteRoot');
    const agent = find('RaisingHandAgentRoot');
    const orb = find('AgentOrbMesh');
    const btn1 = find('BtnAddDecision');
    const backplate = find('WhiteboardBackplate');

    const camComp = cam.components.find(c => c.name === 'Camera');
    return JSON.stringify({
      camRenderLayer: camComp ? camComp.renderLayer : null,
      camObjLayer: cam ? cam.layer : null,
      palLayer: pal ? pal.layer : null,
      agentLayer: agent ? agent.layer : null,
      orbLayer: orb ? orb.layer : null,
      btn1Layer: btn1 ? btn1.layer : null,
      bpLayer: backplate ? backplate.layer : null
    }, null, 2);
  `;
  const res = await call('ExecuteEditorCode', { code });
  console.log(res.result ? res.result.content[0].text : JSON.stringify(res));
}

main().catch(console.error);
