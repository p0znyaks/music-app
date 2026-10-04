# Запуск

Единый конфиг: фронт собирается в продакшен-бандл, всё раздаёт nginx по HTTPS.

## Первый запуск
```bash
cp .env.example .env       # затем задай POSTGRES_PASSWORD и JWT_SECRET
node gen-cert-for-server.js <IP-СЕРВЕРА>   # самоподписанный сертификат
docker compose up --build -d
```

Приложение: `https://localhost:8443` (в браузере предупреждение о самоподписанном
сертификате — это ожидаемо, см. `CERT.md`).

## Обновление
```bash
docker compose up --build -d
```

## Остановка
```bash
docker compose down          # с удалением данных: docker compose down -v
```

## Состояние сервисов
```bash
docker compose ps            # все сервисы должны быть (healthy)
docker compose logs -f backend
```

## Миграции БД
Схема применяется автоматически при старте бэкенда (`migrationsRun`).
Ручные команды (для разработки):
```bash
docker compose exec backend npm run migration:generate -- src/migrations/Название
docker compose exec backend npm run migration:run
docker compose exec backend npm run migration:revert
```

## Тесты
```bash
docker compose exec backend npm test        # 177 тестов, ~5 c
docker compose exec backend npm run test:load   # нагрузочный прогон (долгий)
```

## Cookies YouTube
`cookies.txt` **не входит в репозиторий** (в `.gitignore`): экспортируй вручную
при необходимости — см. раздел ниже.

### Экспорт cookies
1. В браузере: расширение «EditThisCookie» → Export → сохранить как `cookies.txt`
   (формат Netscape) в корень проекта
2. Либо: `yt-dlp --cookies-from-browser chrome --cookies cookies.txt <url>`

Файл монтируется в контейнер как `/app/cookies.txt` и подключается через
`YTDLP_COOKIES_FILE` в `.env`.

### Проверка, что cookies работают
```bash
echo "PYTHON_WORKER_LOG=1" >> .env
docker compose restart backend
docker compose logs -f backend
```
В логах не должно быть `Sign in to confirm` / `cookies are no longer valid`.

## Деплой на сервер
```bash
# на сервере
git pull
docker compose up --build -d
```

## Производительность

| Что | Как |
|---|---|
| Stream URL | InnerTube (Android client) через резидентный Python-воркер, fallback на yt-dlp |
| TTL ссылки | `REDIS_TTL_STREAM_SEC=18000` (5 ч; ссылка живёт ~6 ч) |
| Аудио на диске | `audio_cache`, лимит `AUDIO_CACHE_MAX_BYTES` (1 ГБ), LRU-очистка |
| Воркеры | `PYTHON_WORKERS=2` |