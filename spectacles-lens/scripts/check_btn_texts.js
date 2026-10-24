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

async function main() {
  const ids = [
    { name: 'BtnAddDecision', id: 'e21c9cbc-d4c3-426b-8f7d-6a1d78dfea45' },
    { name: 'BtnAddService', id: 'a90dd370-9ce1-4589-826b-64940b241145' },
    { name: 'BtnAddDatabase', id: 'c9bf271d-c938-41bc-945d-236c7987ca43' },
    { name: 'BtnAddTerminal', id: '3d0aea0d-655d-4729-8c2a-38eae528e068' },
    { name: 'BtnUpdateSnapshot', id: '5372a530-7c8a-462c-be86-f776c9a79b3f' },
    { name: 'BtnConcludeMeeting', id: '20e18c41-8ab6-49ce-8369-1e40ab736037' },
  ];

  for (const b of ids) {
    const q = `
      query {
        sceneObject(id: "${b.id}") {
          name
          localTransform { position { x y z } scale { x y z } }
          components {
            id
            type
            properties
          }
        }
      }
    `;
    const res = await callMcp('scene-graphql', { query: q });
    const so = JSON.parse(res.result.content[0].text).data.sceneObject;
    const tc = so.components.find(c => c.type === 'Text');
    console.log(`${b.name}: scale=`, so.localTransform.scale, 'Text:', tc ? { text: tc.properties.text, size: tc.properties.size, sizeToFit: tc.properties.sizeToFit } : 'none');
  }
}

main().catch(console.error);
