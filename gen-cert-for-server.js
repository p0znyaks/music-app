const path = require('path');
const fs = require('fs');
const forge = require(path.join(__dirname, 'backend', 'node_modules', 'node-forge'));
const pki = forge.pki;

const serverIP = process.argv[2] || '127.0.0.1';

const keys = pki.rsa.generateKeyPair(2048);
const cert = pki.createCertificate();

cert.publicKey = keys.publicKey;
cert.serialNumber = '01';
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

cert.setSubject([{ name: 'commonName', value: serverIP }]);
cert.setExtensions([
  {
    name: 'subjectAltName',
    altNames: [
      { type: 2, value: 'localhost' },
      { type: 7, ip: serverIP },
    ],
  },
]);

cert.sign(keys.privateKey, forge.md.sha256.create());

const pemCert = pki.certificateToPem(cert);
const pemKey = pki.privateKeyToPem(keys.privateKey);

// backend/
fs.writeFileSync(path.join(__dirname, 'backend', 'server-key.pem'), pemKey);
fs.writeFileSync(path.join(__dirname, 'backend', 'server-cert.pem'), pemCert);

// nginx/certs/
fs.writeFileSync(path.join(__dirname, 'nginx', 'certs', 'server-key.pem'), pemKey);
fs.writeFileSync(path.join(__dirname, 'nginx', 'certs', 'server-cert.pem'), pemCert);

console.log(`Generated cert for IP: ${serverIP}`);
console.log('Updated: backend/server-cert.pem, backend/server-key.pem');
console.log('Updated: nginx/certs/server-cert.pem, nginx/certs/server-key.pem');
