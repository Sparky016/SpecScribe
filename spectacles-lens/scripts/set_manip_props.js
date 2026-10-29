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
  const compId = "6b0efce7-a456-4b90-845f-683e5fb82594";
  console.log('Setting enableRotation = false...');
  const res = await callMcp('scene-graphql', {
    query: `
      mutation {
        setProperty(
          id: "${compId}"
          propertyPath: "enableRotation"
          value: false
          valueType: BOOLEAN
        ) {
          id
        }
      }
    `
  });
  console.log('Result:', JSON.stringify(res, null, 2));

  const verify = await callMcp('scene-graphql', {
    query: `
      query {
        sceneObject(id: "202cf816-8f02-4710-bbbe-ac742c5cdc0c") {
          components {
            id
            properties
          }
        }
      }
    `
  });
  const data = JSON.parse(verify.result.content[0].text).data;
  const c = data.sceneObject.components.find(x => x.id === compId);
  console.log('enableRotation is now:', c.properties.enableRotation);
}

main().catch(console.error);
