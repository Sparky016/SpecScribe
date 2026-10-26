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
  console.log('1. Recompiling TypeScript in Lens Studio...');
  const comp = await callMcp('RecompileTypeScriptTool', {});
  console.log('Compile result:', JSON.stringify(comp, null, 2));

  console.log('2. Waiting for Lens reload...');
  await new Promise(r => setTimeout(r, 4000));

  const scenarios = [
    'dc0-whiteboard-selection',
    'dc1-whiteboard-anchor',
    'dc2-world-anchor-mobility',
    'dc3-palette-node-injection',
    'dc4-update-snapshot',
    'dc5-ai-orb-hand-raised',
    'dc6-conclude-meeting',
  ];

  for (const s of scenarios) {
    console.log(`Running scenario: ${s}...`);
    const res = await callMcp('run_leaf_scenario', { scenarioId: s });
    console.log(`Result for ${s}:`, JSON.stringify(res, null, 2));
  }
}

main().catch(console.error);
