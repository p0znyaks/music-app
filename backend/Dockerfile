FROM node:22-alpine
WORKDIR /app

ENV PYTHON_WORKERS=1
ENV PY_WORKER_THREADS=16

RUN apk add --no-cache python3 py3-pip ffmpeg nodejs npm \
  && pip3 install --no-cache-dir 'yt-dlp>=2024.12.13' 'ytmusicapi>=1.8.0' --break-system-packages \
  && npm install -g v8-compile-cache \
  && yt-dlp --version

COPY package.json package-lock.json* ./
ENV npm_config_foreground_scripts=true
RUN npm ci --no-audit --no-fund

COPY tsconfig.json ./
COPY scripts ./scripts
COPY src ./src

RUN npm run build

EXPOSE 3000
CMD ["node", "dist/main.js"]
