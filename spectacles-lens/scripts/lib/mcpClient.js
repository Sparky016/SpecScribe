const http = require('http');

const MCP_URL = 'http://localhost:50040/mcp';

function getToken() {
  const token = process.env.LS_MCP_TOKEN;
  if (!token) {
    throw new Error('LS_MCP_TOKEN environment variable is not set. Set it to your Lens Studio MCP bearer token.');
  }
  return token;
}

function authHeader() {
  return `Bearer ${getToken()}`;
}

function call(tool, args = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader()
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

module.exports = { MCP_URL, getToken, authHeader, call };
