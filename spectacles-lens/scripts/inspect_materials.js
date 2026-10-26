const http = require('http');

function call(tool, args) {
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
  const code = `
    const model = pluginSystem.findInterface(Editor.Model.IModel);
    const scene = model.project.scene;
    const bp = scene.sceneObjects.find(o => o.name === 'WhiteboardBackplate');
    const rmv = bp ? bp.components.find(c => c.name === 'Render Mesh Visual') : null;
    const mat = rmv ? rmv.mainMaterial : null;
    const orb = scene.sceneObjects.find(o => o.name === 'AgentOrbMesh');
    const orbRmv = orb ? orb.components.find(c => c.name === 'Render Mesh Visual') : null;
    const orbMat = orbRmv ? orbRmv.mainMaterial : null;
    const btn = scene.sceneObjects.find(o => o.name === 'BtnAddDecision');
    const btnRmv = btn ? btn.components.find(c => c.name === 'Render Mesh Visual') : null;
    const btnMat = btnRmv ? btnRmv.mainMaterial : null;

    const getProps = m => {
      if (!m || !m.passInfos || !m.passInfos[0]) return null;
      const p = m.passInfos[0];
      return {
        baseColor: p.baseColor ? { x: p.baseColor.x, y: p.baseColor.y, z: p.baseColor.z, w: p.baseColor.w } : null,
        baseTex: p.baseTex ? p.baseTex.name : null,
        enableBaseTex: p.ENABLE_BASE_TEX,
        blendMode: p.blendMode
      };
    };

    return JSON.stringify({
      bp: getProps(mat),
      orb: getProps(orbMat),
      btn: getProps(btnMat)
    }, null, 2);
  `;
  const res = await call('ExecuteEditorCode', { code });
  console.log(res.result ? res.result.content[0].text : JSON.stringify(res));
}

main().catch(console.error);
