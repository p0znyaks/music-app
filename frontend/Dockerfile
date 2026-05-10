FROM node:22-alpine
RUN npm install -g @angular/cli
WORKDIR /app/app
COPY app/package.json app/package-lock.json* ./
RUN npm install
EXPOSE 4200
CMD ["ng", "serve", "--host", "0.0.0.0", "--poll", "500"]