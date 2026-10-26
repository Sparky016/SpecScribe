const http = require('http');
const fs = require('fs');
const path = require('path');

const token = 'Gt0ObwXN9IV3ZQdjIcikYkRFixTh2tWCFSnItHtkC5iHp9qDqQ8pq0yvRA97OkVF';
const outDir = 'C:/Users/ruanc/.gemini/antigravity-ide/brain/ab5d3b86-3403-449e-8bcc-81f24251f4f4';

function callMcp(tool, args = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request('http://localhost:50040/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
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

async function capturePanel(filename) {
  const res = await callMcp('CapturePanelScreenshotTool', { pluginId: 'Snap.Plugin.Gui.PreviewPanel' });
  if (res.result && res.result.content) {
    const item = res.result.content.find(c => c.type === 'image');
    if (item && item.data) {
      const buf = Buffer.from(item.data, 'base64');
      const targetPath = path.join(outDir, filename);
      fs.writeFileSync(targetPath, buf);
      console.log(`[Captured] ${filename} (${buf.length} bytes)`);
      return targetPath;
    }
  }
  console.warn(`[Failed to capture] ${filename}`);
  return null;
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runSnippet(code) {
  const res = await callMcp('ExecuteEditorCode', { code });
  return res.result ? res.result.content[0].text : JSON.stringify(res);
}

async function main() {
  console.log('=== Capturing Full Demo Journey ===');

  console.log('0. Resetting Preview to clean initial state...');
  await callMcp('PreviewPanelTool', { action: 'restart' });
  await sleep(3500);

  console.log('1. Capturing Stage 1: Initial Calibration Mode (High on Wall)...');
  await capturePanel('demo_journey_01_select_area.jpg');

  console.log('2. Dragging Whiteboard Lower to Eye Level and Resizing...');
  await runSnippet(`
    const sm = (global as any).SpecScribeSpatialInterfaceManager;
    if (sm) {
      sm.dragWhiteboard(-30, 0);
      sm.resizeWhiteboard(120, 76);
      return 'OK';
    }
    return 'No SM';
  `);
  await sleep(1000);
  await capturePanel('demo_journey_02_lowered_resized.jpg');

  console.log('3. Pinching Center to Set -> Clean Whiteboard Ready...');
  await runSnippet(`
    const sm = (global as any).SpecScribeSpatialInterfaceManager;
    if (sm) {
      sm.pinchCenterToSet();
      return 'OK';
    }
    return 'No SM';
  `);
  await sleep(1000);
  await capturePanel('demo_journey_03_clean_whiteboard.jpg');

  console.log('4. Ingesting Whiteboard Drawing -> Marker Sketches & Sugiyama DAG Active...');
  await runSnippet(`
    const sm = (global as any).SpecScribeSpatialInterfaceManager;
    if (sm) {
      sm.startDrawingAndIngestion();
      return 'OK';
    }
    return 'No SM';
  `);
  await sleep(1000);
  await capturePanel('demo_journey_04_drawing_active.jpg');

  console.log('5. Injecting Decision Node + AI Orb Raising Hand...');
  await runSnippet(`
    const sm = (global as any).SpecScribeSpatialInterfaceManager;
    const agent = (global as any).SpecScribeRaisingHandAgent;
    if (sm) {
      sm.triggerAddNode('decision');
    }
    if (agent) {
      agent.triggerHandRaised(
        '⚠️ Auth Token Leak Risk',
        '• Vulnerability: Unsigned JWT tokens can be forged\\n• Fix: Require HMAC-SHA256 signature verification\\n• Alternative: Move session state to Redis Token Cache',
        'VULNERABILITY'
      );
    }
    return 'OK';
  `);
  await sleep(1000);
  await capturePanel('demo_journey_05_node_added_orb_raised.jpg');

  console.log('6. Expanding AI Critique Card...');
  await runSnippet(`
    const agent = (global as any).SpecScribeRaisingHandAgent;
    if (agent) {
      agent.handleOrbPinched();
      return 'OK';
    }
    return 'No Agent';
  `);
  await sleep(1000);
  await capturePanel('demo_journey_06_critique_expanded.jpg');

  console.log('7. Updating Architecture Snapshot (Sugiyama Multi-Tier Routing)...');
  await runSnippet(`
    const sm = (global as any).SpecScribeSpatialInterfaceManager;
    if (sm) {
      sm.triggerUpdateSnapshot();
      return 'OK';
    }
    return 'No SM';
  `);
  await sleep(1000);
  await capturePanel('demo_journey_07_snapshot_updated.jpg');

  console.log('8. Concluding Meeting & Technical Specification Generated...');
  await runSnippet(`
    const sm = (global as any).SpecScribeSpatialInterfaceManager;
    if (sm) {
      sm.triggerConcludeMeeting();
      return 'OK';
    }
    return 'No SM';
  `);
  await sleep(1200);
  await capturePanel('demo_journey_08_concluded.jpg');

  console.log('=== All 8 Demo Journey Screenshots Captured Successfully! ===');
}

main().catch(console.error);
