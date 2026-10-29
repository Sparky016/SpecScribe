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
      const json = JSON.parse(data);
      const tool = json.result.tools.find(t => t.name === 'PreviewInteractTool');
      console.log('PreviewInteractTool:', JSON.stringify(tool, null, 2));
    });
  });
  req.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }));
  req.end();
}

main().catch(console.error);
