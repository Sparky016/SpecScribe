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
      params: { name: tool, arguments: args }
    }));
    req.end();
  });
}

async function queryScene(query) {
  const res = await callMcp('scene-graphql', { query });
  if (res.result && res.result.content && res.result.content[0]) {
    try {
      const parsed = JSON.parse(res.result.content[0].text);
      if (parsed.errors) {
        console.error('GraphQL Error:', JSON.stringify(parsed.errors, null, 2));
      }
      return parsed;
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
  console.log('=== Step 1: Querying scene objects ===');
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

  // Key IDs
  const planeMeshId = "1d1de908-3f6f-4db5-9307-716d2834bd0c"; // Mesh_WhiteboardPlane
  const sphereMeshId = "07ac6e93-c852-43d1-8b2f-2efc4777e172"; // Mesh_OrbSphere
  const ringMeshId = "f2eba27f-41e3-4421-8af5-9ebc21ca6475"; // Mesh_RingTorus
  const buttonBoxMeshId = "bca4812a-983e-4e68-b0da-7fe482703084"; // Mesh_ButtonBox

  const whiteboardMatId = "7fd6b2df-8198-43f5-9d90-03f0f34b6578"; // Mat_Whiteboard
  const overlayMatId = "3903e607-a6ab-4834-8994-c68878836d0e"; // Mat_DiagramOverlay
  const buttonMatId = "d761a15c-0e9d-4869-b66f-3f3fb6d824e0"; // Mat_ButtonBackplate
  const agentOrbMatId = "57f031be-0c46-4d86-b2c5-85201a4915ca"; // Mat_AgentOrb
  const chimeAudioId = "1e3680e1-caa8-4783-8d00-4ec0c811ea27"; // AgentNotificationChime

  const interactableScriptId = "652e631a-22d0-4941-9f74-2943df59f34c";
  const manipScriptId = "664b556b-1946-4c2c-866a-e675b4e86006";
  const leafIndexScriptId = "243cd8ff-751c-4901-8766-b22457302861";

  const camObj = findObj('Camera Object');
  const camId = camObj ? camObj.id : "00000000-0000-0065-0000-000000000064";

  // Step 2: Ensure SpatialHUDRoot is unparented from Camera Object (at Scene Root)
  const spatialHud = findObj('SpatialHUDRoot');
  if (!spatialHud) {
    throw new Error('SpatialHUDRoot not found!');
  }
  const spatialHudId = spatialHud.id;
  console.log(`Setting SpatialHUDRoot (${spatialHudId}) parent to null (Scene Root)...`);
  await queryScene(`
    mutation {
      setParent(id: "${spatialHudId}", parentId: null) { id name }
      setLocalTransform(
        id: "${spatialHudId}"
        position: { x: 0, y: 0, z: 0 }
        rotation: { x: 0, y: 0, z: 0 }
        scale: { x: 1, y: 1, z: 1 }
      ) { success }
    }
  `);

  // Step 3: Ensure WhiteboardBackplate exists, is parented to SpatialHUDRoot, and stands upright on the room wall
  let backplate = findObj('WhiteboardBackplate');
  let backplateId = backplate ? backplate.id : null;
  if (!backplate) {
    console.log('Creating WhiteboardBackplate...');
    const createRes = await queryScene(`
      mutation {
        createSceneObject(name: "WhiteboardBackplate", parentId: "${spatialHudId}") { id name }
      }
    `);
    backplateId = createRes.data.createSceneObject.id;
  } else {
    console.log(`Reparenting WhiteboardBackplate (${backplateId}) to SpatialHUDRoot...`);
    await queryScene(`
      mutation {
        setParent(id: "${backplateId}", parentId: "${spatialHudId}") { id name }
      }
    `);
  }

  // Set upright transform on wall (rotation: 90 on X, position: y=46, z=-230, scale: 140, 1, 90)
  console.log('Setting WhiteboardBackplate wall-mounted upright transform...');
  await queryScene(`
    mutation {
      setLocalTransform(
        id: "${backplateId}"
        position: { x: 0, y: 46, z: -230 }
        rotation: { x: 90, y: 0, z: 0 }
        scale: { x: 140, y: 1, z: 90 }
      ) { success }
    }
  `);

  // Ensure components on WhiteboardBackplate
  backplate = (await queryScene(`query { sceneObject(id: "${backplateId}") { id components { id type } } }`)).data.sceneObject;
  let bpRmv = backplate.components.find(c => c.type === 'RenderMeshVisual');
  if (!bpRmv) {
    console.log('Adding RenderMeshVisual to WhiteboardBackplate...');
    const r = await queryScene(`mutation { addComponent(id: "${backplateId}", componentType: "RenderMeshVisual") { id } }`);
    bpRmv = r.data.addComponent;
  }
  let bpCol = backplate.components.find(c => c.type === 'ColliderComponent');
  if (!bpCol) {
    console.log('Adding ColliderComponent to WhiteboardBackplate...');
    await queryScene(`mutation { addComponent(id: "${backplateId}", componentType: "ColliderComponent") { id } }`);
  }
  let bpScripts = backplate.components.filter(c => c.type === 'ScriptComponent');
  if (bpScripts.length < 2) {
    console.log('Adding ScriptComponents (Interactable & Manipulation) to WhiteboardBackplate...');
    const s1 = await queryScene(`mutation { addComponent(id: "${backplateId}", componentType: "ScriptComponent") { id } }`);
    const s2 = await queryScene(`mutation { addComponent(id: "${backplateId}", componentType: "ScriptComponent") { id } }`);
    await queryScene(`
      mutation {
        set1: setProperty(id: "${s1.data.addComponent.id}", propertyPath: "scriptAsset", value: "${interactableScriptId}", valueType: REFERENCE) { success }
        set2: setProperty(id: "${s2.data.addComponent.id}", propertyPath: "scriptAsset", value: "${manipScriptId}", valueType: REFERENCE) { success }
      }
    `);
  }
  await queryScene(`
    mutation {
      setMesh: setProperty(id: "${bpRmv.id}", propertyPath: "mesh", value: "${planeMeshId}", valueType: REFERENCE) { success }
      setMat: setProperty(id: "${bpRmv.id}", propertyPath: "mainMaterial", value: "${whiteboardMatId}", valueType: REFERENCE) { success }
    }
  `);

  // Step 4: Configure WhiteboardOverlayAnchor under WhiteboardBackplate
  let overlay = findObj('WhiteboardOverlayAnchor');
  if (overlay) {
    console.log(`Configuring WhiteboardOverlayAnchor (${overlay.id}) under WhiteboardBackplate...`);
    await queryScene(`
      mutation {
        setParent(id: "${overlay.id}", parentId: "${backplateId}") { id name }
        setLocalTransform(
          id: "${overlay.id}"
          position: { x: 0, y: 0.1, z: 0 }
          rotation: { x: 0, y: 0, z: 0 }
          scale: { x: 0.97, y: 1.0, z: 0.96 }
        ) { success }
      }
    `);
    const ovRmv = overlay.components.find(c => c.type === 'RenderMeshVisual');
    if (ovRmv) {
      await queryScene(`
        mutation {
          setMesh: setProperty(id: "${ovRmv.id}", propertyPath: "mesh", value: "${planeMeshId}", valueType: REFERENCE) { success }
          setMat: setProperty(id: "${ovRmv.id}", propertyPath: "mainMaterial", value: "${overlayMatId}", valueType: REFERENCE) { success }
        }
      `);
    }
  }

  // Step 5: DiffToastText on Wall above whiteboard
  const toast = findObj('DiffToastText');
  if (toast) {
    console.log(`Positioning DiffToastText (${toast.id}) above Whiteboard on Wall...`);
    await queryScene(`
      mutation {
        setParent(id: "${toast.id}", parentId: "${spatialHudId}") { id name }
        setLocalTransform(
          id: "${toast.id}"
          position: { x: 0, y: 96, z: -228 }
          rotation: { x: 0, y: 0, z: 0 }
          scale: { x: 1, y: 1, z: 1 }
        ) { success }
      }
    `);
    const toastComp = toast.components.find(c => c.type === 'Text');
    if (toastComp) {
      await queryScene(`
        mutation {
          setSize: setProperty(id: "${toastComp.id}", propertyPath: "size", value: 12, valueType: NUMBER) { success }
        }
      `);
    }
  }

  // Step 6: Configure SIKPinchPaletteRoot and all 6 Palette Buttons
  const paletteRoot = findObj('SIKPinchPaletteRoot');
  const paletteRootId = paletteRoot ? paletteRoot.id : null;
  if (paletteRootId) {
    console.log(`Positioning SIKPinchPaletteRoot (${paletteRootId}) to left of Whiteboard...`);
    await queryScene(`
      mutation {
        setParent(id: "${paletteRootId}", parentId: "${spatialHudId}") { id name }
        setLocalTransform(
          id: "${paletteRootId}"
          position: { x: -85, y: 25, z: -190 }
          rotation: { x: 0, y: 18, z: 0 }
          scale: { x: 1, y: 1, z: 1 }
        ) { success }
      }
    `);

    const buttonDefs = [
      { id: "e21c9cbc-d4c3-426b-8f7d-6a1d78dfea45", name: "BtnAddDecision", label: "◇ Decision", y: 15, w: 15 },
      { id: "a90dd370-9ce1-4589-826b-64940b241145", name: "BtnAddService", label: "▭ Service", y: 9, w: 15 },
      { id: "c9bf271d-c938-41bc-945d-236c7987ca43", name: "BtnAddDatabase", label: "🛢 Database", y: 3, w: 15 },
      { id: "3d0aea0d-655d-4729-8c2a-38eae528e068", name: "BtnAddTerminal", label: "○ Terminal", y: -3, w: 15 },
      { id: "0a2656c5-3d12-44d8-b0ee-ba9abfa5313e", name: "BtnUpdateSnapshot", label: "📸 Update Snapshot", y: -9, w: 18 },
      { id: "c9e42ff2-f061-4279-ae95-c5328f426f3d", name: "BtnConcludeMeeting", label: "✓ Conclude Session", y: -15, w: 18 }
    ];

    for (const b of buttonDefs) {
      console.log(`Configuring Button: ${b.name}...`);
      let btnObj = (await queryScene(`query { sceneObject(id: "${b.id}") { id components { id type } } }`)).data.sceneObject;
      if (!btnObj) {
        console.log(`Button ${b.name} does not exist, creating...`);
        const c = await queryScene(`mutation { createSceneObject(name: "${b.name}", parentId: "${paletteRootId}") { id } }`);
        b.id = c.data.createSceneObject.id;
        btnObj = (await queryScene(`query { sceneObject(id: "${b.id}") { id components { id type } } }`)).data.sceneObject;
      }

      await queryScene(`
        mutation {
          setLocalTransform(
            id: "${b.id}"
            position: { x: 0, y: ${b.y}, z: 0 }
            rotation: { x: 0, y: 0, z: 0 }
            scale: { x: ${b.w}, y: 4.5, z: 1.5 }
          ) { success }
        }
      `);

      let rmv = btnObj.components.find(c => c.type === 'RenderMeshVisual');
      if (!rmv) {
        const r = await queryScene(`mutation { addComponent(id: "${b.id}", componentType: "RenderMeshVisual") { id } }`);
        rmv = r.data.addComponent;
      }
      let col = btnObj.components.find(c => c.type === 'ColliderComponent');
      if (!col) {
        await queryScene(`mutation { addComponent(id: "${b.id}", componentType: "ColliderComponent") { id } }`);
      }
      let sc = btnObj.components.find(c => c.type === 'ScriptComponent');
      if (!sc) {
        const s = await queryScene(`mutation { addComponent(id: "${b.id}", componentType: "ScriptComponent") { id } }`);
        sc = s.data.addComponent;
      }
      let txt = btnObj.components.find(c => c.type === 'Text');
      if (!txt) {
        const t = await queryScene(`mutation { addComponent(id: "${b.id}", componentType: "Text") { id } }`);
        txt = t.data.addComponent;
      }

      // Set properties
      await queryScene(`
        mutation {
          setMesh: setProperty(id: "${rmv.id}", propertyPath: "mesh", value: "${buttonBoxMeshId}", valueType: REFERENCE) { success }
          setMat: setProperty(id: "${rmv.id}", propertyPath: "mainMaterial", value: "${buttonMatId}", valueType: REFERENCE) { success }
          setScript: setProperty(id: "${sc.id}", propertyPath: "scriptAsset", value: "${interactableScriptId}", valueType: REFERENCE) { success }
          setText: setProperty(id: "${txt.id}", propertyPath: "text", value: "${b.label}", valueType: STRING) { success }
          setSize: setProperty(id: "${txt.id}", propertyPath: "size", value: 1.5, valueType: NUMBER) { success }
        }
      `);
    }
  }

  // Step 7: Configure RaisingHandAgentRoot & AI Orb anchored to Camera Object (top-right of view!)
  const agentRoot = findObj('RaisingHandAgentRoot');
  if (agentRoot) {
    const agentRootId = agentRoot.id;
    console.log(`Anchoring RaisingHandAgentRoot (${agentRootId}) to Camera Object (${camId}) view top-right...`);
    await queryScene(`
      mutation {
        setParent(id: "${agentRootId}", parentId: "${camId}") { id name }
        setLocalTransform(
          id: "${agentRootId}"
          position: { x: 26, y: 13, z: -65 }
          rotation: { x: 6, y: -12, z: 0 }
          scale: { x: 1, y: 1, z: 1 }
        ) { success }
      }
    `);

    // AgentOrbMesh
    const orbObj = findObj('AgentOrbMesh');
    if (orbObj) {
      console.log(`Configuring AgentOrbMesh (${orbObj.id})...`);
      await queryScene(`
        mutation {
          setLocalTransform(
            id: "${orbObj.id}"
            position: { x: 0, y: 0, z: 0 }
            rotation: { x: 0, y: 0, z: 0 }
            scale: { x: 6, y: 6, z: 6 }
          ) { success }
        }
      `);
      let orbRmv = orbObj.components.find(c => c.type === 'RenderMeshVisual');
      if (!orbRmv) {
        const r = await queryScene(`mutation { addComponent(id: "${orbObj.id}", componentType: "RenderMeshVisual") { id } }`);
        orbRmv = r.data.addComponent;
      }
      let orbCol = orbObj.components.find(c => c.type === 'ColliderComponent');
      if (!orbCol) {
        await queryScene(`mutation { addComponent(id: "${orbObj.id}", componentType: "ColliderComponent") { id } }`);
      }
      let orbSc = orbObj.components.find(c => c.type === 'ScriptComponent');
      if (!orbSc) {
        const s = await queryScene(`mutation { addComponent(id: "${orbObj.id}", componentType: "ScriptComponent") { id } }`);
        orbSc = s.data.addComponent;
      }
      await queryScene(`
        mutation {
          setMesh: setProperty(id: "${orbRmv.id}", propertyPath: "mesh", value: "${sphereMeshId}", valueType: REFERENCE) { success }
          setMat: setProperty(id: "${orbRmv.id}", propertyPath: "mainMaterial", value: "${agentOrbMatId}", valueType: REFERENCE) { success }
          setScript: setProperty(id: "${orbSc.id}", propertyPath: "scriptAsset", value: "${interactableScriptId}", valueType: REFERENCE) { success }
        }
      `);
    }

    // ResearchingRingMesh
    const ringObj = findObj('ResearchingRingMesh');
    if (ringObj) {
      console.log(`Configuring ResearchingRingMesh (${ringObj.id})...`);
      let ringRmv = ringObj.components.find(c => c.type === 'RenderMeshVisual');
      if (!ringRmv) {
        const r = await queryScene(`mutation { addComponent(id: "${ringObj.id}", componentType: "RenderMeshVisual") { id } }`);
        ringRmv = r.data.addComponent;
      }
      await queryScene(`
        mutation {
          setMesh: setProperty(id: "${ringRmv.id}", propertyPath: "mesh", value: "${ringMeshId}", valueType: REFERENCE) { success }
          setMat: setProperty(id: "${ringRmv.id}", propertyPath: "mainMaterial", value: "${agentOrbMatId}", valueType: REFERENCE) { success }
          setLocalTransform(
            id: "${ringObj.id}"
            position: { x: 0, y: 0, z: 0 }
            rotation: { x: 0, y: 0, z: 0 }
            scale: { x: 8, y: 8, z: 1 }
          ) { success }
          setEnabled(id: "${ringObj.id}", enabled: false) { success }
        }
      `);
    }

    // HandRaisedPillBadge
    const pillObj = findObj('HandRaisedPillBadge');
    if (pillObj) {
      console.log(`Configuring HandRaisedPillBadge (${pillObj.id})...`);
      let pillTxt = pillObj.components.find(c => c.type === 'Text');
      if (!pillTxt) {
        const t = await queryScene(`mutation { addComponent(id: "${pillObj.id}", componentType: "Text") { id } }`);
        pillTxt = t.data.addComponent;
      }
      await queryScene(`
        mutation {
          setText: setProperty(id: "${pillTxt.id}", propertyPath: "text", value: "[AI]: Architecture Review Ready", valueType: STRING) { success }
          setSize: setProperty(id: "${pillTxt.id}", propertyPath: "size", value: 1.5, valueType: NUMBER) { success }
          setLocalTransform(
            id: "${pillObj.id}"
            position: { x: 0, y: 5.5, z: 0 }
            rotation: { x: 0, y: 0, z: 0 }
            scale: { x: 1, y: 1, z: 1 }
          ) { success }
          setEnabled(id: "${pillObj.id}", enabled: false) { success }
        }
      `);
    }

    // ExpandedCritiqueCard
    const cardObj = findObj('ExpandedCritiqueCard');
    if (cardObj) {
      console.log(`Configuring ExpandedCritiqueCard (${cardObj.id})...`);
      let cardTxt = cardObj.components.find(c => c.type === 'Text');
      if (!cardTxt) {
        const t = await queryScene(`mutation { addComponent(id: "${cardObj.id}", componentType: "Text") { id } }`);
        cardTxt = t.data.addComponent;
      }
      await queryScene(`
        mutation {
          setText: setProperty(id: "${cardTxt.id}", propertyPath: "text", value: "• Critique: Missing auth check\\n• Risk: Privilege escalation\\n• Suggestion: Add JWT validator", valueType: STRING) { success }
          setSize: setProperty(id: "${cardTxt.id}", propertyPath: "size", value: 1.2, valueType: NUMBER) { success }
          setLocalTransform(
            id: "${cardObj.id}"
            position: { x: -8, y: -9, z: 0 }
            rotation: { x: 0, y: 0, z: 0 }
            scale: { x: 1, y: 1, z: 1 }
          ) { success }
          setEnabled(id: "${cardObj.id}", enabled: false) { success }
        }
      `);
    }

    // AgentVoicePlayer
    const voiceObj = findObj('AgentVoicePlayer');
    if (voiceObj) {
      console.log(`Configuring AgentVoicePlayer (${voiceObj.id})...`);
      let audioComp = voiceObj.components.find(c => c.type === 'AudioComponent');
      if (!audioComp) {
        const a = await queryScene(`mutation { addComponent(id: "${voiceObj.id}", componentType: "AudioComponent") { id } }`);
        audioComp = a.data.addComponent;
      }
      await queryScene(`
        mutation {
          setAudio: setProperty(id: "${audioComp.id}", propertyPath: "audioTrack", value: "${chimeAudioId}", valueType: REFERENCE) { success }
        }
      `);
    }
  }

  // Step 8: Ensure LeafIndex exists at Scene Root
  let leafIndex = findObj('LeafIndex');
  if (!leafIndex) {
    console.log('Creating LeafIndex at Scene Root...');
    const lRes = await queryScene(`mutation { createSceneObject(name: "LeafIndex", parentId: null) { id } }`);
    const lId = lRes.data.createSceneObject.id;
    const compRes = await queryScene(`mutation { addComponent(id: "${lId}", componentType: "ScriptComponent") { id } }`);
    await queryScene(`mutation { setProperty(id: "${compRes.data.addComponent.id}", propertyPath: "scriptAsset", value: "${leafIndexScriptId}", valueType: REFERENCE) { success } }`);
  }

  // Step 9: Configure Materials passInfos (ENABLE_BASE_TEX, baseTex)
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

  console.log('=== Scene Restoration Complete! Taking verification screenshot... ===');
  await new Promise(r => setTimeout(r, 800));
  const shot = await callMcp('CapturePanelScreenshotTool', { pluginId: 'Snap.Plugin.Gui.PreviewPanel' });
  if (shot.result && shot.result.content && shot.result.content[0] && shot.result.content[0].data) {
    const buf = Buffer.from(shot.result.content[0].data, 'base64');
    fs.writeFileSync('C:/Users/ruanc/.gemini/antigravity-ide/brain/a1d49ac0-9611-4865-a573-37788258aacb/preview_repaired_scene.jpg', buf);
    console.log('Saved preview_repaired_scene.jpg, length:', buf.length);
  }
}

main().catch(console.error);
