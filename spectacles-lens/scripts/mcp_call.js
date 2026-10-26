const { call } = require('./lib/mcpClient');
const fs = require('fs');

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
