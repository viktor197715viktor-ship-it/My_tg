const { Telegraf } = require('telegraf')
const { GoogleGenAI } = require('@google/genai')

// 1. Подключение ключей из настроек Render / Экосреды
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

// 2. Приветствие при старте
bot.start((ctx) => ctx.reply('Привет! Я твой лаконичный помощник по домашним заданиям. Отправь мне пример или задачу, и я быстро решу её!'))

// 3. Отправка задания в ИИ Google Gemini
bot.on('text', async (ctx) => {
  try {
    // Показываем статус "печатает..." в Telegram
    await ctx.sendChatAction('typing');

    // Отправляем запрос в нейросеть с жесткими системными правилами
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: "Ты — лаконичный школьный помощник. Твоя цель — давать ответы максимально кратко и понятно, без «воды» и длинных приветствий. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО использовать разметку LaTeX, знаки доллара (\$) и команды вроде \(\times, \frac.\) Пиши математические знаки только обычным текстом (например: *, /, +, -, =). Описывай шаги решения короткими строчками.",
      },
      contents: `Реши домашнее задание: ${ctx.message.text}`
    });

    // Отправляемый ответ пользователю с поддержкой Markdown
    await ctx.reply(response.text, { parse_mode: 'Markdown' });

  } catch (error) {
    console.error(error);
    await ctx.reply('Произошла ошибка при обработке вашего запроса.');
  }
});

// 4. Защита от отключения бесплатного тарифа (Веб-сервер для пинга)
const http = require('http');
const port = process.env.PORT || 10000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running');
}).listen(port, '0.0.0.0');

// Запуск бота
bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
