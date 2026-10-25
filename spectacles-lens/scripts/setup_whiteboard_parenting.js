const http = require('http');

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
  const overlayId = "9421de3f-43ef-48a6-8087-8ead031c9f47";
  const backplateId = "202cf816-8f02-4710-bbbe-ac742c5cdc0c";

  console.log('1. Reparenting WhiteboardOverlayAnchor under WhiteboardBackplate...');
  const resParent = await callMcp('scene-graphql', {
    query: `
      mutation {
        setParent(id: "${overlayId}", parentId: "${backplateId}") {
          id
        }
      }
    `
  });
  console.log('Reparent result:', JSON.stringify(resParent, null, 2));

  console.log('2. Setting localTransform of WhiteboardOverlayAnchor...');
  const resTransform = await callMcp('scene-graphql', {
    query: `
      mutation {
        setLocalTransform(
          id: "${overlayId}"
          position: { x: 0, y: 0.1, z: 0 }
          rotation: { x: 0, y: 0, z: 0 }
          scale: { x: 0.97, y: 1.0, z: 0.96 }
        ) {
          id
        }
      }
    `
  });
  console.log('LocalTransform result:', JSON.stringify(resTransform, null, 2));

  const verify = await callMcp('scene-graphql', {
    query: `
      query {
        sceneObject(id: "${overlayId}") {
          id
          name
          parent { id name }
          localTransform {
            position { x y z }
            rotation { x y z }
            scale { x y z }
          }
          transform {
            position { x y z }
            rotation { x y z }
            scale { x y z }
          }
        }
      }
    `
  });
  console.log('Verify overlay:', JSON.stringify(verify, null, 2));
}

main().catch(console.error);
