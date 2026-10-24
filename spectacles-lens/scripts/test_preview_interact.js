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

async function main() {
  console.log('1. Resetting preview to clean state...');
  await callMcp('PreviewPanelTool', { action: 'restart' });
  await new Promise(r => setTimeout(r, 2000));

  console.log('2. Capturing State 1: Selection Mode...');
  const shot1 = await callMcp('CapturePanelScreenshotTool', { pluginId: 'Snap.Plugin.Gui.PreviewPanel' });
  fs.writeFileSync('c:/Users/ruanc/source/repos/SpecScribe/preview_state1_select_area.jpg', Buffer.from(shot1.result.content[0].data, 'base64'));

  console.log('3. Pinching WhiteboardBackplate to select area...');
  const resPinch = await callMcp('PreviewInteractTool', {
    action: 'Pinch',
    name: 'WhiteboardBackplate'
  });
  console.log('Pinch WhiteboardBackplate result:', JSON.stringify(resPinch, null, 2));
  await new Promise(r => setTimeout(r, 1000));

  console.log('4. Capturing State 2: Clean Whiteboard (Area Selected)...');
  const shot2 = await callMcp('CapturePanelScreenshotTool', { pluginId: 'Snap.Plugin.Gui.PreviewPanel' });
  fs.writeFileSync('c:/Users/ruanc/source/repos/SpecScribe/preview_state2_clean_whiteboard.jpg', Buffer.from(shot2.result.content[0].data, 'base64'));

  console.log('5. Pinching WhiteboardBackplate again to start drawings / ingestion...');
  const resDraw = await callMcp('PreviewInteractTool', {
    action: 'Pinch',
    name: 'WhiteboardBackplate'
  });
  console.log('Pinch 2 result:', JSON.stringify(resDraw, null, 2));
  await new Promise(r => setTimeout(r, 1000));

  console.log('6. Capturing State 3: Drawing Ingested & Active...');
  const shot3 = await callMcp('CapturePanelScreenshotTool', { pluginId: 'Snap.Plugin.Gui.PreviewPanel' });
  fs.writeFileSync('c:/Users/ruanc/source/repos/SpecScribe/preview_state3_drawing_active.jpg', Buffer.from(shot3.result.content[0].data, 'base64'));
}

main().catch(console.error);
