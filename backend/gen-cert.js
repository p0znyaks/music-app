const path = require('path');
const fs = require('fs');

const forge = require(path.join(__dirname, 'node_modules', 'node-forge'));
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
  {
    name: 'subjectAltName',
    altNames: [
      { type: 2, value: 'localhost' },
    ],
  },
]);

cert.sign(keys.privateKey, forge.md.sha256.create());

const pemCert = pki.certificateToPem(cert);
const pemKey = pki.privateKeyToPem(keys.privateKey);

fs.writeFileSync(path.join(__dirname, 'server-key.pem'), pemKey);
fs.writeFileSync(path.join(__dirname, 'server-cert.pem'), pemCert);
console.log('Generated new cert with proper SAN');
console.log(pemCert.substring(0, 80));