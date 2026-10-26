const http = require('http');
const fs = require('fs');
const path = require('path');

function callMcp(tool, args) {
  return new Promise((resolve, reject) => {
    const req = http.request('http://localhost:50040/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': require('./lib/mcpClient').authHeader()
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: tool, arguments: args } }));
    req.end();
  });
}

async function main() {
  const meshId = "bca4812a-983e-4e68-b0da-7fe482703084"; // Mesh_ButtonBox
  const matId = "d761a15c-0e9d-4869-b66f-3f3fb6d824e0";  // Mat_ButtonBackplate
  const cardId = "cb5872f8-6017-49f2-a069-72d65718f0bb"; // ExpandedCritiqueCard
  const pillId = "0fe217d5-f040-4177-831a-5647a1747d14"; // HandRaisedPillBadge

  // Query scene
  const queryObjs = `query {
    allSceneObjects {
      id
      name
      parent { id }
      components { id type }
    }
  }`;
  const resObjs = await callMcp('scene-graphql', { query: queryObjs });
  const allObjs = JSON.parse(resObjs.result.content[0].text).data.allSceneObjects;

  // 1. Ensure CardBackplate under ExpandedCritiqueCard
  let cardBackplate = allObjs.find(o => o.name === 'CardBackplate' && o.parent && o.parent.id === cardId);
  let cardBackplateId = cardBackplate ? cardBackplate.id : null;
  if (!cardBackplateId) {
    const createRes = await callMcp('scene-graphql', {
      query: `mutation {
        createSceneObject(name: "CardBackplate", parentId: "${cardId}") { id }
      }`
    });
    cardBackplateId = JSON.parse(createRes.result.content[0].text).data.createSceneObject.id;
    const addRmv = await callMcp('scene-graphql', {
      query: `mutation {
        addComponent(id: "${cardBackplateId}", componentType: "RenderMeshVisual") { id }
      }`
    });
  }

  // Refresh RMV id for cardBackplate
  const resCb = await callMcp('scene-graphql', {
    query: `query { sceneObject(id: "${cardBackplateId}") { components { id type } } }`
  });
  const cbRmv = JSON.parse(resCb.result.content[0].text).data.sceneObject.components.find(c => c.type === 'RenderMeshVisual');

  await callMcp('scene-graphql', {
    query: `mutation {
      setMesh: setProperty(id: "${cbRmv.id}", propertyPath: "mesh", value: "${meshId}", valueType: REFERENCE) { success }
      setMat: setProperty(id: "${cbRmv.id}", propertyPath: "mainMaterial", value: "${matId}", valueType: REFERENCE) { success }
      setLocalTransform(
        id: "${cardBackplateId}"
        position: { x: 0, y: 0, z: -0.6 }
        rotation: { x: 0, y: 0, z: 0 }
        scale: { x: 17, y: 9.5, z: 0.3 }
      ) { success }
      setRenderOrder: setProperty(id: "${cbRmv.id}", propertyPath: "renderOrder", value: 1, valueType: NUMBER) { success }
    }`
  });

  // 2. Ensure PillBackplate under HandRaisedPillBadge
  let pillBackplate = allObjs.find(o => o.name === 'PillBackplate' && o.parent && o.parent.id === pillId);
  let pillBackplateId = pillBackplate ? pillBackplate.id : null;
  if (!pillBackplateId) {
    const createRes = await callMcp('scene-graphql', {
      query: `mutation {
        createSceneObject(name: "PillBackplate", parentId: "${pillId}") { id }
      }`
    });
    pillBackplateId = JSON.parse(createRes.result.content[0].text).data.createSceneObject.id;
    await callMcp('scene-graphql', {
      query: `mutation {
        addComponent(id: "${pillBackplateId}", componentType: "RenderMeshVisual") { id }
      }`
    });
  }

  const resPb = await callMcp('scene-graphql', {
    query: `query { sceneObject(id: "${pillBackplateId}") { components { id type } } }`
  });
  const pbRmv = JSON.parse(resPb.result.content[0].text).data.sceneObject.components.find(c => c.type === 'RenderMeshVisual');

  await callMcp('scene-graphql', {
    query: `mutation {
      setMesh: setProperty(id: "${pbRmv.id}", propertyPath: "mesh", value: "${meshId}", valueType: REFERENCE) { success }
      setMat: setProperty(id: "${pbRmv.id}", propertyPath: "mainMaterial", value: "${matId}", valueType: REFERENCE) { success }
      setLocalTransform(
        id: "${pillBackplateId}"
        position: { x: 0, y: 0, z: -0.4 }
        rotation: { x: 0, y: 0, z: 0 }
        scale: { x: 13, y: 3.5, z: 0.3 }
      ) { success }
      setRenderOrder: setProperty(id: "${pbRmv.id}", propertyPath: "renderOrder", value: 1, valueType: NUMBER) { success }
    }`
  });

  // 3. Configure Text on HandRaisedPillBadge
  const resPillComp = await callMcp('scene-graphql', {
    query: `query { sceneObject(id: "${pillId}") { components { id type } } }`
  });
  const pillTxt = JSON.parse(resPillComp.result.content[0].text).data.sceneObject.components.find(c => c.type === 'Text');
  if (pillTxt) {
    await callMcp('scene-graphql', {
      query: `mutation {
        s1: setProperty(id: "${pillTxt.id}", propertyPath: "size", value: 18, valueType: NUMBER) { success }
        s2: setProperty(id: "${pillTxt.id}", propertyPath: "renderOrder", value: 5, valueType: NUMBER) { success }
      }`
    });
  }

  console.log('Scene backplates and text configured successfully.');
}

main().catch(console.error);
