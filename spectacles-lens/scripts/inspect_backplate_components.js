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
  const res = await callMcp('scene-graphql', {
    query: `
      query {
        sceneObject(id: "${backplateId}") {
          id
          name
          components {
            id
            type
            properties
          }
        }
      }
    `
  });
  const data = JSON.parse(res.result.content[0].text).data;
  for (let c of data.sceneObject.components) {
    console.log('Component type:', c.type, 'id:', c.id);
    if (c.type === 'ColliderComponent') {
      console.log('Collider properties:', JSON.stringify(c.properties, null, 2));
    }
  }
}

main().catch(console.error);
