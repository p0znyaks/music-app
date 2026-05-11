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