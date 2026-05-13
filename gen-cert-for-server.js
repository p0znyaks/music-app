const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const serverIP = process.argv[2] || '127.0.0.1';
const baseDir = __dirname;

const opensslConfig = `
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = ${serverIP}

[v3_req]
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1 = ${serverIP}
`;

const tmpDir = fs.mkdtempSync(path.join(baseDir, '.cert-tmp-'));
const configPath = path.join(tmpDir, 'openssl.cnf');
const keyPath = path.join(tmpDir, 'key.pem');
const certPath = path.join(tmpDir, 'cert.pem');

fs.writeFileSync(configPath, opensslConfig.trim());

execSync(
  `openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 365 -config "${configPath}" -nodes -sha256`,
  { stdio: 'inherit' }
);

const keyData = fs.readFileSync(keyPath);
const certData = fs.readFileSync(certPath);

fs.writeFileSync(path.join(baseDir, 'backend', 'server-key.pem'), keyData);
fs.writeFileSync(path.join(baseDir, 'backend', 'server-cert.pem'), certData);
fs.writeFileSync(path.join(baseDir, 'nginx', 'certs', 'server-key.pem'), keyData);
fs.writeFileSync(path.join(baseDir, 'nginx', 'certs', 'server-cert.pem'), certData);

try { fs.rmdirSync(tmpDir, { recursive: true }); } catch (_) {}

console.log(`Generated self-signed cert for IP: ${serverIP} + localhost`);
console.log('Updated:');
console.log('  backend/server-cert.pem + backend/server-key.pem');
console.log('  nginx/certs/server-cert.pem + nginx/certs/server-key.pem');
