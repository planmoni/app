const https = require('https');
const MONO_SECRET_KEY = 'live_sk_trptouca73sbvtt40d84'; // Key from your .env

const data = JSON.stringify({ code: 'code_dummy_test_123' });

const options = {
  hostname: 'api.withmono.com',
  path: '/v2/accounts/auth',
  method: 'POST',
  headers: {
    'mono-sec-key': MONO_SECRET_KEY,
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let responseData = '';
  res.on('data', (chunk) => responseData += chunk);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log('Response:', responseData);
  });
});

req.on('error', (error) => console.error(error));
req.write(data);
req.end();
