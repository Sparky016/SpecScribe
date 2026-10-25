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

async function captureShot(filename) {
  for (let i = 0; i < 5; i++) {
    const shot = await callMcp('CapturePanelScreenshotTool', { pluginId: 'Snap.Plugin.Gui.PreviewPanel' });
    if (shot && shot.result && shot.result.content && shot.result.content[0] && shot.result.content[0].data) {
      const buf = Buffer.from(shot.result.content[0].data, 'base64');
      fs.writeFileSync(`c:/Users/ruanc/source/repos/SpecScribe/${filename}`, buf);
      fs.writeFileSync(`C:/Users/ruanc/.gemini/antigravity-ide/brain/a1d49ac0-9611-4865-a573-37788258aacb/${filename}`, buf);
      console.log(`Saved ${filename} (${buf.length} bytes)`);
      return;
    }
    console.log(`Waiting for preview capture retry ${i + 1}...`);
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`Failed to capture ${filename}`);
}

async function main() {
  console.log('1. Recompiling TypeScript...');
  await callMcp('RecompileTypeScriptTool', {});
  await new Promise(r => setTimeout(r, 1500));

  console.log('2. Resetting preview panel...');
  await callMcp('PreviewPanelTool', { action: 'refresh' });
  await new Promise(r => setTimeout(r, 4000));

  console.log('3. Capturing State 1: Area Selection Mode (Selection reticle, zero drawings)...');
  await captureShot('preview_state1_select_area.jpg');

  console.log('4. Executing demo-select-whiteboard scenario...');
  const resSel = await callMcp('run_leaf_scenario', { scenarioId: 'demo-select-whiteboard' });
  console.log('demo-select-whiteboard result:', JSON.stringify(resSel, null, 2));
  await new Promise(r => setTimeout(r, 1500));

  console.log('5. Capturing State 2: Clean Whiteboard (Area selected, board pristine with 0 drawings)...');
  await captureShot('preview_state2_clean_whiteboard.jpg');

  console.log('6. Executing demo-start-drawing scenario...');
  const resDraw = await callMcp('run_leaf_scenario', { scenarioId: 'demo-start-drawing' });
  console.log('demo-start-drawing result:', JSON.stringify(resDraw, null, 2));
  await new Promise(r => setTimeout(r, 1500));

  console.log('7. Capturing State 3: Drawing Ingested & Active (Marker sketches + Sugiyama DAG overlay)...');
  await captureShot('preview_state3_drawing_active.jpg');

  console.log('All 3 state screenshots captured successfully!');
}

main().catch(console.error);
