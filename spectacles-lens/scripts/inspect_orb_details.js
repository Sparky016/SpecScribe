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
      res.on('end', () => resolve(JSON.parse(data)));
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

async function main() {
  const code = `
    const model = pluginSystem.findInterface(Editor.Model.IModel);
    const scene = model.project.scene;
    
    function dumpObj(name) {
      let target = null;
      function walk(o) {
        if (o.name === name) target = o;
        if (o.children) o.children.forEach(walk);
      }
      scene.sceneObjects.forEach(walk);
      if (!target) return { found: false };
      
      const comps = target.components.map(c => {
        const info: any = { name: c.name, type: (c as any).typeName || c.constructor.name };
        if ((c as any).mesh) info.mesh = (c as any).mesh.name;
        if ((c as any).materials) info.materials = (c as any).materials.map((m: any) => m ? m.name : 'null');
        return info;
      });
      return {
        found: true,
        name: target.name,
        enabled: target.enabled,
        parent: target.parent ? target.parent.name : null,
        localPos: target.localTransform.position,
        localScale: target.localTransform.scale,
        components: comps
      };
    }
    
    return JSON.stringify({
      orb: dumpObj('AgentOrbMesh'),
      agent: dumpObj('RaisingHandAgentRoot'),
      palette: dumpObj('SIKPinchPaletteRoot'),
      btn1: dumpObj('BtnAddDecision'),
      backplate: dumpObj('WhiteboardBackplate')
    }, null, 2);
  `;

  const res = await callMcp('ExecuteEditorCode', { code });
  console.log(res.result ? res.result.content[0].text : JSON.stringify(res));
}

main().catch(console.error);
