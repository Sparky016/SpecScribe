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
      params: { name: tool, arguments: args }
    }));
    req.end();
  });
}

async function main() {
  const code = `
    const model = pluginSystem.findInterface(Editor.Model.IModel);
    const scene = model.project.scene;
    
    function findObj(n: string) {
      let found: any = null;
      function walk(o: any) {
        if (o.name === n) found = o;
        if (o.children) o.children.forEach(walk);
      }
      scene.sceneObjects.forEach(walk);
      return found;
    }

    const cam = findObj('Camera Object');
    const hud = findObj('SpatialHUDRoot');
    const wb = findObj('WhiteboardBackplate');
    const pal = findObj('SIKPinchPaletteRoot');
    const toast = findObj('DiffToastText');
    const agent = findObj('RaisingHandAgentRoot');

    if (hud) {
      hud.parent = null;
      hud.localTransform.position = new vec3(0, 0, 0);
      hud.localTransform.rotation = new vec3(0, 0, 0);
      hud.localTransform.scale = new vec3(1, 1, 1);
    }

    if (wb) {
      wb.parent = hud;
      wb.localTransform.position = new vec3(50, 180, -230);
      wb.localTransform.rotation = new vec3(90, 0, 0);
      wb.localTransform.scale = new vec3(140, 1, 90);
    }

    if (pal) {
      pal.parent = hud;
      pal.localTransform.position = new vec3(-35, 140, -180);
      pal.localTransform.rotation = new vec3(0, 15, 0);
      pal.localTransform.scale = new vec3(1, 1, 1);
    }

    if (toast) {
      toast.parent = hud;
      toast.localTransform.position = new vec3(50, 235, -228);
    }

    if (agent && cam) {
      agent.parent = cam;
      agent.localTransform.position = new vec3(12, 7.5, -50);
      agent.localTransform.rotation = new vec3(4, -10, 0);
      agent.localTransform.scale = new vec3(1, 1, 1);
    }

    return JSON.stringify({
      status: 'positioned',
      wbPos: wb ? wb.localTransform.position : null,
      palPos: pal ? pal.localTransform.position : null,
      agentParent: agent && agent.parent ? agent.parent.name : null,
      agentPos: agent ? agent.localTransform.position : null
    });
  `;

  const res = await callMcp('ExecuteEditorCode', { code });
  console.log(res.result ? res.result.content[0].text : JSON.stringify(res));
}

main().catch(console.error);
