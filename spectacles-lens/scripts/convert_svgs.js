const http = require('http');

function callMcp(tool, args) {
  return new Promise((resolve, reject) => {
    const req = http.request('http://localhost:50040/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer Gt0ObwXN9IV3ZQdjIcikYkRFixTh2tWCFSnItHtkC5iHp9qDqQ8pq0yvRA97OkVF'
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

async function convert(svgRelPath) {
  console.log(`Converting ${svgRelPath}...`);
  const res = await callMcp('ConvertSvgToTexture', { 
    svgPath: svgRelPath,
    width: 1024,
    height: 683
  });
  console.log('Result:', JSON.stringify(res, null, 2));
}

async function main() {
  await convert('Textures/Whiteboard_Backdrop.svg');
  await convert('Textures/Whiteboard_SelectArea.svg');
  await convert('Textures/Whiteboard_Drawn.svg');
  await convert('Textures/Diagram_Empty.svg');
}

main().catch(console.error);
