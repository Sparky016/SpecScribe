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
      sceneObject(id: "e21c9cbc-d4c3-426b-8f7d-6a1d78dfea45") {
        id
        name
        components {
          id
          type
          properties
        }
      }
    }
  `;
  const res = await callMcp('scene-graphql', { query: q });
  const data = JSON.parse(res.result.content[0].text).data.sceneObject;
  for (const c of data.components) {
    console.log(`Component [${c.type}] id: ${c.id}`, c.properties.scriptAsset ? `scriptAsset: ${c.properties.scriptAsset.name}` : '');
  }
}

main().catch(console.error);
