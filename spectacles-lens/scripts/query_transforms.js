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
      cam: sceneObject(id: "00000000-0000-0065-0000-000000000064") {
        name
        localTransform { position { x y z } rotation { x y z } scale { x y z } }
        components { id type }
      }
      hud: sceneObject(id: "7e394714-7a6a-4e46-875f-5b92a6021979") {
        name
        localTransform { position { x y z } rotation { x y z } scale { x y z } }
      }
      wb: sceneObject(id: "202cf816-8f02-4710-bbbe-ac742c5cdc0c") {
        name
        localTransform { position { x y z } rotation { x y z } scale { x y z } }
      }
      wa: sceneObject(id: "9421de3f-43ef-48a6-8087-8ead031c9f47") {
        name
        localTransform { position { x y z } rotation { x y z } scale { x y z } }
      }
    }
  `;
  const res = await callMcp('scene-graphql', { query: q });
  console.log(JSON.stringify(JSON.parse(res.result.content[0].text), null, 2));
}

main().catch(console.error);
