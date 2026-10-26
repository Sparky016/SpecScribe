const http = require('http');
const fs = require('fs');

function callMcp(tool, args = {}) {
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
      params: { name: tool, arguments: args }
    }));
    req.end();
  });
}

async function capturePanel(filename) {
  const artifactDir = 'C:/Users/ruanc/.gemini/antigravity-ide/brain/a1d49ac0-9611-4865-a573-37788258aacb';
  const res = await callMcp('CapturePanelScreenshotTool', { pluginId: 'Snap.Plugin.Gui.PreviewPanel' });
  if (res.result && res.result.content) {
    const item = res.result.content.find(c => c.type === 'image');
    if (item && item.data) {
      const buf = Buffer.from(item.data, 'base64');
      fs.writeFileSync(`${artifactDir}/${filename}`, buf);
      console.log(`[Captured] ${filename} (${buf.length} bytes)`);
    }
  }
}

async function runEditorSnippet(code) {
  const res = await callMcp('ExecuteEditorCode', { code });
  return res.result ? res.result.content[0].text : JSON.stringify(res);
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('=== Stage 1: Initial Calibration Mode (High on Wall) ===');
  await capturePanel('preview_stage1_high_selection.jpg');

  console.log('=== Stage 2: Drag Whiteboard Lower (-35cm) & Resize (120x76cm) ===');
  const codeStage2 = `
    const sm = (global as any).SpecScribeSpatialInterfaceManager;
    if (sm) {
      sm.dragWhiteboard(-35, 0);
      sm.resizeWhiteboard(120, 76);
      return JSON.stringify({
        pos: sm.getWhiteboardPosition(),
        scale: sm.getWhiteboardScale(),
        state: sm.getWhiteboardState()
      });
    }
    return 'No SM found in global';
  `;
  const res2 = await runEditorSnippet(codeStage2);
  console.log('Stage 2 Result:', res2);
  await sleep(600);
  await capturePanel('preview_stage2_lowered_resized.jpg');

  console.log('=== Stage 3: Pinch Center To Set -> Clean Whiteboard Ready ===');
  const codeStage3 = `
    const sm = (global as any).SpecScribeSpatialInterfaceManager;
    if (sm) {
      sm.pinchCenterToSet();
      return JSON.stringify({
        pos: sm.getWhiteboardPosition(),
        scale: sm.getWhiteboardScale(),
        state: sm.getWhiteboardState(),
        isClean: sm.isCleanBoard(),
        nodeCount: sm.getNodeCount()
      });
    }
    return 'No SM found in global';
  `;
  const res3 = await runEditorSnippet(codeStage3);
  console.log('Stage 3 Result:', res3);
  await sleep(600);
  await capturePanel('preview_stage3_clean_whiteboard.jpg');

  console.log('=== Stage 4: Start Drawing & Ingestion -> Drawings and Sugiyama DAG appear ===');
  const codeStage4 = `
    const sm = (global as any).SpecScribeSpatialInterfaceManager;
    if (sm) {
      sm.startDrawingAndIngestion();
      return JSON.stringify({
        state: sm.getWhiteboardState(),
        nodeCount: sm.getNodeCount(),
        toast: sm.getToastText()
      });
    }
    return 'No SM found in global';
  `;
  const res4 = await runEditorSnippet(codeStage4);
  console.log('Stage 4 Result:', res4);
  await sleep(600);
  await capturePanel('preview_stage4_drawing_active.jpg');

  console.log('=== Workflow Demonstration Verification Complete! ===');
}

main().catch(console.error);
