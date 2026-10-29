const http = require('http');
const fs = require('fs');

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
    const agent = scene.sceneObjects.find(o => o.name === 'RaisingHandAgentRoot');
    
    agent.parent = cam;
    agent.localTransform.position = new vec3(26, 9.5, -60);
    agent.localTransform.rotation = new vec3(4, -10, 0);

    return JSON.stringify({
      agentName: agent.name,
      parentName: agent.parent ? agent.parent.name : null
    }, null, 2);
  `;
  await call('ExecuteEditorCode', { code });
  await new Promise(r => setTimeout(r, 600));

  const shot = await call('CapturePanelScreenshotTool', { pluginId: 'Snap.Plugin.Gui.PreviewPanel' });
  const buf = Buffer.from(shot.result.content[0].data, 'base64');
  fs.writeFileSync('C:/Users/ruanc/.gemini/antigravity-ide/brain/a1d49ac0-9611-4865-a573-37788258aacb/preview_orb_camera_view2.jpg', buf);
  console.log('Saved preview_orb_camera_view2.jpg');
}

main().catch(console.error);
