const http = require('http');

function call(tool, args) {
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
    
    function inspectObj(o) {
      if (!o) return null;
      const comps = o.components.map(c => {
        const res: any = {
          name: c.name,
          typeName: (c as any).typeName || c.constructor.name,
        };
        if (c.name === 'Text' || (c as any).text !== undefined) {
          const t = c as any;
          res.text = t.text;
          res.size = t.size;
          res.color = t.color ? { r: t.color.r, g: t.color.g, b: t.color.b, a: t.color.a } : null;
          res.horizontalOverflow = t.horizontalOverflow;
          res.verticalOverflow = t.verticalOverflow;
          res.horizontalAlignment = t.horizontalAlignment;
          res.verticalAlignment = t.verticalAlignment;
        }
        if (c.name === 'Render Mesh Visual' || (c as any).mesh !== undefined) {
          const rmv = c as any;
          res.mesh = rmv.mesh ? rmv.mesh.name : null;
          res.materials = rmv.materials ? rmv.materials.map((m: any) => m ? m.name : null) : null;
          res.renderOrder = rmv.renderOrder;
        }
        return res;
      });
      return {
        name: o.name,
        enabled: o.enabled,
        parent: o.parent ? o.parent.name : null,
        pos: { x: o.localTransform.position.x, y: o.localTransform.position.y, z: o.localTransform.position.z },
        scale: { x: o.localTransform.scale.x, y: o.localTransform.scale.y, z: o.localTransform.scale.z },
        rot: { x: o.localTransform.rotation.x, y: o.localTransform.rotation.y, z: o.localTransform.rotation.z, w: o.localTransform.rotation.w },
        children: o.children ? o.children.map(inspectObj) : [],
        components: comps
      };
    }

    const agentRoot = scene.sceneObjects.find(o => o.name === 'RaisingHandAgentRoot');
    const orb = scene.sceneObjects.find(o => o.name === 'AgentOrbMesh');
    const pill = scene.sceneObjects.find(o => o.name === 'HandRaisedPillBadge');
    const card = scene.sceneObjects.find(o => o.name === 'ExpandedCritiqueCard');

    return JSON.stringify({
      agentRoot: inspectObj(agentRoot),
      orb: inspectObj(orb),
      pill: inspectObj(pill),
      card: inspectObj(card)
    }, null, 2);
  `;

  const res = await call('ExecuteEditorCode', { code });
  console.log(res.result ? res.result.content[0].text : JSON.stringify(res, null, 2));
}

main().catch(console.error);
