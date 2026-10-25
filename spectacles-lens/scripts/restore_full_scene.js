const http = require('http');
const fs = require('fs');

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

async function queryScene(query) {
  const res = await callMcp('scene-graphql', { query });
  if (res.result && res.result.content && res.result.content[0]) {
    try {
      return JSON.parse(res.result.content[0].text);
    } catch (e) {
      return res.result.content[0].text;
    }
  }
  return res;
}

async function queryAsset(query) {
  const res = await callMcp('asset-graphql', { query });
  if (res.result && res.result.content && res.result.content[0]) {
    try {
      return JSON.parse(res.result.content[0].text);
    } catch (e) {
      return res.result.content[0].text;
    }
  }
  return res;
}

async function main() {
  console.log('=== Step 1: Querying existing scene objects ===');
  const allObjRes = await queryScene(`
    query {
      allSceneObjects {
        id
        name
        parent { id name }
        components { id type }
      }
    }
  `);
  const allObjs = allObjRes.data.allSceneObjects;
  console.log(`Found ${allObjs.length} scene objects.`);

  const findObj = name => allObjs.find(o => o.name === name);

  const spatialHud = findObj('SpatialHUDRoot');
  if (!spatialHud) {
    throw new Error('SpatialHUDRoot not found!');
  }
  const spatialHudId = spatialHud.id;
  console.log('SpatialHUDRoot ID:', spatialHudId);

  const paletteRoot = findObj('SIKPinchPaletteRoot');
  const paletteRootId = paletteRoot ? paletteRoot.id : null;
  console.log('SIKPinchPaletteRoot ID:', paletteRootId);

  // Asset IDs
  const planeMeshId = "1d1de908-3f6f-4db5-9307-716d2834bd0c";
  const whiteboardMatId = "7fd6b2df-8198-43f5-9d90-03f0f34b6578";
  const overlayMatId = "3903e607-a6ab-4834-8994-c68878836d0e";
  const buttonBoxMeshId = "bca4812a-983e-4e68-b0da-7fe482703084";
  const buttonMatId = "d761a15c-0e9d-4869-b66f-3f3fb6d824e0";
  const interactableScriptId = "652e631a-22d0-4941-9f74-2943df59f34c";
  const manipScriptId = "664b556b-1946-4c2c-866a-e675b4e86006";
  const leafIndexScriptId = "243cd8ff-751c-4901-8766-b22457302861";

  // Step 2: Ensure WhiteboardBackplate exists
  let backplate = findObj('WhiteboardBackplate');
  let backplateId = backplate ? backplate.id : null;

  if (!backplate) {
    console.log('Creating WhiteboardBackplate...');
    const createRes = await queryScene(`
      mutation {
        createSceneObject(name: "WhiteboardBackplate", parentId: "${spatialHudId}") {
          id
          name
        }
      }
    `);
    backplateId = createRes.data.createSceneObject.id;
    console.log('Created WhiteboardBackplate with ID:', backplateId);

    console.log('Adding RenderMeshVisual, Collider, Interactable, Manipulation...');
    const compRes = await queryScene(`
      mutation {
        rmv: addComponent(id: "${backplateId}", componentType: "RenderMeshVisual") { id }
        col: addComponent(id: "${backplateId}", componentType: "ColliderComponent") { id }
        sc1: addComponent(id: "${backplateId}", componentType: "ScriptComponent") { id }
        sc2: addComponent(id: "${backplateId}", componentType: "ScriptComponent") { id }
        tf: setLocalTransform(
          id: "${backplateId}"
          position: { x: 0, y: 0, z: -116 }
          rotation: { x: 0, y: 0, z: 0 }
          scale: { x: 120, y: 80, z: 1 }
        ) { success }
      }
    `);
    const rmvId = compRes.data.rmv.id;
    const colId = compRes.data.col.id;
    const sc1Id = compRes.data.sc1.id;
    const sc2Id = compRes.data.sc2.id;

    console.log('Configuring backplate properties...');
    await queryScene(`
      mutation {
        setMesh: setProperty(id: "${rmvId}", propertyPath: "mesh", value: "${planeMeshId}", valueType: REFERENCE) { success }
        setMat: setProperty(id: "${rmvId}", propertyPath: "mainMaterial", value: "${whiteboardMatId}", valueType: REFERENCE) { success }
        setScript1: setProperty(id: "${sc1Id}", propertyPath: "scriptAsset", value: "${interactableScriptId}", valueType: REFERENCE) { success }
        setScript2: setProperty(id: "${sc2Id}", propertyPath: "scriptAsset", value: "${manipScriptId}", valueType: REFERENCE) { success }
      }
    `);
  } else {
    console.log('WhiteboardBackplate already exists:', backplateId);
  }

  // Step 3: Configure WhiteboardOverlayAnchor
  const overlay = findObj('WhiteboardOverlayAnchor');
  if (overlay) {
    console.log('Reparenting and configuring WhiteboardOverlayAnchor under WhiteboardBackplate...');
    await queryScene(`
      mutation {
        setParent(id: "${overlay.id}", parentId: "${backplateId}") { id }
        setLocalTransform(
          id: "${overlay.id}"
          position: { x: 0, y: 0.1, z: 0 }
          rotation: { x: 0, y: 0, z: 0 }
          scale: { x: 0.97, y: 1.0, z: 0.96 }
        ) { id }
      }
    `);

    // Ensure mesh and material on overlay's RenderMeshVisual
    const overlayRmv = overlay.components.find(c => c.type === 'RenderMeshVisual');
    if (overlayRmv) {
      console.log('Configuring overlay RenderMeshVisual:', overlayRmv.id);
      await queryScene(`
        mutation {
          setMesh: setProperty(id: "${overlayRmv.id}", propertyPath: "mesh", value: "${planeMeshId}", valueType: REFERENCE) { success }
          setMat: setProperty(id: "${overlayRmv.id}", propertyPath: "mainMaterial", value: "${overlayMatId}", valueType: REFERENCE) { success }
        }
      `);
    }
  }

  // Step 4: Ensure Mat_Whiteboard and Mat_DiagramOverlay have passInfos configured
  console.log('Ensuring materials have ENABLE_BASE_TEX and textures...');
  await queryAsset(`
    mutation {
      p1: setProperty(id: "${whiteboardMatId}", propertyPath: "passInfos.0.ENABLE_BASE_TEX", value: true, valueType: BOOLEAN) { success }
      p2: setProperty(id: "${overlayMatId}", propertyPath: "passInfos.0.ENABLE_BASE_TEX", value: true, valueType: BOOLEAN) { success }
      t1: setProperty(id: "${whiteboardMatId}", propertyPath: "passInfos.0.baseTex", value: "6c0b8b91-d00f-43cf-8d9f-5a0f4eda2ac2", valueType: REFERENCE) { success }
      t2: setProperty(id: "${overlayMatId}", propertyPath: "passInfos.0.baseTex", value: "9c683a9f-bfaa-444d-8dd7-7d8b95f9bb68", valueType: REFERENCE) { success }
      b2: setProperty(id: "${overlayMatId}", propertyPath: "passInfos.0.blendMode", value: "Normal", valueType: ENUM, enumType: "Editor.Assets.BlendMode") { success }
    }
  `);

  // Step 5: Ensure BtnUpdateSnapshot and BtnConcludeMeeting exist under SIKPinchPaletteRoot
  if (paletteRootId) {
    const btnUpdate = findObj('BtnUpdateSnapshot');
    if (!btnUpdate) {
      console.log('Creating BtnUpdateSnapshot...');
      const createU = await queryScene(`
        mutation {
          createSceneObject(name: "BtnUpdateSnapshot", parentId: "${paletteRootId}") { id }
        }
      `);
      const uId = createU.data.createSceneObject.id;
      const compU = await queryScene(`
        mutation {
          rmv: addComponent(id: "${uId}", componentType: "RenderMeshVisual") { id }
          col: addComponent(id: "${uId}", componentType: "ColliderComponent") { id }
          sc: addComponent(id: "${uId}", componentType: "ScriptComponent") { id }
          txt: addComponent(id: "${uId}", componentType: "Text") { id }
          tf: setLocalTransform(
            id: "${uId}"
            position: { x: 0, y: -10, z: 0 }
            scale: { x: 18, y: 4.5, z: 1.5 }
          ) { success }
        }
      `);
      const rmvId = compU.data.rmv.id;
      const scId = compU.data.sc.id;
      const txtId = compU.data.txt.id;
      await queryScene(`
        mutation {
          setMesh: setProperty(id: "${rmvId}", propertyPath: "mesh", value: "${buttonBoxMeshId}", valueType: REFERENCE) { success }
          setMat: setProperty(id: "${rmvId}", propertyPath: "mainMaterial", value: "${buttonMatId}", valueType: REFERENCE) { success }
          setScript: setProperty(id: "${scId}", propertyPath: "scriptAsset", value: "${interactableScriptId}", valueType: REFERENCE) { success }
          setText: setProperty(id: "${txtId}", propertyPath: "text", value: "📸 Update / Snapshot", valueType: STRING) { success }
          setSize: setProperty(id: "${txtId}", propertyPath: "size", value: 1.5, valueType: NUMBER) { success }
        }
      `);
      console.log('BtnUpdateSnapshot created and configured.');
    } else {
      console.log('BtnUpdateSnapshot already exists.');
    }

    const btnConclude = findObj('BtnConcludeMeeting');
    if (!btnConclude) {
      console.log('Creating BtnConcludeMeeting...');
      const createC = await queryScene(`
        mutation {
          createSceneObject(name: "BtnConcludeMeeting", parentId: "${paletteRootId}") { id }
        }
      `);
      const cId = createC.data.createSceneObject.id;
      const compC = await queryScene(`
        mutation {
          rmv: addComponent(id: "${cId}", componentType: "RenderMeshVisual") { id }
          col: addComponent(id: "${cId}", componentType: "ColliderComponent") { id }
          sc: addComponent(id: "${cId}", componentType: "ScriptComponent") { id }
          txt: addComponent(id: "${cId}", componentType: "Text") { id }
          tf: setLocalTransform(
            id: "${cId}"
            position: { x: 0, y: -16, z: 0 }
            scale: { x: 18, y: 4.5, z: 1.5 }
          ) { success }
        }
      `);
      const rmvId = compC.data.rmv.id;
      const scId = compC.data.sc.id;
      const txtId = compC.data.txt.id;
      await queryScene(`
        mutation {
          setMesh: setProperty(id: "${rmvId}", propertyPath: "mesh", value: "${buttonBoxMeshId}", valueType: REFERENCE) { success }
          setMat: setProperty(id: "${rmvId}", propertyPath: "mainMaterial", value: "${buttonMatId}", valueType: REFERENCE) { success }
          setScript: setProperty(id: "${scId}", propertyPath: "scriptAsset", value: "${interactableScriptId}", valueType: REFERENCE) { success }
          setText: setProperty(id: "${txtId}", propertyPath: "text", value: "✓ Conclude Meeting", valueType: STRING) { success }
          setSize: setProperty(id: "${txtId}", propertyPath: "size", value: 1.5, valueType: NUMBER) { success }
        }
      `);
      console.log('BtnConcludeMeeting created and configured.');
    } else {
      console.log('BtnConcludeMeeting already exists.');
    }
  }

  // Step 6: Ensure LeafIndex exists
  let leafIndex = findObj('LeafIndex');
  if (!leafIndex) {
    console.log('Creating LeafIndex root object...');
    const createL = await queryScene(`
      mutation {
        createSceneObject(name: "LeafIndex", parentId: null) { id }
      }
    `);
    const lId = createL.data.createSceneObject.id;
    const compL = await queryScene(`
      mutation {
        sc: addComponent(id: "${lId}", componentType: "Component.ScriptComponent") { id }
      }
    `);
    const scId = compL.data.sc.id;
    await queryScene(`
      mutation {
        setScript: setProperty(id: "${scId}", propertyPath: "scriptAsset", value: "${leafIndexScriptId}", valueType: REFERENCE) {
          success
        }
      }
    `);
    console.log('LeafIndex created and configured with LeafIndex.ts scriptAsset.');
  } else {
    console.log('LeafIndex already exists.');
  }

  // Step 7: SIK palette placement
  if (paletteRootId) {
    console.log('Setting SIK palette position to left of whiteboard...');
    await queryScene(`
      mutation {
        setLocalTransform(
          id: "${paletteRootId}"
          position: { x: -85, y: 25, z: -190 }
          rotation: { x: 0, y: 18, z: 0 }
          scale: { x: 1, y: 1, z: 1 }
        ) { id }
      }
    `);
  }

  console.log('=== All objects and components restored successfully! ===');
}

main().catch(console.error);
