const { Telegraf } = require('telegraf');
const { GoogleGenAI } = require('@google/genai');

// 1. Подключение ключей из настроек Render
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 2. Приветствие при старте
bot.start((ctx) => ctx.reply('Привет! Я твой бесплатный помощник с домашним заданием. Пришли мне текст задания, и я его решу.'));

// 3. Отправка задания в ИИ Google Gemini
bot.on('text', async (ctx) => {
  try {
    // Показываем статус "печатает..." в Telegram
    await ctx.sendChatAction('typing');

        // Отправляем запрос в нейросеть Gemini 3.8 Flash
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: `Реши домашнее задание: ${ctx.message.text}`,
    });


    // Отправляем решение пользователю
    await ctx.reply(response.text);

  } catch (erro
    console.error(error);
    await ctx.reply(`Произошла ошибка: ${error.message}`);
  }
});

// 4. Защита от отключения бесплатного тарифа Render
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
