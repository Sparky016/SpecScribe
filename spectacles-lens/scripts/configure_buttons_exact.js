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
  console.log('1. Repositioning SIKPinchPaletteRoot to x: -55...');
  await callMcp('scene-graphql', {
    query: `
      mutation {
        setLocalTransform(
          id: "3264dcaf-507c-43a2-aaa7-a555c08df52a"
          position: { x: -55, y: 0, z: -110 }
          rotation: { x: 0, y: 0, z: 0 }
          scale: { x: 1, y: 1, z: 1 }
        ) { id name }
      }
    `
  });

  console.log('2. Repositioning RaisingHandAgentRoot to x: 52...');
  await callMcp('scene-graphql', {
    query: `
      mutation {
        setLocalTransform(
          id: "20fb5c55-94e0-4bd9-856b-4d28611f34f3"
          position: { x: 50, y: 22, z: -105 }
          rotation: { x: 0, y: 0, z: 0 }
          scale: { x: 1, y: 1, z: 1 }
        ) { id name }
      }
    `
  });

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
          id
          name
          components {
            id
            type
          }
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
    if (data && data.sceneObject) {
      // Check direct components
      let textComp = data.sceneObject.components.find(c => c.type === 'Text');
      if (textComp) {
        console.log(`Setting text on ${b.name} (${textComp.id}) -> "${b.label}"`);
        await callMcp('scene-graphql', {
          query: `
            mutation {
              setProperty(
                id: "${textComp.id}"
                propertyPath: "text"
                value: "${b.label}"
                valueType: STRING
              )
            }
          `
        });
      }
      // Check child components
      if (data.sceneObject.children) {
        for (const child of data.sceneObject.children) {
          const childTextComp = child.components.find(c => c.type === 'Text');
          if (childTextComp) {
            console.log(`Setting text on child ${child.name} (${childTextComp.id}) -> "${b.label}"`);
            await callMcp('scene-graphql', {
              query: `
                mutation {
                  setProperty(
                    id: "${childTextComp.id}"
                    propertyPath: "text"
                    value: "${b.label}"
                    valueType: STRING
                  )
                }
              `
            });
            // Adjust child transform
            await callMcp('scene-graphql', {
              query: `
                mutation {
                  setLocalTransform(
                    id: "${child.id}"
                    position: { x: 0, y: 0, z: 0.5 }
                    rotation: { x: 0, y: 0, z: 0 }
                    scale: { x: 0.28, y: 0.28, z: 1 }
                  ) { id name }
                }
              `
            });
          }
        }
      }
    }
  }

  console.log('5. Capturing preview screenshot...');
  const screenshot = await callMcp('CapturePanelScreenshotTool', { pluginId: 'Snap.Plugin.Gui.PreviewPanel' });
  if (screenshot.result && screenshot.result.content && screenshot.result.content[0].data) {
    const buf = Buffer.from(screenshot.result.content[0].data, 'base64');
    const out = 'C:/Users/ruanc/.gemini/antigravity-ide/brain/730e2b4f-1f5b-4100-b792-c2ad2b4d9e0b/preview_panel.jpg';
    fs.writeFileSync(out, buf);
    console.log('Saved screenshot to:', out);
  }
}

main().catch(console.error);
