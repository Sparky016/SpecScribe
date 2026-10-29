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
  const shot = await callMcp('CapturePanelScreenshotTool', { pluginId: 'Snap.Plugin.Gui.PreviewPanel' });
  if (shot.result && shot.result.content && shot.result.content[0]) {
    const data = shot.result.content[0].data;
    const buf = Buffer.from(data, 'base64');
    const outPath = 'C:/Users/ruanc/.gemini/antigravity-ide/brain/89f2dfee-3bd3-47cf-8a1e-6580eb2b0fc5/preview_live_diagram.jpg';
    fs.writeFileSync(outPath, buf);
    console.log('Saved preview_live_diagram.jpg, length:', buf.length);
  } else {
    console.log('Capture error or empty:', JSON.stringify(shot));
  }
}

main().catch(console.error);
