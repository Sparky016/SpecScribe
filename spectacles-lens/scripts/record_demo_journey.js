const http = require('http');
const fs = require('fs');
const path = require('path');

const token = 'Gt0ObwXN9IV3ZQdjIcikYkRFixTh2tWCFSnItHtkC5iHp9qDqQ8pq0yvRA97OkVF';
const framesDir = path.join(__dirname, '../recorded_frames');

if (!fs.existsSync(framesDir)) {
  fs.mkdirSync(framesDir, { recursive: true });
} else {
  // Clean existing frames
  for (const f of fs.readdirSync(framesDir)) {
    if (f.endsWith('.jpg') || f.endsWith('.json')) {
      fs.unlinkSync(path.join(framesDir, f));
    }
  }
}

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
      id: Date.now(),
      method: 'tools/call',
      params: { name: tool, arguments: args }
    }));
    req.end();
  });
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('=== Starting SpecScribe Live Preview Recording ===');

  console.log('1. Setting optimal centered camera pose...');
  await callMcp('MovePreviewCamera', { action: 'reset' });
  await sleep(400);
  await callMcp('MovePreviewCamera', { action: 'setPosition', x: 0, y: 0, z: -100 });
  await sleep(800);

  console.log('2. Starting LEAF scenario: demo-full-journey...');
  let scenarioFinished = false;
  let scenarioResult = null;
  const startTime = Date.now();

  const scenarioPromise = callMcp('run_leaf_scenario', { scenarioId: 'demo-full-journey' })
    .then(res => {
      scenarioResult = res;
      scenarioFinished = true;
      console.log('\n[Scenario Completed] result:', JSON.stringify(res.result?.content?.[0]?.text || res));
    })
    .catch(err => {
      scenarioFinished = true;
      console.error('[Scenario Error]', err);
    });

  let frameCount = 0;
  const metadata = [];

  console.log('3. Capturing live preview frames during journey...');
  while (!scenarioFinished) {
    const tStart = Date.now();
    try {
      const shot = await callMcp('CapturePanelScreenshotTool', { pluginId: 'Snap.Plugin.Gui.PreviewPanel' });
      if (shot.result && shot.result.content && shot.result.content[0].data) {
        frameCount++;
        const filename = `frame_${String(frameCount).padStart(4, '0')}.jpg`;
        const filepath = path.join(framesDir, filename);
        const buf = Buffer.from(shot.result.content[0].data, 'base64');
        fs.writeFileSync(filepath, buf);
        const elapsed = (Date.now() - startTime) / 1000;
        metadata.push({
          frame: frameCount,
          filename,
          elapsedSeconds: elapsed
        });
        process.stdout.write(`\rCaptured frame ${frameCount} (${elapsed.toFixed(1)}s, ${buf.length} bytes)   `);
      }
    } catch (e) {
      console.warn('Capture error:', e.message);
    }

    const tEnd = Date.now();
    const waitTime = Math.max(50, 400 - (tEnd - tStart));
    await sleep(waitTime);
  }

  await scenarioPromise;

  // Capture 2 bonus hold frames at the end
  for (let i = 0; i < 2; i++) {
    const shot = await callMcp('CapturePanelScreenshotTool', { pluginId: 'Snap.Plugin.Gui.PreviewPanel' });
    if (shot.result?.content?.[0]?.data) {
      frameCount++;
      const filename = `frame_${String(frameCount).padStart(4, '0')}.jpg`;
      fs.writeFileSync(path.join(framesDir, filename), Buffer.from(shot.result.content[0].data, 'base64'));
    }
    await sleep(300);
  }

  fs.writeFileSync(path.join(framesDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
  console.log(`\n=== Recording Complete! Captured ${frameCount} frames in ${((Date.now() - startTime) / 1000).toFixed(1)}s ===`);
}

main().catch(console.error);
