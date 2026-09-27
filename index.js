const { Telegraf } = require('telegraf')
const { GoogleGenAI } = require('@google/genai')
const http = require('http')

if (!process.env.TELEGRAM_TOKEN && !process.env.BOT_TOKEN) {
  console.error('НЕТ TELEGRAM_TOKEN!')
}
if (!process.env.GEMINI_API_KEY) {
  console.error('НЕТ GEMINI_API_KEY!')
}

const bot = new Telegraf(process.env.TELEGRAM_TOKEN || process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

const ADMIN_ID = 7959760533
let enabled = true

bot.command('admin', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return
  ctx.reply('/on - вкл\n/off - выкл')
})
bot.command('on', (ctx) => { if(ctx.from.id===ADMIN_ID){enabled=true; ctx.reply('✅ вкл')} })
bot.command('off', (ctx) => { if(ctx.from.id===ADMIN_ID){enabled=false; ctx.reply('❌ выкл')} })
bot.use((ctx,next)=>{ if(!enabled && ctx.from.id!==ADMIN_ID) return ctx.reply('тех работы'); return next() })

bot.start((ctx) => ctx.reply('Привет! Кидай домашку'))
bot.on(['text','photo','document'], async (ctx) => {
  if (ctx.message.text?.startsWith('/')) return
  try {
    await ctx.sendChatAction('typing')
    let contents = ctx.message.text || 'Реши'
    if (ctx.message.photo || ctx.message.document) {
      const fileId = ctx.message.photo ? ctx.message.photo.pop().file_id : ctx.message.document.file_id
      const link = await ctx.telegram.getFileLink(fileId)
      const buf = Buffer.from(await (await fetch(link.href)).arrayBuffer())
      contents = [{inlineData:{mimeType:'image/jpeg', data: buf.toString('base64')}}, {text: 'Реши кратко'}]
    }
    const r = await ai.models.generateContent({ model: 'gemini-2.0-flash-lite', contents: contents })
    await ctx.reply(r.text.slice(0,4000))
  } catch(e){ console.error(e); ctx.reply('Ошибка, попробуй еще') }
})

http.createServer((_,res)=>{res.writeHead(200);res.end('ok')}).listen(process.env.PORT||10000,'0.0.0.0')
bot.launch().then(()=>console.log('Бот запущен'))
