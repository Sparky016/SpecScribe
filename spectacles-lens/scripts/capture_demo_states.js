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

function saveShot(base64Data, filename) {
  const buf = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(`c:/Users/ruanc/source/repos/SpecScribe/${filename}`, buf);
  fs.writeFileSync(`C:/Users/ruanc/.gemini/antigravity-ide/brain/a1d49ac0-9611-4865-a573-37788258aacb/${filename}`, buf);
  console.log(`Saved ${filename}`);
}

async function main() {
  console.log('1. Recompiling TypeScript...');
  await callMcp('RecompileTypeScriptTool', {});

  console.log('2. Resetting preview panel...');
  await callMcp('PreviewPanelTool', { action: 'restart' });
  await new Promise(r => setTimeout(r, 2200));

  console.log('3. Capturing State 1: Area Selection Mode (Selection reticle, zero drawings)...');
  let shot1 = await callMcp('CapturePanelScreenshotTool', { pluginId: 'Snap.Plugin.Gui.PreviewPanel' });
  saveShot(shot1.result.content[0].data, 'preview_state1_select_area.jpg');

  console.log('4. Executing demo-select-whiteboard scenario...');
  await callMcp('run_leaf_scenario', { scenarioId: 'demo-select-whiteboard' });
  await new Promise(r => setTimeout(r, 800));

  console.log('5. Capturing State 2: Clean Whiteboard (Area selected, board pristine with 0 drawings)...');
  let shot2 = await callMcp('CapturePanelScreenshotTool', { pluginId: 'Snap.Plugin.Gui.PreviewPanel' });
  saveShot(shot2.result.content[0].data, 'preview_state2_clean_whiteboard.jpg');

  console.log('6. Executing demo-start-drawing scenario...');
  await callMcp('run_leaf_scenario', { scenarioId: 'demo-start-drawing' });
  await new Promise(r => setTimeout(r, 800));

  console.log('7. Capturing State 3: Drawing Ingested & Active (Marker sketches + Sugiyama DAG overlay)...');
  let shot3 = await callMcp('CapturePanelScreenshotTool', { pluginId: 'Snap.Plugin.Gui.PreviewPanel' });
  saveShot(shot3.result.content[0].data, 'preview_state3_drawing_active.jpg');

  console.log('All 3 state screenshots captured successfully!');
}

main().catch(console.error);
