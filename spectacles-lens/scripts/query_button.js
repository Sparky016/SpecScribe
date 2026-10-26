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
      sceneObject(id: "527b1451-93e8-466a-bb9f-8ea8710ef395") {
        id
        name
        components {
          id
          type
        }
        children {
          id
          name
          components {
            id
            type
          }
        }
      }
    }
  `;
  const res = await callMcp('scene-graphql', { query: q });
  console.log(JSON.stringify(res, null, 2));
}

main().catch(console.error);
