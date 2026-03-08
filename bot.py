const { Telegraf } = require('telegraf');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Получаем токен из переменных окружения (Railway)
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('BOT_TOKEN is required!');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

bot.start((ctx) => {
  ctx.reply('Привет! Отправь мне ссылку на YouTube Shorts (или обычное видео), и я скачаю его для тебя максимально быстро 🚀');
});

// Регулярное выражение для проверки ссылок YouTube
const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;

bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  
  if (!ytRegex.test(text)) {
    return ctx.reply('Пожалуйста, отправь корректную ссылку на YouTube.');
  }

  const statusMsg = await ctx.reply('⏳ Скачиваю видео, подожди немного...');
  
  // Генерируем случайное имя файла
  const filename = crypto.randomBytes(8).toString('hex') + '.mp4';
  const filepath = path.join(__dirname, filename);

  // Используем yt-dlp для скачивания лучшего качества видео+аудио в формате mp4
  // yt-dlp работает намного стабильнее и быстрее, чем ytdl-core
  const cmd = `yt-dlp -f "best[ext=mp4]/best" -o "${filepath}" "${text}"`;

  exec(cmd, async (error, stdout, stderr) => {
    if (error) {
      console.error(`Ошибка скачивания: ${error.message}`);
      return ctx.telegram.editMessageText(
        ctx.chat.id, 
        statusMsg.message_id, 
        null, 
        '❌ Произошла ошибка при скачивании видео. Возможно, видео недоступно или удалено.'
      );
    }

    try {
      await ctx.telegram.editMessageText(
        ctx.chat.id, 
        statusMsg.message_id, 
        null, 
        '✅ Видео скачано! Отправляю в чат...'
      );
      
      // Отправляем видео пользователю
      await ctx.replyWithVideo({ source: filepath });
      
      // Удаляем файл после отправки, чтобы не забивать память сервера
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    } catch (err) {
      console.error('Ошибка отправки:', err);
      ctx.reply('❌ Ошибка при отправке видео. Возможно, оно слишком большое (лимит Telegram для ботов — 50 МБ).');
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    }
  });
});

bot.launch().then(() => {
  console.log('Бот успешно запущен!');
});

// Плавная остановка бота
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
