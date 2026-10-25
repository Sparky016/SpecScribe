const http = require('http');
const fs = require('fs');

function call(tool, args = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request('http://localhost:50040/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer Gt0ObwXN9IV3ZQdjIcikYkRFixTh2tWCFSnItHtkC5iHp9qDqQ8pq0yvRA97OkVF'
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

const tool = process.argv[2];
let args = {};
if (process.argv[3]) {
  if (fs.existsSync(process.argv[3])) {
    args = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
  } else {
    try {
      args = JSON.parse(process.argv[3]);
    } catch (e) {
      args = { query: process.argv[3] };
    }
  }
}

call(tool, args).then(res => {
  console.log(JSON.stringify(res, null, 2));
}).catch(err => {
  console.error(err);
});
