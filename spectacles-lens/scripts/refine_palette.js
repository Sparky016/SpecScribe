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
  console.log('1. Setting SIKPinchPaletteRoot position to x: -44...');
  await callMcp('scene-graphql', {
    query: `
      mutation {
        setLocalTransform(
          id: "3264dcaf-507c-43a2-aaa7-a555c08df52a"
          position: { x: -43, y: 0, z: -108 }
          rotation: { x: 0, y: 0, z: 0 }
          scale: { x: 1, y: 1, z: 1 }
        ) { id name }
      }
    `
  });

  console.log('2. Applying aspect ratio correction to text...');
  const buttons = [
    { id: 'e21c9cbc-d4c3-426b-8f7d-6a1d78dfea45', name: 'BtnAddDecision', label: '+ Decision' },
    { id: 'a90dd370-9ce1-4589-826b-64940b241145', name: 'BtnAddService', label: '+ Service' },
    { id: 'c9bf271d-c938-41bc-945d-236c7987ca43', name: 'BtnAddDatabase', label: '+ Database' },
    { id: '3d0aea0d-655d-4729-8c2a-38eae528e068', name: 'BtnAddTerminal', label: '+ Terminal' },
    { id: '5372a530-7c8a-462c-be86-f776c9a79b3f', name: 'BtnUpdateSnapshot', label: 'Update Snapshot' },
    { id: '20e18c41-8ab6-49ce-8369-1e40ab736037', name: 'BtnConcludeMeeting', label: 'Conclude Session' }
  ];

  for (const b of buttons) {
    const q = `
      query {
        sceneObject(id: "${b.id}") {
          children {
            id
            name
            components {
              id
              type
            }
          }
        }
      }
    `;
    const res = await callMcp('scene-graphql', { query: q });
    const data = JSON.parse(res.result.content[0].text).data;
    if (data && data.sceneObject && data.sceneObject.children) {
      for (const child of data.sceneObject.children) {
        // Child text aspect correction: parent is 18 x 5 (ratio 3.6). So x scale should be 1/3.6 = 0.278 relative to y!
        await callMcp('scene-graphql', {
          query: `
            mutation {
              setLocalTransform(
                id: "${child.id}"
                position: { x: 0, y: 0, z: 0.6 }
                rotation: { x: 0, y: 0, z: 0 }
                scale: { x: 0.055, y: 0.2, z: 1 }
              ) { id name }
            }
          `
        });
      }
    }
  }

  console.log('3. Capturing preview screenshot...');
  const screenshot = await callMcp('CapturePanelScreenshotTool', { pluginId: 'Snap.Plugin.Gui.PreviewPanel' });
  if (screenshot.result && screenshot.result.content && screenshot.result.content[0].data) {
    const buf = Buffer.from(screenshot.result.content[0].data, 'base64');
    const out = 'C:/Users/ruanc/.gemini/antigravity-ide/brain/730e2b4f-1f5b-4100-b792-c2ad2b4d9e0b/preview_panel.jpg';
    fs.writeFileSync(out, buf);
    console.log('Saved screenshot to:', out);
  }
}

main().catch(console.error);
