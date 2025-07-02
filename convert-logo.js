const fs = require('fs');
const path = require('path');

// Read the logo file and convert to base64
const logoPath = path.join(__dirname, 'assets', 'images', 'Planmoni.png');
const logoBuffer = fs.readFileSync(logoPath);
const base64String = logoBuffer.toString('base64');

const dataUri = 'data:image/png;base64,' + base64String;
console.log('Logo converted to base64 successfully!');
fs.writeFileSync('logo-base64.txt', dataUri);
console.log('Base64 string saved to logo-base64.txt'); 