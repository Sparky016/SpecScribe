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
    const find = n => scene.sceneObjects.find(o => o.name === n);
    const cam = find('Camera Object');
    const pal = find('SIKPinchPaletteRoot');
    const agent = find('RaisingHandAgentRoot');
    const orb = find('AgentOrbMesh');
    const btn1 = find('BtnAddDecision');
    const camComp = cam.components.find(c => c.name === 'Camera');

    const toV = v => v ? { x: v.x, y: v.y, z: v.z } : null;
    return JSON.stringify({
      camWorldPos: toV(cam.worldTransform.position),
      agentWorldPos: toV(agent.worldTransform.position),
      agentLocalPos: toV(agent.localTransform.position),
      agentParent: agent.parent ? agent.parent.name : null,
      orbWorldPos: toV(orb.worldTransform.position),
      orbMesh: orb.components.find(c => c.name === 'Render Mesh Visual') ? orb.components.find(c => c.name === 'Render Mesh Visual').mesh : null,
      orbMat: orb.components.find(c => c.name === 'Render Mesh Visual') ? orb.components.find(c => c.name === 'Render Mesh Visual').mainMaterial : null,
      palWorldPos: toV(pal.worldTransform.position),
      palLocalPos: toV(pal.localTransform.position),
      palParent: pal.parent ? pal.parent.name : null,
      btn1WorldPos: toV(btn1.worldTransform.position),
      btn1LocalPos: toV(btn1.localTransform.position),
      btn1Mesh: btn1.components.find(c => c.name === 'Render Mesh Visual') ? btn1.components.find(c => c.name === 'Render Mesh Visual').mesh : null,
      btn1Mat: btn1.components.find(c => c.name === 'Render Mesh Visual') ? btn1.components.find(c => c.name === 'Render Mesh Visual').mainMaterial : null,
      btn1Text: btn1.components.find(c => c.name === 'Text') ? btn1.components.find(c => c.name === 'Text').text : null
    }, null, 2);
  `;
  const res = await call('ExecuteEditorCode', { code });
  console.log(res.result ? res.result.content[0].text : JSON.stringify(res));
}

main().catch(console.error);
