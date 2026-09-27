const { Telegraf, Markup } = require('telegraf')
const { GoogleGenAI } = require('@google/genai')
const http = require('http')

const bot = new Telegraf(process.env.TELEGRAM_TOKEN)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
const ADMIN_ID = 7959760533
let enabled = true
let users = new Set()
let totalRequests = 0

function panel() {
  return Markup.inlineKeyboard([
    [Markup.button.callback(enabled ? '🟢 ВКЛ' : '🔴 ВЫКЛ', 'toggle')],
    [Markup.button.callback('📊 Стата', 'stats')]
  ])
}

bot.command('admin', (ctx) => {
  if (ctx.from.id != ADMIN_ID) return
  ctx.reply(`Админка: ${enabled ? 'ВКЛ' : 'ВЫКЛ'}\nЮзеров: ${users.size}`, panel())
})
bot.action('toggle', async (ctx) => {
  if (ctx.from.id != ADMIN_ID) return
  enabled = !enabled
  await ctx.answerCbQuery(enabled ? 'Включил' : 'Выключил')
  await ctx.editMessageText(`Админка: ${enabled ? 'ВКЛ' : 'ВЫКЛ'}\nЮзеров: ${users.size}`, panel())
})
bot.action('stats', (ctx) => ctx.answerCbQuery(`Юзеров: ${users.size}, Запросов: ${totalRequests}`))

bot.command('on', (ctx) => { if (ctx.from.id == ADMIN_ID) { enabled = true; ctx.reply('✅ вкл') } })
bot.command('off', (ctx) => { if (ctx.from.id == ADMIN_ID) { enabled = false; ctx.reply('❌ выкл') } })
bot.use((ctx, next) => {
  if (ctx.from) users.add(ctx.from.id)
  if (!enabled && ctx.from.id != ADMIN_ID) return ctx.reply('🔧 тех работы')
  return next()
})

bot.start((ctx) => ctx.reply('Кидай домашку'))
bot.on('message', async (ctx) => {
  try {
    if (ctx.message.text?.startsWith('/')) return
    await ctx.sendChatAction('typing')
    totalRequests++
    let res
    if (ctx.message.photo) {
      const fileId = ctx.message.photo.pop().file_id
      const link = await ctx.telegram.getFileLink(fileId)
      const buf = Buffer.from(await (await fetch(link.href)).arrayBuffer())
      res = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'image/jpeg', data: buf.toString('base64') } }, { text: 'Реши кратко на русском' }] }]
      })
    } else {
      res = await ai.models.generateContent({ model: 'gemini-1.5-flash', contents: ctx.message.text })
    }
    ctx.reply((res.text || 'нет ответа').slice(0, 4000))
  } catch (e) {
    console.error(e)
    ctx.reply('Ошибка: ' + e.message.slice(0,200))
  }
})

http.createServer((_, r) => { r.end('ok') }).listen(process.env.PORT || 10000, '0.0.0.0')
bot.launch().then(() => console.log('Запущен'))
