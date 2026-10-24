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

async function execLensScript(code) {
  return await callMcp('ExecuteEditorCode', {
    code: `
      const sc = pluginSystem.findInterface(Editor.Model.IModel);
      // Execute in editor
    `
  });
}

async function main() {
  console.log('1. Restarting Preview...');
  await callMcp('PreviewPanelTool', { action: 'restart' });
  await new Promise(r => setTimeout(r, 2000));

  console.log('2. Capturing State 1: Selection Mode (Initial state, selection reticle, no drawings)...');
  const shot1 = await callMcp('CapturePanelScreenshotTool', { pluginId: 'Snap.Plugin.Gui.PreviewPanel' });
  fs.writeFileSync('c:/Users/ruanc/source/repos/SpecScribe/preview_state1_select_area.jpg', Buffer.from(shot1.result.content[0].data, 'base64'));
  fs.writeFileSync('C:/Users/ruanc/.gemini/antigravity-ide/brain/a1d49ac0-9611-4865-a573-37788258aacb/preview_state1_select_area.jpg', Buffer.from(shot1.result.content[0].data, 'base64'));
  console.log('Saved preview_state1_select_area.jpg');
}

main().catch(console.error);
