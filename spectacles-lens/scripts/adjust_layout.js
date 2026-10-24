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
  console.log('1. Adjusting Whiteboard position and scale...');
  await callMcp('scene-graphql', {
    query: `
      mutation {
        wb: setLocalTransform(
          id: "202cf816-8f02-4710-bbbe-ac742c5cdc0c"
          position: { x: 10, y: 0, z: -116 }
          rotation: { x: 90, y: 0, z: 0 }
          scale: { x: 100, y: 1, z: 68 }
        ) { id name }
        wa: setLocalTransform(
          id: "9421de3f-43ef-48a6-8087-8ead031c9f47"
          position: { x: 10, y: 0, z: -115 }
          rotation: { x: 90, y: 0, z: 0 }
          scale: { x: 96, y: 1, z: 64 }
        ) { id name }
      }
    `
  });

  console.log('2. Adjusting Palette position...');
  await callMcp('scene-graphql', {
    query: `
      mutation {
        pal: setLocalTransform(
          id: "32eb6ea5-9377-494b-97fa-4e78bcfb4b8f"
          position: { x: -50, y: 0, z: -112 }
          rotation: { x: 0, y: 0, z: 0 }
          scale: { x: 1, y: 1, z: 1 }
        ) { id name }
      }
    `
  });

  console.log('3. Adjusting button backplates and text labels...');
  // Query button children to find their Text components
  const btnIds = [
    '527b1451-93e8-466a-bb9f-8ea8710ef395', // BtnAddDecision
    '23789966-224d-45db-9c3f-c68997a53c1d', // BtnAddService
    '75df7456-613b-48db-85d8-c91aaae9ec89', // BtnAddDatabase
    'a79c3dcb-be55-45a8-9d5a-8b90eef5ae3a', // BtnAddTerminal
    '5372a530-7c8a-462c-be86-f776c9a79b3f', // BtnUpdateSnapshot
    '20e18c41-8ab6-49ce-8369-1e40ab736037'  // BtnConcludeMeeting
  ];
  const labels = [
    '+ Decision',
    '+ Service',
    '+ Database',
    '+ Terminal',
    'Update Snapshot',
    'Conclude Session'
  ];

  for (let i = 0; i < btnIds.length; i++) {
    const id = btnIds[i];
    const label = labels[i];
    const q = `
      query {
        sceneObject(id: "${id}") {
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
        const textComp = child.components.find(c => c.type === 'Text');
        if (textComp) {
          console.log(`Setting text on ${child.name} (${textComp.id}) to "${label}"`);
          await callMcp('scene-graphql', {
            query: `
              mutation {
                setProperty(
                  id: "${textComp.id}"
                  propertyPath: "text"
                  value: "${label}"
                  valueType: STRING
                )
              }
            `
          });
          // Adjust child scale so text isn't stretched
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

  console.log('4. Adjusting AI Teammate Orb position...');
  await callMcp('scene-graphql', {
    query: `
      mutation {
        setLocalTransform(
          id: "6e1b71d8-04f8-4b71-9ec0-e224e75d5a71"
          position: { x: 50, y: 20, z: -105 }
          rotation: { x: 0, y: 0, z: 0 }
          scale: { x: 1, y: 1, z: 1 }
        ) { id name }
      }
    `
  });

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
