const https = require('https');
const MONO_SECRET_KEY = process.env.MONO_SECRET_KEY;

const options = {
  hostname: 'api.withmono.com',
  path: '/v2/accounts',
  method: 'GET',
  headers: {
    'mono-sec-key': MONO_SECRET_KEY,
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log('Response:', data);
  });
});
req.end();
