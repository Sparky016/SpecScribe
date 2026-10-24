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
  const mutation = `
    mutation {
      c1: setProperty(
        id: "aa32091c-f167-4528-94a0-8165a772a53f"
        propertyPath: "size"
        value: 1.5
        valueType: NUMBER
      ) { id }
      c2: setProperty(
        id: "863a5edb-f3c1-45ec-b52d-514f8fc2fe04"
        propertyPath: "size"
        value: 1.5
        valueType: NUMBER
      ) { id }
    }
  `;
  const res = await callMcp('scene-graphql', { query: mutation });
  console.log('Result:', JSON.stringify(res, null, 2));
}

main().catch(console.error);
