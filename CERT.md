# Сертификаты

Самоподписанный SSL-сертификат. Генерируется на каждой машине и **не коммитится**
(приватные ключи не должны лежать в репозитории — см. `.gitignore`).

## Генерация

```bash
node gen-cert-for-server.js <IP-СЕРВЕРА>
```

Скрипт создаёт `nginx/certs/server-cert.pem` и `nginx/certs/server-key.pem` —
именно их монтирует nginx. При смене IP просто перегенерируй и перезапусти:

```bash
node gen-cert-for-server.js <НОВЫЙ_IP>
docker compose up -d
```

## Импорт на клиенте (чтобы браузер не ругался)

Открыть `https://<IP>:8443` → предупреждение → «Дополнительно» / «Advanced» →
«Перейти на сайт» / «Proceed».

Чтобы убрать предупреждение, импортируй `nginx/certs/server-cert.pem`
в доверенные корневые центры сертификации на клиенте.

**Windows (PowerShell от администратора):**
```powershell
$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2("nginx\certs\server-cert.pem")
$store = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "LocalMachine")
$store.Open("ReadWrite")
$store.Add($cert)
$store.Close()
```

**Linux:**
```bash
sudo cp nginx/certs/server-cert.pem /usr/local/share/ca-certificates/music-app.crt
sudo update-ca-certificates
```

## Что внутри

- `gen-cert-for-server.js` — генератор сертификата (берёт IP из аргумента,
  добавляет `localhost` и IP в SAN)
- `nginx/certs/server-cert.pem` + `nginx/certs/server-key.pem` — использует nginx,
  монтируются в контейнер только на чтение
