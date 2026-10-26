const http = require('http');
const fs = require('fs');

function callMcp(tool, args) {
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

async function testWallPlacement() {
  await callMcp('scene-graphql', {
    query: `
      mutation {
        wb: setLocalTransform(
          id: "202cf816-8f02-4710-bbbe-ac742c5cdc0c"
          position: { x: 0, y: 36, z: -230 }
          rotation: { x: 90, y: 0, z: 0 }
          scale: { x: 140, y: 1, z: 90 }
        ) { id }
        wa: setLocalTransform(
          id: "9421de3f-43ef-48a6-8087-8ead031c9f47"
          position: { x: 0, y: 36, z: -229 }
          rotation: { x: 90, y: 0, z: 0 }
          scale: { x: 136, y: 1, z: 86 }
        ) { id }
      }
    `
  });

  const shot = await callMcp('CapturePanelScreenshotTool', { pluginId: 'Snap.Plugin.Gui.PreviewPanel' });
  const buf = Buffer.from(shot.result.content[0].data, 'base64');
  fs.writeFileSync('c:/Users/ruanc/source/repos/SpecScribe/preview_wall_test1.jpg', buf);
  console.log('Saved preview_wall_test1.jpg');
}

testWallPlacement().catch(console.error);
