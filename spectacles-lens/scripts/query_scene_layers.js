const http = require('http');

function call(tool, args = {}) {
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
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: tool, arguments: args } }));
    req.end();
  });
}

async function main() {
  const query = `
    query {
      allSceneObjects {
        id
        name
        parentId
        layer { mask }
        localTransform {
          position { x y z }
          rotation { x y z }
          scale { x y z }
        }
        components {
          id
          typeName
        }
      }
    }
  `;

  const r = await call('scene-graphql', { query });
  const objs = r.result && r.result.data ? r.result.data.allSceneObjects : [];
  console.log(`Found ${objs.length} scene objects:`);
  for (const o of objs) {
    console.log(`- ${o.name} (id: ${o.id}, parent: ${o.parentId}, mask: ${o.layer ? o.layer.mask : 'none'})`);
    console.log(`  pos: [${o.localTransform.position.x}, ${o.localTransform.position.y}, ${o.localTransform.position.z}], scale: [${o.localTransform.scale.x}, ${o.localTransform.scale.y}, ${o.localTransform.scale.z}]`);
    console.log(`  comps: ${o.components.map(c => c.typeName).join(', ')}`);
  }
}

main().catch(console.error);
