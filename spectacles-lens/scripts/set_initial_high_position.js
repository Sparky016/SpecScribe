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
      params: {
        name: tool,
        arguments: args
      }
    }));
    req.end();
  });
}

async function main() {
  const backplateId = "202cf816-8f02-4710-bbbe-ac742c5cdc0c";
  console.log('Setting initial transform for WhiteboardBackplate to start up high (y = 46)...');
  const res = await callMcp('scene-graphql', {
    query: `
      mutation {
        setLocalTransform(
          id: "${backplateId}"
          position: { x: 0, y: 46, z: -230 }
          rotation: { x: 90, y: 0, z: 0 }
          scale: { x: 140, y: 1, z: 90 }
        ) {
          id
        }
      }
    `
  });
  console.log('Result:', JSON.stringify(res, null, 2));
}

main().catch(console.error);
