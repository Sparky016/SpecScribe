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
    const cam = scene.sceneObjects.find(o => o.name === 'Camera Object');
    const camComp = cam.components.find(c => c.name === 'Camera');
    const agent = scene.sceneObjects.find(o => o.name === 'RaisingHandAgentRoot');
    const orb = scene.sceneObjects.find(o => o.name === 'AgentOrbMesh');
    
    return JSON.stringify({
      camLayer: camComp ? camComp.renderLayer : null,
      agentLayer: agent ? agent.layer : null,
      orbLayer: orb ? orb.layer : null,
      orbPos: orb ? orb.localTransform.position : null,
      agentPos: agent ? agent.localTransform.position : null,
      agentParent: agent && agent.parent ? agent.parent.name : null
    }, null, 2);
  `;
  const res = await call('ExecuteEditorCode', { code });
  console.log(res.result ? res.result.content[0].text : JSON.stringify(res, null, 2));
}

main().catch(console.error);
