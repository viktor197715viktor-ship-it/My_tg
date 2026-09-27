const { Telegraf } = require('telegraf')
const { GoogleGenAI } = require('@google/genai')
const http = require('http')

const bot = new Telegraf(process.env.TELEGRAM_TOKEN)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

const ADMIN_ID = 7959760533
let enabled = true

// АДМИНКА
bot.command('admin', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return
  ctx.reply('/on - вкл\n/off - выкл')
})
bot.command('on', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return
  enabled = true
  ctx.reply('✅ вкл')
})
bot.command('off', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return
  enabled = false
  ctx.reply('❌ выкл')
})
bot.use((ctx, next) => {
  if (!enabled && ctx.from.id !== ADMIN_ID) {
    return ctx.reply('🔧 Тех работы')
  }
  return next()
})

bot.start((ctx) => ctx.reply('Привет! Кидай домашку'))

bot.on('message', async (ctx) => {
  try {
    if (ctx.message.text?.startsWith('/')) return
    
    await ctx.sendChatAction('typing')

    let response
    if (ctx.message.photo) {
      const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id
      const fileLink = await ctx.telegram.getFileLink(fileId)
      const imageRes = await fetch(fileLink.href)
      const imageBuffer = Buffer.from(await imageRes.arrayBuffer())
      const base64 = imageBuffer.toString('base64')

      response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [
          { role: 'user', parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64 } },
            { text: 'Реши это задание кратко и понятно, без LaTeX, на русском.' }
          ]}
        ]
      })
    } else if (ctx.message.text) {
      response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: `Реши: ${ctx.message.text}. Отвечай кратко и понятно, без LaTeX.`
      })
    } else {
      return
    }

    const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text || 'Не смог решить'
    await ctx.reply(text.slice(0, 4000))

  } catch (e) {
    console.error('GEMINI ERROR:', e.message)
    if (ctx.from.id === ADMIN_ID) {
      await ctx.reply(`Ошибка: ${e.message.slice(0, 500)}`)
    } else {
      await ctx.reply('Ошибка, попробуй еще')
    }
  }
})

http.createServer((req, res) => {
  res.writeHead(200)
  res.end('ok')
}).listen(process.env.PORT || 10000, '0.0.0.0')

bot.launch().then(() => console.log('Бот запущен'))
