const http = require('http');
const fs = require('fs');
const token = require('./lib/mcpClient').getToken();

function call(tool, args = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request('http://localhost:50040/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: tool, arguments: args } }));
    req.end();
  });
}

async function test() {
  const code = `
    const sm = (global as any).SpecScribeSpatialInterfaceManager;
    if (sm) {
      sm.pinchCenterToSet();
      sm.startDrawingAndIngestion();
      return 'State: ' + sm.getWhiteboardState();
    }
    return 'No SM';
  `;
  const res = await call('ExecuteEditorCode', { code });
  console.log('ExecuteEditorCode result:', JSON.stringify(res));

  await new Promise(r => setTimeout(r, 600));
  const shot = await call('CapturePanelScreenshotTool', { pluginId: 'Snap.Plugin.Gui.PreviewPanel' });
  const item = shot.result.content.find(c => c.type === 'image');
  if (item && item.data) {
    fs.writeFileSync('temp_drawing_shot.jpg', Buffer.from(item.data, 'base64'));
    console.log('Saved temp_drawing_shot.jpg');
  }
}
test();
