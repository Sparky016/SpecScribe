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
  const q = `
    query {
      btnSnap: sceneObject(id: "5372a530-7c8a-462c-be86-f776c9a79b3f") {
        name
        localTransform { position { x y z } scale { x y z } }
        components { id type }
        children {
          id
          name
          localTransform { position { x y z } scale { x y z } }
          components { id type }
        }
      }
      btnConc: sceneObject(id: "20e18c41-8ab6-49ce-8369-1e40ab736037") {
        name
        localTransform { position { x y z } scale { x y z } }
        components { id type }
        children {
          id
          name
          localTransform { position { x y z } scale { x y z } }
          components { id type }
        }
      }
    }
  `;
  const res = await callMcp('scene-graphql', { query: q });
  console.log(JSON.stringify(JSON.parse(res.result.content[0].text), null, 2));
}

main().catch(console.error);
