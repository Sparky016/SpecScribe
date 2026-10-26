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
      sceneObject(id: "202cf816-8f02-4710-bbbe-ac742c5cdc0c") {
        components {
          id
          type
          properties
        }
      }
    }
  `;
  const res1 = await callMcp('scene-graphql', { query: q });
  console.log('Whiteboard Backplate RMV:', JSON.stringify(res1, null, 2));

  const q2 = `
    query {
      sceneObject(id: "9421de3f-43ef-48a6-8087-8ead031c9f47") {
        components {
          id
          type
          properties
        }
      }
    }
  `;
  const res2 = await callMcp('scene-graphql', { query: q2 });
  console.log('Whiteboard Anchor RMV:', JSON.stringify(res2, null, 2));
}

main().catch(console.error);
