const http = require('http');

function call(tool, args = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request('http://localhost:50040/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer Gt0ObwXN9IV3ZQdjIcikYkRFixTh2tWCFSnItHtkC5iHp9qDqQ8pq0yvRA97OkVF'
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch (e) { resolve(d); }
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
  const query = `{
    orbs: sceneObjects(filter: {nameContains: "Orb"}) {
      matches {
        uniqueId
        name
        parent { uniqueId name }
        transform {
          worldPosition
          localPosition
          localRotation
          worldRotation
        }
      }
    }
    roots: sceneObjects(filter: {nameContains: "RaisingHand"}) {
      matches {
        uniqueId
        name
        parent { uniqueId name }
        transform {
          worldPosition
          localPosition
        }
      }
    }
    cameras: sceneObjects(filter: {nameContains: "Camera"}) {
      matches {
        uniqueId
        name
        transform {
          worldPosition
          localPosition
        }
      }
    }
  }`;
  const res = await call('QueryRuntimeSceneTool', { query });
  console.log(JSON.stringify(res, null, 2));
}

main();
