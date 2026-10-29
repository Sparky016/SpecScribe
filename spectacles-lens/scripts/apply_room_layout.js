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
  console.log('1. Reparenting DiffToastText to SpatialHUDRoot...');
  // Move DiffToastText under SpatialHUDRoot
  await callMcp('scene-graphql', {
    query: `
      mutation {
        setParent(
          id: "c436992d-a9d8-49db-acd2-e32a2a7dfdc5"
          parentId: "7e394714-7a6a-4e46-875f-5b92a6021979"
        ) { id name }
      }
    `
  });

  console.log('2. Positioning DiffToastText above Whiteboard on Wall...');
  await callMcp('scene-graphql', {
    query: `
      mutation {
        setLocalTransform(
          id: "c436992d-a9d8-49db-acd2-e32a2a7dfdc5"
          position: { x: 0, y: 88, z: -228 }
          rotation: { x: 0, y: 0, z: 0 }
          scale: { x: 1, y: 1, z: 1 }
        ) { id }
        setToastSize: setProperty(
          id: "811cbec7-8d0c-4102-963d-b72933176dcc"
          propertyPath: "size"
          value: 12
          valueType: NUMBER
        ) { id }
      }
    `
  });

  console.log('3. Positioning SIK Palette to left of Whiteboard...');
  await callMcp('scene-graphql', {
    query: `
      mutation {
        setLocalTransform(
          id: "3264dcaf-507c-43a2-aaa7-a555c08df52a"
          position: { x: -85, y: 25, z: -190 }
          rotation: { x: 0, y: 18, z: 0 }
          scale: { x: 1, y: 1, z: 1 }
        ) { id }
      }
    `
  });

  console.log('4. Positioning AI Agent to right of Whiteboard...');
  await callMcp('scene-graphql', {
    query: `
      mutation {
        setLocalTransform(
          id: "20fb5c55-94e0-4bd9-856b-4d28611f34f3"
          position: { x: 85, y: 30, z: -190 }
          rotation: { x: 0, y: -18, z: 0 }
          scale: { x: 1, y: 1, z: 1 }
        ) { id }
      }
    `
  });

  console.log('5. Fixing text sizes for all buttons...');
  // Text component IDs on buttons:
  // BtnAddDecision: be5fdd4f-9c21-4b4a-9c5a-d7e8bcbb0438
  // BtnUpdateSnapshot: aa32091c-f167-4528-94a0-8165a772a53f
  // BtnConcludeMeeting: 863a5edb-f3c1-45ec-b52d-514f8fc2fe04
  await callMcp('scene-graphql', {
    query: `
      mutation {
        s1: setProperty(
          id: "aa32091c-f167-4528-94a0-8165a772a53f"
          propertyPath: "size"
          value: 1.5
          valueType: NUMBER
        ) { id }
        s2: setProperty(
          id: "863a5edb-f3c1-45ec-b52d-514f8fc2fe04"
          propertyPath: "size"
          value: 1.5
          valueType: NUMBER
        ) { id }
      }
    `
  });

  console.log('6. Taking preview screenshot to verify...');
  const shot = await callMcp('CapturePanelScreenshotTool', { pluginId: 'Snap.Plugin.Gui.PreviewPanel' });
  const buf = Buffer.from(shot.result.content[0].data, 'base64');
  fs.writeFileSync('c:/Users/ruanc/source/repos/SpecScribe/preview_layout_test.jpg', buf);
  fs.writeFileSync('C:/Users/ruanc/.gemini/antigravity-ide/brain/a1d49ac0-9611-4865-a573-37788258aacb/preview_layout_test.jpg', buf);
  console.log('Saved preview_layout_test.jpg');
}

main().catch(console.error);
