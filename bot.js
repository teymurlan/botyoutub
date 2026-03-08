const { Telegraf } = require('telegraf');
const axios = require('axios');
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

  const statusMsg = await ctx.reply('⏳ Обрабатываю видео...');
  let filepath = null;

  try {
    // 1. Получаем ссылку на скачивание через Cobalt API
    const { data } = await axios.post('https://api.cobalt.tools/api/json', {
      url: text,
      vQuality: '720',
      filenamePattern: 'classic'
    }, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Origin': 'https://cobalt.tools',
        'Referer': 'https://cobalt.tools/'
      }
    });

    if (data.status === 'error' || !data.url) {
      throw new Error(data.text || 'Не удалось получить ссылку на видео');
    }

    await ctx.telegram.editMessageText(
      ctx.chat.id, 
      statusMsg.message_id, 
      null, 
      '⬇️ Скачиваю видео на сервер...'
    );

    // 2. Скачиваем видео во временный файл на сервере Railway
    // Мы делаем это, так как сервера Telegram часто блокируются при попытке скачать видео по прямой ссылке
    const filename = crypto.randomBytes(8).toString('hex') + '.mp4';
    filepath = path.join(__dirname, filename);
    
    const writer = fs.createWriteStream(filepath);
    const response = await axios({
      url: data.url,
      method: 'GET',
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Origin': 'https://cobalt.tools',
        'Referer': 'https://cobalt.tools/'
      }
    });

    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    await ctx.telegram.editMessageText(
      ctx.chat.id, 
      statusMsg.message_id, 
      null, 
      '🚀 Отправляю видео в чат...'
    );

    // 3. Отправляем скачанный файл в Telegram
    await ctx.replyWithVideo({ source: filepath });
    
    // Удаляем статусное сообщение после успешной отправки
    await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);

  } catch (err) {
    console.error('Ошибка:', err.message);
    await ctx.telegram.editMessageText(
      ctx.chat.id, 
      statusMsg.message_id, 
      null, 
      `❌ Произошла ошибка при скачивании.\n\nПричина: ${err.message}`
    );
  } finally {
    // 4. Обязательно удаляем временный файл, чтобы не забить память сервера
    if (filepath && fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
  }
});

bot.launch().then(() => {
  console.log('Бот успешно запущен и готов к работе!');
});

// Плавная остановка бота
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
