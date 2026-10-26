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
  const query = `
    query {
      sceneObject(id: "202cf816-8f02-4710-bbbe-ac742c5cdc0c") {
        id
        name
        enabled
        localTransform {
          position { x y z }
          rotation { x y z }
          scale { x y z }
        }
        components {
          id
          type
        }
      }
    }
  `;
  const res = await callMcp('scene-graphql', { query });
  console.log('Whiteboard Backplate:', JSON.stringify(res, null, 2));

  const queryAnchor = `
    query {
      sceneObject(id: "9421de3f-43ef-48a6-8087-8ead031c9f47") {
        id
        name
        enabled
        localTransform {
          position { x y z }
          rotation { x y z }
          scale { x y z }
        }
        components {
          id
          type
        }
      }
    }
  `;
  const resAnchor = await callMcp('scene-graphql', { query: queryAnchor });
  console.log('Whiteboard Anchor:', JSON.stringify(resAnchor, null, 2));
}

main().catch(console.error);
