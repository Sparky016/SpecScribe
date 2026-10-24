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
  const mut = `
    mutation {
      setLocalTransform(
        id: "202cf816-8f02-4710-bbbe-ac742c5cdc0c"
        position: { x: 0, y: 0, z: -116 }
        rotation: { x: 90, y: 0, z: 0 }
        scale: { x: 120, y: 1, z: 80 }
      ) {
        id
        name
      }
    }
  `;
  const res = await callMcp('scene-graphql', { query: mut });
  console.log('Mutation result:', JSON.stringify(res, null, 2));

  const box = await callMcp('GetBoundingBox', {
    action: 'get_object_bounds',
    boundingObjectIds: ['202cf816-8f02-4710-bbbe-ac742c5cdc0c']
  });
  console.log('Bounding box:', box.result.content[0].text);
}

main().catch(console.error);
