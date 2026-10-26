const http = require('http');

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
      params: { name: tool, arguments: args }
    }));
    req.end();
  });
}

async function main() {
  const query = `
    mutation {
      adjustPalette: updateSceneObject(
        id: "3264dcaf-507c-43a2-aaa7-a555c08df52a",
        localTransform: {
          position: { x: -54, y: 22, z: -170 }
          rotation: { x: 0, y: 16, z: 0 }
          scale: { x: 1, y: 1, z: 1 }
        }
      ) {
        id
        name
        localTransform {
          position { x y z }
        }
      }

      adjustAgent: updateSceneObject(
        id: "20fb5c55-94e0-4bd9-856b-4d28611f34f3",
        localTransform: {
          position: { x: 13, y: 8, z: -60 }
          rotation: { x: 6, y: -12, z: 0 }
          scale: { x: 1, y: 1, z: 1 }
        }
      ) {
        id
        name
        localTransform {
          position { x y z }
        }
      }
    }
  `;

  const res = await callMcp('scene-graphql', { query });
  console.log(JSON.stringify(res, null, 2));
}

main().catch(console.error);
