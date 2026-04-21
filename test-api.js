const file = require('node:fs');
const https = require('node:https');

const postData = JSON.stringify({
  channel: 'test-channel',
  event: 'test-event',
  data: { hello: 'world' }
});

const req = https.request('http://localhost:3000/api/signaling', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', data));
});

req.on('error', (e) => console.error(e));
req.write(postData);
req.end();
