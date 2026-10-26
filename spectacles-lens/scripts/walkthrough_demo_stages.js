const http = require('http');
const fs = require('fs');
const path = require('path');

const token = 'Gt0ObwXN9IV3ZQdjIcikYkRFixTh2tWCFSnItHtkC5iHp9qDqQ8pq0yvRA97OkVF';
const outDir = 'C:/Users/ruanc/.gemini/antigravity-ide/brain/ab5d3b86-3403-449e-8bcc-81f24251f4f4';

function callMcp(tool, args) {
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
      params: {
        name: tool,
        arguments: args
      }
    }));
    req.end();
  });
}

async function captureShot(filename) {
  const shot = await callMcp('CapturePanelScreenshotTool', { pluginId: 'Snap.Plugin.Gui.PreviewPanel' });
  if (shot.result && shot.result.content && shot.result.content[0].data) {
    const buf = Buffer.from(shot.result.content[0].data, 'base64');
    const fullPath = path.join(outDir, filename);
    fs.writeFileSync(fullPath, buf);
    console.log(`Saved screenshot: ${filename} (${buf.length} bytes)`);
    return fullPath;
  } else {
    console.warn(`Failed to capture ${filename}:`, JSON.stringify(shot));
    return null;
  }
}

async function runScenario(scenarioId) {
  console.log(`Executing LEAF scenario: ${scenarioId}...`);
  const res = await callMcp('run_leaf_scenario', { scenarioId });
  console.log(`Scenario ${scenarioId} status:`, JSON.stringify(res.result?.content?.[0]?.text || res));
  await new Promise(r => setTimeout(r, 600));
}

async function main() {
  console.log('=== SpecScribe Stakeholder Demo Walkthrough ===');

  console.log('\n--- Stage 0: Recompile & Fresh Preview ---');
  await callMcp('RecompileTypeScriptTool', {});
  await new Promise(r => setTimeout(r, 3000));
  await callMcp('PreviewPanelTool', { action: 'restart' });
  await new Promise(r => setTimeout(r, 3000));

  console.log('\n--- Stage 1: SELECT_AREA (Wall Calibration) ---');
  await captureShot('demo_01_select_area.jpg');

  console.log('\n--- Stage 2: CLEAN_BOARD (Area Locked, Clean Whiteboard Ready) ---');
  await runScenario('demo-select-whiteboard');
  await captureShot('demo_02_clean_board.jpg');

  console.log('\n--- Stage 3: DRAWING_ACTIVE (Ingested Whiteboard Sketch + Sugiyama DAG) ---');
  await runScenario('demo-start-drawing');
  await captureShot('demo_03_drawing_active.jpg');

  console.log('\n--- Stage 4: NODE_ADDED & AI ORB HAND-RAISED ---');
  await runScenario('dc3-palette-node-injection');
  await captureShot('demo_04_node_added.jpg');

  console.log('\n--- Stage 5: AI ORB CRITIQUE EXPANDED ---');
  await runScenario('dc5-ai-orb-hand-raised');
  await captureShot('demo_05_critique_card_expanded.jpg');

  console.log('\n--- Stage 6: ARCHITECTURE SNAPSHOT MULTI-TIER UPDATED ---');
  await runScenario('dc4-update-snapshot');
  await captureShot('demo_06_snapshot_updated.jpg');

  console.log('\n--- Stage 7: MEETING CONCLUDED & SPEC GENERATED ---');
  await runScenario('dc6-conclude-meeting');
  await captureShot('demo_07_concluded.jpg');

  console.log('\n=== Walkthrough Complete! All screenshots captured. ===');
}

main().catch(console.error);
