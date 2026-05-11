# Запуск

## DEV
```bash
docker compose up -d
```
- nginx :8443 → frontend :4200 (dev server)

## PROD
```bash
docker compose -f docker-compose.prod.yml up --build -d
```
- nginx :1443 (SSL, reverse proxy, static bundle)

## Остановка
```bash
docker compose down
```

## Проверка
- DEV: `https://localhost:8443`
- PROD: `https://localhost:1443`

## Локально → git push → сервер git pull → docker up

## Обновление cookies YouTube

### Локально
1. Экспортируй cookies из браузера в файл `cookies.txt` (формат Netscape)
   - Chrome: расширение "EditThisCookie" → Export → сохранить как `cookies.txt`
   - Или: `yt-dlp --cookies-from-browser chrome --cookies cookies.txt ...`

2. Скопируй файл на сервер:
```bash
scp cookies.txt deploy@your-server:/home/deploy/music-app/
```

### На сервере
```bash
cd ~/music-app
git pull origin main
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build
```

### Проверка что cookies работают
```bash
# Включи логирование в .env:
echo "PYTHON_WORKER_LOG=1" >> .env

# Рестарт
docker compose -f docker-compose.prod.yml restart backend

# Смотри логи
docker compose -f docker-compose.prod.yml logs -f backend
```

Если в логах НЕТ `Sign in to confirm` — cookies работают.

### .env переменные для cookies
```
YTDLP_COOKIES_FILE=/app/cookies.txt
```