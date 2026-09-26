const { Telegraf, Markup } = require('telegraf');
const http = require('http');

// Ваш рабочий токен бота
const bot = new Telegraf('8663574409:AAHg6SbhcZVtAz0mcL8Fdo0NZHqpzSTrUZ4');

// Ответ на команду /start
bot.start((ctx) => {
  ctx.reply(
    `👋 Привет, ${ctx.from.first_name}! Это бот нового поколения.\n\nНажми на кнопку ниже, чтобы запустить уникальное мини-приложение прямо внутри Telegram! 👇`,
    Markup.inlineKeyboard([
      Markup.button.webApp('🚀 Запустить Web App Игра', 'https://famobi.com')
    ])
  );
});

// Ответ на любое другое текстовое сообщение
bot.on('text', (ctx) => {
  ctx.reply('Используй команду /start, чтобы запустить интерактивное мини-приложение!');
});

bot.launch();
console.log('Бот с поддержкой Web App успешно запущен');

// Фальшивый сервер для Render, чтобы убрать ошибку портов
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running\n');
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер заглушка слушает порт ${PORT}`);
});
