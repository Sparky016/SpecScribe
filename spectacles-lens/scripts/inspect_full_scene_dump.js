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
      params: { name: tool, arguments: args }
    }));
    req.end();
  });
}

async function main() {
  const res = await callMcp('scene-graphql', {
    query: `
      query {
        allSceneObjects {
          id
          name
          enabled
          layers { mask }
          parent { id name }
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
    `
  });
  if (!res.result || !res.result.content || !res.result.content[0]) {
    console.log('Error result:', JSON.stringify(res));
    return;
  }
  const parsed = JSON.parse(res.result.content[0].text);
  if (parsed.errors) {
    console.log('GraphQL errors:', JSON.stringify(parsed.errors, null, 2));
    return;
  }
  const data = parsed.data;
  const targets = ['SpatialHUDRoot', 'SIKPinchPaletteRoot', 'RaisingHandAgentRoot', 'AgentOrbMesh', 'Camera Object'];
  const matched = data.allSceneObjects.filter(o => targets.includes(o.name));
  console.log(JSON.stringify(matched, null, 2));
}

main().catch(console.error);
