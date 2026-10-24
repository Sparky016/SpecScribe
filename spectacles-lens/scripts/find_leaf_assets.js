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
  const qAsset = `
    query {
      allAssets {
        id
        name
        type
      }
    }
  `;
  const resAsset = await callMcp('asset-graphql', { query: qAsset });
  console.log('Search LeafIndex:', resAsset.result.content[0].text);

  const qScene = `
    query {
      sceneObject(id: "c976b53c-b734-4e75-a22b-ac0afaffcf9a") {
        id
        name
        components {
          id
          type
        }
      }
    }
  `;
  const resScene = await callMcp('scene-graphql', { query: qScene });
  console.log('LEAF Plugin Bridge:', JSON.stringify(resScene, null, 2));
}

main().catch(console.error);
