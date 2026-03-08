FROM node:18-bullseye-slim

# Устанавливаем Python и ffmpeg (необходимы для работы yt-dlp)
RUN apt-get update && apt-get install -y python3 ffmpeg curl && rm -rf /var/lib/apt/lists/*

# Скачиваем и устанавливаем последнюю версию yt-dlp
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Копируем файлы зависимостей и устанавливаем их
COPY package*.json ./
RUN npm install

# Копируем исходный код бота
COPY . .

# Запускаем бота
CMD ["npm", "start"]
