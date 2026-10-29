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

async function main() {
  console.log('1. Setting WhiteboardBackplate transform (rot 0, scale 120, 80, 1)...');
  await callMcp('scene-graphql', {
    query: `
      mutation {
        setLocalTransform(
          id: "202cf816-8f02-4710-bbbe-ac742c5cdc0c"
          position: { x: 0, y: 0, z: -116 }
          rotation: { x: 0, y: 0, z: 0 }
          scale: { x: 120, y: 80, z: 1 }
        )
      }
    `
  });

  const box1 = await callMcp('GetBoundingBox', {
    action: 'get_object_bounds',
    boundingObjectIds: ['202cf816-8f02-4710-bbbe-ac742c5cdc0c']
  });
  console.log('Box with rot 0, scale 120, 80, 1:', box1.result.content[0].text);

  console.log('2. Setting WhiteboardOverlayAnchor transform (rot 0, scale 110, 72, 1, z: -115)...');
  await callMcp('scene-graphql', {
    query: `
      mutation {
        setLocalTransform(
          id: "9421de3f-43ef-48a6-8087-8ead031c9f47"
          position: { x: 0, y: 0, z: -115 }
          rotation: { x: 0, y: 0, z: 0 }
          scale: { x: 110, y: 72, z: 1 }
        )
      }
    `
  });

  const box2 = await callMcp('GetBoundingBox', {
    action: 'get_object_bounds',
    boundingObjectIds: ['9421de3f-43ef-48a6-8087-8ead031c9f47']
  });
  console.log('Overlay Box with rot 0:', box2.result.content[0].text);

  console.log('3. Capturing screenshot...');
  const screenshot = await callMcp('CapturePanelScreenshotTool', { pluginId: 'Snap.Plugin.Gui.PreviewPanel' });
  if (screenshot.result && screenshot.result.content && screenshot.result.content[0].data) {
    const buf = Buffer.from(screenshot.result.content[0].data, 'base64');
    const out = 'C:/Users/ruanc/.gemini/antigravity-ide/brain/730e2b4f-1f5b-4100-b792-c2ad2b4d9e0b/preview_panel.jpg';
    fs.writeFileSync(out, buf);
    console.log('Saved screenshot to:', out);
  }
}

main().catch(console.error);
