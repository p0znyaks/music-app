const fs = require('fs');
const path = require('path');

// Use Node.js built-in crypto for certificate generation
const forgePath = path.join(__dirname, 'node_modules', 'forge');
if (!fs.existsSync(forgePath)) {
  console.error('forge not found, installing...');
  const { execSync } = require('child_process');
  execSync('npm install forge', { cwd: __dirname, stdio: 'inherit' });
}

const forge = require('node-forge');
const pki = forge.pki;

const keys = pki.rsa.generateKeyPair(2048);
const cert = pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.serialNumber = '01';
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

cert.setSubject([{ name: 'commonName', value: 'localhost' }]);
cert.setExtensions([
  { name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }] },
  { name: 'keyUsage', keyUsage: ['digitalSignature', 'keyEncipherment'] },
  { name: 'extKeyUsage', serverAuth: true }
]);

cert.sign(keys.privateKey, forge.md.sha256.create());

const pemCert = pki.certificateToPem(cert);
const pemKey = pki.privateKeyToPem(keys.privateKey);

fs.writeFileSync(path.join(__dirname, 'server-key.pem'), pemKey);
fs.writeFileSync(path.join(__dirname, 'server-cert.pem'), pemCert);
console.log('Generated server-cert.pem and server-key.pem in backend/');
console.log(pemCert);