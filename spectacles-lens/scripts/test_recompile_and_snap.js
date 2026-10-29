const http = require('http');

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
  console.log('Recompiling...');
  const comp = await callMcp('RecompileTypeScriptTool', {});
  console.log('Compile result:', JSON.stringify(comp, null, 2));

  console.log('Waiting 2 seconds...');
  await new Promise(r => setTimeout(r, 2000));

  console.log('Capturing screenshot...');
  const shot = await callMcp('CapturePanelScreenshotTool', { pluginId: 'Snap.Plugin.Gui.PreviewPanel' });
  if (shot.result && shot.result.content && shot.result.content[0].data) {
    console.log('Success! Data length:', shot.result.content[0].data.length);
  } else {
    console.log('Shot result:', JSON.stringify(shot, null, 2));
  }
}

main().catch(console.error);
