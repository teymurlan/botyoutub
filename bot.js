const { Telegraf } = require('telegraf');

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

  try {
    // Используем API Cobalt для обхода блокировок IP адресов Railway от YouTube
    // Это работает в 10 раз быстрее и не требует скачивания на сам сервер
    const response = await fetch('https://api.cobalt.tools/api/json', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      },
      body: JSON.stringify({
        url: text,
        vQuality: '720', // Качество видео
        filenamePattern: 'classic'
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status === 'error' || !data.url) {
      throw new Error(data.text || 'Не удалось получить ссылку на видео');
    }

    await ctx.telegram.editMessageText(
      ctx.chat.id, 
      statusMsg.message_id, 
      null, 
      '✅ Видео найдено! Отправляю в чат...'
    );
    
    // Отправляем видео пользователю напрямую по ссылке (Telegram скачает его сам)
    await ctx.replyWithVideo({ url: data.url });
    
  } catch (err) {
    console.error('Ошибка:', err.message);
    await ctx.telegram.editMessageText(
      ctx.chat.id, 
      statusMsg.message_id, 
      null, 
      `❌ Произошла ошибка при скачивании.\n\nПричина: YouTube заблокировал запрос или видео недоступно.`
    );
  }
});

bot.launch().then(() => {
  console.log('Бот успешно запущен и готов к работе!');
});

// Плавная остановка бота
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
