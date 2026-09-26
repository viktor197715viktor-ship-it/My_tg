const { Telegraf } = require('telegraf');
const Anthropic = require('@anthropic-ai/sdk');

// 1. Подключение ключей из настроек Render
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// 2. Приветствие при старте
bot.start((ctx) => ctx.reply('Привет! Пришли мне текст домашнего задания, и я помогу его решить.'));

// 3. Отправка задания в ИИ Anthropic (Claude)
bot.on('text', async (ctx) => {
  try {
    // Показываем статус "печатает..." в Telegram
    await ctx.sendChatAction('typing');

    // Отправляем запрос в Claude
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 2000,
      temperature: 0.5,
      system: 'Ты — опытный школьный учитель. Подробно и понятно решай домашние задания.',
      messages: [{ role: 'user', content: ctx.message.text }],
    });

    // Отправляем решение пользователю
    await ctx.reply(response.content[0].text);

  } catch (error) {
    console.error(error);
    await ctx.reply(`Произошла ошибка: ${error.message}`);
  }
});

// 4. Защита от отключения бесплатного тарифа Render (встроенный мини-сервер)
const http = require('http');
const port = process.env.PORT || 10000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running');
}).listen(port, '0.0.0.0');

// Запуск бота
bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
