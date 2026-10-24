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
  console.log('1. Setting script on component 7f58e153-cb62-4f4e-abcd-b4b614c42173...');
  const res = await callMcp('scene-graphql', {
    query: `
      mutation {
        setProperty(
          id: "7f58e153-cb62-4f4e-abcd-b4b614c42173"
          propertyPath: "script"
          value: "243cd8ff-751c-4901-8766-b22457302861"
          valueType: REFERENCE
        ) {
          id
          name
        }
      }
    `
  });
  console.log('setProperty result:', JSON.stringify(res, null, 2));

  console.log('2. Recompiling TypeScript...');
  await callMcp('RecompileTypeScriptTool', {});

  console.log('3. Opening leaf panel...');
  await callMcp('open_leaf_panel', {});

  console.log('4. Listing LEAF scenarios...');
  const sc = await callMcp('list_leaf_scenarios', {});
  console.log('Leaf scenarios:', JSON.stringify(sc, null, 2));
}

main().catch(console.error);
