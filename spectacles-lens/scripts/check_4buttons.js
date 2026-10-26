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
  const ids = [
    'e21c9cbc-d4c3-426b-8f7d-6a1d78dfea45', // BtnAddDecision
    'a90dd370-9ce1-4589-826b-64940b241145', // BtnAddService
    'c9bf271d-c938-41bc-945d-236c7987ca43', // BtnAddDatabase
    '3d0aea0d-655d-4729-8c2a-38eae528e068', // BtnAddTerminal
  ];

  for (const id of ids) {
    const q = `
      query {
        sceneObject(id: "${id}") {
          name
          components { id type }
          children {
            id
            name
            components { id type properties }
          }
        }
      }
    `;
    const res = await callMcp('scene-graphql', { query: q });
    console.log(JSON.stringify(JSON.parse(res.result.content[0].text), null, 2));
  }
}

main().catch(console.error);
