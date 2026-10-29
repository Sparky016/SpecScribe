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
  const q = `
    query {
      sceneObject(id: "14352f89-7d6a-44dd-8ca8-2d0fbd5a4a77") {
        id
        name
        enabled
        components {
          id
          type
          properties
        }
      }
    }
  `;
  const res = await callMcp('scene-graphql', { query: q });
  console.log('LeafIndex object:', JSON.stringify(res, null, 2));
}

main().catch(console.error);
