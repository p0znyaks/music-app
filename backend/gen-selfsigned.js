const selfsigned = require('selfsigned');
const fs = require('fs');
const path = require('path');

const attrs = [{ name: 'commonName', value: 'localhost' }];
const opts = {
  days: 365,
  algorithm: 'sha256',
  keySize: 2048,
  extensions: [{ name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }] }]
};

const pems = selfsigned.generate(attrs, opts);
fs.writeFileSync(path.join(__dirname, 'server-key.pem'), pems.private);
fs.writeFileSync(path.join(__dirname, 'server-cert.pem'), pems.cert);
console.log('Generated with selfsigned');
console.log(pems.cert.substring(0, 80));