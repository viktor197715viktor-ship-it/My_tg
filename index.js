const { Telegraf } = require('telegraf')
const { GoogleGenAI } = require('@google/genai')
const http = require('http')

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || process.env.TELEGRAM_TOKEN)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

// ========== АДМИНКА - УЖЕ ТВОЙ ID ==========
const ADMIN_ID = 7959760533
const isAdmin = (ctx) => ctx.from?.id === ADMIN_ID
let botEnabled = true

bot.command('admin', (ctx) => {
  if (!isAdmin(ctx)) return
  ctx.reply(`🔧 Админка:\n/on - включить\n/off - выключить\n/stats - статус`)
})
bot.command('on', (ctx) => {
  if (!isAdmin(ctx)) return
  botEnabled = true
  ctx.reply('✅ Бот включен')
})
bot.command('off', (ctx) => {
  if (!isAdmin(ctx)) return
  botEnabled = false
  ctx.reply('❌ Бот выключен для всех')
})
bot.command('stats', (ctx) => {
  if (!isAdmin(ctx)) return
  ctx.reply(`Статус: ${botEnabled ? 'включен ✅' : 'выключен ❌'}`)
})
bot.use((ctx, next) => {
  if (!botEnabled && !isAdmin(ctx)) return ctx.reply('🔧 Тех. работы')
  return next()
})

bot.start((ctx) => ctx.reply('Привет! Скинь домашку фото или текстом'))

bot.on(['text', 'photo', 'document'], async (ctx) => {
  if (ctx.message.text?.startsWith('/')) return
  try {
    await ctx.sendChatAction('typing')
    let contents
    if (ctx.message.photo || ctx.message.document) {
      let fileId = ctx.message.photo ? ctx.message.photo.pop().file_id : ctx.message.document.file_id
      const link = await ctx.telegram.getFileLink(fileId)
      const buf = Buffer.from(await (await fetch(link.href)).arrayBuffer())
      contents = [
        { inlineData: { mimeType: 'image/jpeg', data: buf.toString('base64') } },
        { text: (ctx.message.caption || 'Реши') + '. Кратко, без LaTeX' }
      ]
    } else {
      contents = `Реши: ${ctx.message.text}`
    }
    const res = await ai.models.generateContent({
      model: 'gemini-2.0-flash-lite',
      config: { systemInstruction: "Отвечай кратко, без LaTeX, без $" },
      contents: contents
    })
    await ctx.reply(res.text.replace(/\$/g, ''))
  } catch (e) { console.error(e) }
})

const port = process.env.PORT || 10000
http.createServer((req, res) => {
  res.writeHead(200); res.end('Bot is running')
}).listen(port, '0.0.0.0')

bot.launch()
console.log('Бот запущен')
