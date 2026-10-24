const http = require('http');
const fs = require('fs');

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
  console.log('Fixing size on 4 node buttons...');
  await callMcp('scene-graphql', {
    query: `
      mutation {
        t1: setProperty(id: "be5fdd4f-9c21-4b4a-9c5a-d7e8bcbb0438", propertyPath: "size", value: 1.5, valueType: NUMBER) { id }
        t2: setProperty(id: "40147fdd-b6cd-4cfa-bec2-a1a46c0e8e1f", propertyPath: "size", value: 1.5, valueType: NUMBER) { id }
        t3: setProperty(id: "1ce5bed0-f746-413e-9be2-ecf650f90959", propertyPath: "size", value: 1.5, valueType: NUMBER) { id }
        t4: setProperty(id: "a395774a-328a-4a7b-9039-5c47573f3d2b", propertyPath: "size", value: 1.5, valueType: NUMBER) { id }
      }
    `
  });

  const shot = await callMcp('CapturePanelScreenshotTool', { pluginId: 'Snap.Plugin.Gui.PreviewPanel' });
  const buf = Buffer.from(shot.result.content[0].data, 'base64');
  fs.writeFileSync('c:/Users/ruanc/source/repos/SpecScribe/preview_fixed_buttons.jpg', buf);
  fs.writeFileSync('C:/Users/ruanc/.gemini/antigravity-ide/brain/a1d49ac0-9611-4865-a573-37788258aacb/preview_fixed_buttons.jpg', buf);
  console.log('Saved preview_fixed_buttons.jpg');
}

main().catch(console.error);
