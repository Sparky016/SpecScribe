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

async function setProp(compId, path, value, type = 'PRIMITIVE') {
  return callMcp('scene-graphql', {
    query: `
      mutation {
        setProperty(
          id: "${compId}"
          propertyPath: "${path}"
          value: ${typeof value === 'string' ? `"${value}"` : value}
          valueType: ${type}
        ) {
          id
        }
      }
    `
  });
}

async function main() {
  const compId = "6b0efce7-a456-4b90-845f-683e5fb82594";
  console.log('Configuring InteractableManipulation properties on component:', compId);

  await setProp(compId, 'enableTranslation', true);
  await setProp(compId, 'enableRotation', false);
  await setProp(compId, 'enableScale', true);

  const res = await callMcp('scene-graphql', {
    query: `
      query {
        sceneObject(id: "202cf816-8f02-4710-bbbe-ac742c5cdc0c") {
          components {
            id
            type
            properties
          }
        }
      }
    `
  });
  const data = JSON.parse(res.result.content[0].text).data;
  const manipComp = data.sceneObject.components.find(c => c.id === compId);
  console.log('Manip component properties:', JSON.stringify(manipComp.properties, null, 2));
}

main().catch(console.error);
