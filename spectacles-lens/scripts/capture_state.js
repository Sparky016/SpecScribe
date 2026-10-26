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
  console.log('Capturing preview screenshot...');
  const screenshot = await callMcp('CapturePanelScreenshotTool', { pluginId: 'Snap.Plugin.Gui.PreviewPanel' });
  if (screenshot.result && screenshot.result.content && screenshot.result.content[0].data) {
    const buf = Buffer.from(screenshot.result.content[0].data, 'base64');
    fs.writeFileSync('c:/Users/ruanc/source/repos/SpecScribe/preview_current_state.jpg', buf);
    const art = 'C:/Users/ruanc/.gemini/antigravity-ide/brain/a1d49ac0-9611-4865-a573-37788258aacb/preview_current_state.jpg';
    fs.writeFileSync(art, buf);
    console.log('Saved preview_current_state.jpg');
  } else {
    console.error('Failed to capture:', screenshot);
  }
}

main().catch(console.error);
