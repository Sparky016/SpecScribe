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
  const backplateId = "202cf816-8f02-4710-bbbe-ac742c5cdc0c";
  const manipAssetId = "664b556b-1946-4c2c-866a-e675b4e86006";

  console.log('1. Adding ScriptComponent to WhiteboardBackplate...');
  const addRes = await callMcp('scene-graphql', {
    query: `
      mutation {
        addComponent(id: "${backplateId}", componentType: "ScriptComponent") {
          id
        }
      }
    `
  });
  console.log('AddComponent result:', JSON.stringify(addRes, null, 2));

  // Inspect components to get the new component ID
  const inspectRes = await callMcp('scene-graphql', {
    query: `
      query {
        sceneObject(id: "${backplateId}") {
          components {
            id
            type
            properties
          }
        }
      }
    `
  });
  const data = JSON.parse(inspectRes.result.content[0].text).data;
  console.log('Components on WhiteboardBackplate:', JSON.stringify(data.sceneObject.components, null, 2));

  // Find the ScriptComponent that doesn't have scriptAsset or find all ScriptComponents
  const scriptComps = data.sceneObject.components.filter(c => c.type === 'ScriptComponent');
  console.log('Script components count:', scriptComps.length);

  const targetComp = scriptComps[scriptComps.length - 1];
  console.log('Setting scriptAsset on component:', targetComp.id);

  const setRes = await callMcp('scene-graphql', {
    query: `
      mutation {
        setProperty(
          id: "${targetComp.id}"
          propertyPath: "scriptAsset"
          value: "${manipAssetId}"
          valueType: REFERENCE
        ) {
          id
        }
      }
    `
  });
  console.log('Set scriptAsset result:', JSON.stringify(setRes, null, 2));
}

main().catch(console.error);
