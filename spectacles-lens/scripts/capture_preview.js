const http = require('http');
const fs = require('fs');
const path = require('path');

function call(tool, args = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request('http://localhost:50040/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': require('./lib/mcpClient').authHeader()
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch (e) { resolve(d); }
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
  const filename = process.argv[2] || 'preview_camera_anchored_orb.jpg';
  console.log(`Taking screenshot and saving to ${filename}...`);
  const res = await call('PreviewPanelTool', { action: 'screenshot' });
  if (res.result && res.result.content) {
    for (const item of res.result.content) {
      if (item.type === 'text') {
        const parsed = JSON.parse(item.text);
        if (parsed.screenshot && parsed.screenshot.image_url && parsed.screenshot.image_url.url) {
          const base64Data = parsed.screenshot.image_url.url.replace(/^data:image\/\w+;base64,/, '');
          const buf = Buffer.from(base64Data, 'base64');
          const targetPath = path.resolve('C:/Users/ruanc/.gemini/antigravity-ide/brain/a1d49ac0-9611-4865-a573-37788258aacb', filename);
          fs.writeFileSync(targetPath, buf);
          console.log(`Saved screenshot to ${targetPath} (${buf.length} bytes)`);
        }
      }
    }
  }
}

main();
