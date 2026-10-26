const http = require('http');

function callMcp(method, params = {}) {
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
      method: method,
      params: params
    }));
    req.end();
  });
}

async function main() {
  const resp = await callMcp('tools/list');
  if (resp.result && resp.result.tools) {
    console.log('Available MCP Tools:');
    resp.result.tools.forEach(t => console.log(`- ${t.name}: ${t.description?.slice(0, 80) || ''}`));
  } else {
    console.log('Response:', JSON.stringify(resp, null, 2));
  }
}

main().catch(console.error);
