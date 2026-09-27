const { Telegraf } = require('telegraf')
const { GoogleGenAI } = require('@google/genai')

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

bot.start((ctx) => ctx.reply(
  'Привет! Отправь мне домашнее задание (текстом или фото), и я **быстро и кратко** решу его без лишней «воды».',
  { parse_mode: 'Markdown' }
))

// УНИВЕРСАЛЬНЫЙ ОБРАБОТЧИК
bot.on(['text', 'photo', 'document'], async (ctx) => {
  try {
    await ctx.sendChatAction('typing')

    let contents;

    // 1. ЕСЛИ ФОТО
    if (ctx.message.photo || ctx.message.document) {
      let fileId;
      if (ctx.message.photo) {
        fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id
      } else {
        fileId = ctx.message.document.file_id
      }

      const fileLink = await ctx.telegram.getFileLink(fileId)
      const res = await fetch(fileLink.href)
      const buffer = await res.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      
      const caption = ctx.message.caption || "Реши это домашнее задание"

      contents = [
        { inlineData: { mimeType: 'image/jpeg', data: base64 } },
        { text: `${caption}. Реши максимально кратко, без воды. ЗАПРЕЩЕНО LaTeX и символы $ \\times \\frac. Пиши математику обычным текстом: * / + - =` }
      ]
    } 
    // 2. ЕСЛИ ТЕКСТ
    else {
      contents = `Реши домашнее задание: ${ctx.message.text}`
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      config: {
        systemInstruction: "Ты — лаконичный школьный помощник. Отвечай кратко и понятно, без воды и приветствий. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО использовать LaTeX, знаки доллара, команды \\times, \\frac. Пиши математику только обычным текстом.",
      },
      contents: contents
    })

    let answer = response.text
    // Чистим ответ от $ чтобы не ломал Markdown
    answer = answer.replace(/\$/g, '')

    await ctx.reply(answer, { parse_mode: 'Markdown' })

  } catch (error) {
    console.error(error)
    await ctx.reply('Ошибка :( Попробуй скинуть еще раз, чуть четче фото.')
  }
})

// Веб-сервер чтобы Render не спал
const http = require('http')
const port = process.env.PORT || 10000
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('Bot is running')
}).listen(port, '0.0.0.0')

bot.launch()
console.log('Бот запущен')

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
