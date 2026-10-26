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
  console.log('1. Creating SceneObject LeafIndex...');
  const createRes = await callMcp('scene-graphql', {
    query: `
      mutation {
        createSceneObject(name: "LeafIndex", parentId: null) {
          id
          name
        }
      }
    `
  });
  console.log('createSceneObject:', JSON.stringify(createRes));
  const newObjId = JSON.parse(createRes.result.content[0].text).data.createSceneObject.id;

  console.log('2. Adding ScriptComponent to LeafIndex...');
  const addCompRes = await callMcp('scene-graphql', {
    query: `
      mutation {
        addComponent(id: "${newObjId}", componentType: "Component.ScriptComponent") {
          id
          type
        }
      }
    `
  });
  console.log('addComponent:', JSON.stringify(addCompRes));
  const compId = JSON.parse(addCompRes.result.content[0].text).data.addComponent.id;

  console.log('3. Setting script property to LeafIndex.ts asset (243cd8ff-751c-4901-8766-b22457302861)...');
  const setPropRes = await callMcp('scene-graphql', {
    query: `
      mutation {
        setProperty(
          id: "${compId}"
          propertyPath: "script"
          value: "243cd8ff-751c-4901-8766-b22457302861"
          valueType: REFERENCE
        )
      }
    `
  });
  console.log('setProperty:', JSON.stringify(setPropRes));

  console.log('4. Recompiling TypeScript...');
  const comp = await callMcp('RecompileTypeScriptTool', {});
  console.log('Compile result:', JSON.stringify(comp, null, 2));

  console.log('5. Listing LEAF scenarios...');
  const sc = await callMcp('list_leaf_scenarios', {});
  console.log('Leaf scenarios:', JSON.stringify(sc, null, 2));
}

main().catch(console.error);
