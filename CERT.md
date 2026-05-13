# Сертификаты

Самоподписанный SSL-сертификат. При смене IP сервера — перегенерировать.

## Быстрая замена (если IP поменялся)

```bash
# 1. Удалить старые ключи (чтоб git видел изменения)
rm backend/server-key.pem backend/server-cert.pem
rm nginx/certs/server-key.pem nginx/certs/server-cert.pem

# 2. Сгенерировать новые с НОВЫМ IP
node gen-cert-for-server.js <НОВЫЙ_IP>

# 3. Закоммитить и запушить
git add -A
git commit -m "update cert for new server IP"
git push

# 4. На сервере — пересобрать и запустить
cd ~/music-app
git pull
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build
```

## Импорт на клиенте (чтобы браузер не ругался)

Открыть `https://<IP>:1443` → в браузере появится предупреждение → "Дополнительно" / "Advanced" → "Перейти на сайт" / "Proceed".

Если хочешь убрать предупреждение совсем — импортируй `backend/server-cert.pem` в доверенные корневые центры сертификации на каждом клиенте.

**Windows (PowerShell Admin):**
```powershell
$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2("backend\server-cert.pem")
$store = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "LocalMachine")
$store.Open("ReadWrite")
$store.Add($cert)
$store.Close()
```

## Что внутри

- `gen-cert-for-server.js` — скрипт генерации (берёт IP из аргумента)
- `backend/server-cert.pem` + `backend/server-key.pem` — копия для бекапа
- `nginx/certs/server-cert.pem` + `nginx/certs/server-key.pem` — использует nginx
