const http = require('http');

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

async function main() {
  console.log('Opening LEAF panel...');
  const openRes = await callMcp('open_leaf_panel', {});
  console.log('Open LEAF panel result:', JSON.stringify(openRes, null, 2));

  console.log('Waiting 1.5s...');
  await new Promise(r => setTimeout(r, 1500));

  console.log('Listing LEAF scenarios...');
  const listRes = await callMcp('list_leaf_scenarios', {});
  console.log('Scenarios:', JSON.stringify(listRes, null, 2));
}

main().catch(console.error);
