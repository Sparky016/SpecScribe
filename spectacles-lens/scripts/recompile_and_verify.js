const http = require('http');
const fs = require('fs');

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

async function main() {
  console.log('1. Recompiling TypeScript in Lens Studio...');
  const comp = await callMcp('RecompileTypeScriptTool', {});
  console.log('Compile result:', JSON.stringify(comp, null, 2));

  console.log('2. Resetting Preview panel to start fresh...');
  await callMcp('PreviewPanelTool', { action: 'restart' });
  await new Promise(r => setTimeout(r, 2000));

  console.log('3. Capturing initial preview state (Area Selection mode, clean overlay)...');
  const shot1 = await callMcp('CapturePanelScreenshotTool', { pluginId: 'Snap.Plugin.Gui.PreviewPanel' });
  if (shot1.result && shot1.result.content && shot1.result.content[0].data) {
    const buf1 = Buffer.from(shot1.result.content[0].data, 'base64');
    fs.writeFileSync('c:/Users/ruanc/source/repos/SpecScribe/preview_state1_select_area.jpg', buf1);
    fs.writeFileSync('C:/Users/ruanc/.gemini/antigravity-ide/brain/a1d49ac0-9611-4865-a573-37788258aacb/preview_state1_select_area.jpg', buf1);
    console.log('Saved preview_state1_select_area.jpg');
  }

  console.log('4. Simulating Whiteboard Area Selection (via Preview tap)...');
  await callMcp('InjectPreviewGesture', { gestureType: 'tap', x: 0.5, y: 0.4 });
  await new Promise(r => setTimeout(r, 1000));

  console.log('5. Capturing State 2: Clean Whiteboard (Zero drawings, clean surface ready)...');
  const shot2 = await callMcp('CapturePanelScreenshotTool', { pluginId: 'Snap.Plugin.Gui.PreviewPanel' });
  if (shot2.result && shot2.result.content && shot2.result.content[0].data) {
    const buf2 = Buffer.from(shot2.result.content[0].data, 'base64');
    fs.writeFileSync('c:/Users/ruanc/source/repos/SpecScribe/preview_state2_clean_whiteboard.jpg', buf2);
    fs.writeFileSync('C:/Users/ruanc/.gemini/antigravity-ide/brain/a1d49ac0-9611-4865-a573-37788258aacb/preview_state2_clean_whiteboard.jpg', buf2);
    console.log('Saved preview_state2_clean_whiteboard.jpg');
  }

  console.log('6. Simulating Drawing start (via Preview tap)...');
  await callMcp('InjectPreviewGesture', { gestureType: 'tap', x: 0.5, y: 0.4 });
  await new Promise(r => setTimeout(r, 1000));

  console.log('7. Capturing State 3: Drawing Ingested & Active (Marker sketches + Sugiyama DAG overlay)...');
  const shot3 = await callMcp('CapturePanelScreenshotTool', { pluginId: 'Snap.Plugin.Gui.PreviewPanel' });
  if (shot3.result && shot3.result.content && shot3.result.content[0].data) {
    const buf3 = Buffer.from(shot3.result.content[0].data, 'base64');
    fs.writeFileSync('c:/Users/ruanc/source/repos/SpecScribe/preview_state3_drawing_active.jpg', buf3);
    fs.writeFileSync('C:/Users/ruanc/.gemini/antigravity-ide/brain/a1d49ac0-9611-4865-a573-37788258aacb/preview_state3_drawing_active.jpg', buf3);
    console.log('Saved preview_state3_drawing_active.jpg');
  }
}

main().catch(console.error);
