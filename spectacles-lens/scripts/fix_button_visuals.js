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

    const pal = findObj('SIKPinchPaletteRoot');
    if (pal) {
      pal.localTransform.position = new vec3(-28, 175, -200);
      pal.localTransform.rotation = new vec3(0, 18, 0);
      pal.localTransform.scale = new vec3(1, 1, 1);
    }

    const btnNames = [
      'BtnAddDecision',
      'BtnAddService',
      'BtnAddDatabase',
      'BtnAddTerminal',
      'BtnUpdateSnapshot',
      'BtnConcludeMeeting'
    ];

    for (const name of btnNames) {
      const btn = findObj(name);
      if (btn) {
        const tc: any = btn.components.find((c: any) => c.name === 'Text');
        if (tc) {
          tc.renderOrder = 10;
        }
      }
    }

    const agent = findObj('RaisingHandAgentRoot');
    const cam = findObj('Camera Object');
    if (agent && cam) {
      agent.parent = cam;
      agent.localTransform.position = new vec3(12, 7.5, -50);
      agent.localTransform.rotation = new vec3(4, -10, 0);
      agent.localTransform.scale = new vec3(1, 1, 1);
    }

    return 'Updated button visuals, palette position, and agent camera anchor.';
  `;

  const res = await callMcp('ExecuteEditorCode', { code });
  console.log(res.result ? res.result.content[0].text : JSON.stringify(res));
}

main().catch(console.error);
