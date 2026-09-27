const { Telegraf, Markup } = require('telegraf')
const { GoogleGenAI } = require('@google/genai')
const bot = new Telegraf(process.env.TELEGRAM_TOKEN || process.env.BOT_TOKEN)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

const ADMIN_ID = 7959760533
let enabled = true
const users = new Set()
const premium = new Set([7959760533]) // ты сразу премиум
    const limits = new Map()
    function canUse(id){
      if(premium.has(id)) return {ok:true, left:'∞'}
      const today = new Date().toDateString()
      let d = limits.get(id)
      if(!d || d.date!= today){ d={count:0, date:today}; limits.set(id,d) }
      if(d.count >= 5) return {ok:false}
      d.count++
      return {ok:true, left: 5 - d.count}
    }
// СБОР ЮЗЕРОВ
bot.use((ctx, next) => {
  if (ctx.from) users.add(ctx.from.id)
  if (!enabled && ctx.from.id!= ADMIN_ID) return ctx.reply('🔧 Тех работы, бот выключен админом')
  return next()
})

bot.start((ctx) => ctx.reply('Привет! Отправь задание (текст или фото) 📚', { parse_mode: 'Markdown' }))

// --- АДМИНКА ---
function adminPanel() {
  return Markup.inlineKeyboard([
    [Markup.button.callback(enabled? '🟢 Выключить бота' : '🔴 Включить бота', 'toggle')],
    [Markup.button.callback(`👥 Юзеры: ${users.size}`, 'stats'), Markup.button.callback(`⭐ Премиум: ${premium.size}`, 'prem_list')],
    [Markup.button.callback('➕ Дать премиум', 'add_prem'), Markup.button.callback('➖ Забрать премиум', 'rem_prem')]
  ])
}

bot.command('admin', (ctx) => {
  if (ctx.from.id!= ADMIN_ID) return
  ctx.reply(`👑 Админка\n\n👥 Всего юзеров в боте: ${users.size}\n⭐ Премиум: ${premium.size}\nСтатус: ${enabled?'ВКЛ':'ВЫКЛ'}`, adminPanel())
})

bot.action('toggle', async (ctx) => { enabled =!enabled; await ctx.editMessageText(`Статус: ${enabled?'ВКЛ':'ВЫКЛ'}\nЮзеров: ${users.size}`, adminPanel()) })
bot.action('stats', async (ctx) => { await ctx.answerCbQuery(); ctx.reply(`📊 Сейчас в боте:\n👥 Всего уникальных: ${users.size}\n⭐ Премиум: ${premium.size}\n\nID список:\n${[...users].slice(0,50).join(', ')}`) })
bot.action('prem_list', async (ctx) => { await ctx.answerCbQuery(); ctx.reply(`⭐ Премиум ID:\n${[...premium].join('\n') || 'пусто'}`) })
bot.action('add_prem', async (ctx) => { await ctx.answerCbQuery(); ctx.reply('Напиши: /give ID\nПример: /give 123456789') })
bot.action('rem_prem', async (ctx) => { await ctx.answerCbQuery(); ctx.reply('Напиши: /remove ID\nПример: /remove 123456789') })

bot.command('give', (ctx) => {
  if (ctx.from.id!= ADMIN_ID) return
  const id = Number(ctx.message.text.split(' ')[1]); if(!id) return ctx.reply('ID не верный')
  premium.add(id); ctx.reply(`✅ Дал премиум ${id}`)
})
bot.command('remove', (ctx) => {
  if (ctx.from.id!= ADMIN_ID) return
  const id = Number(ctx.message.text.split(' ')[1]); if(!id) return ctx.reply('ID не верный')
  premium.delete(id); ctx.reply(`❌ Забрал премиум у ${id}`)
})

// --- УНИВЕРСАЛЬНЫЙ ОБРАБОТЧИК (оставил твой) ---
    bot.on(['text','photo','document'], async (ctx) => {
  if (ctx.message.text?.startsWith('/')) return

  const check = canUse(ctx.from.id)
  if (!check.ok) return ctx.reply('❌ Лимит 20 в день кончился')

  try {
    await ctx.sendChatAction('typing')
    let contents
    if (ctx.message.photo || ctx.message.document) {
      let fileId = ctx.message.photo? ctx.message.photo[ctx.message.photo.length-1].file_id : ctx.message.document.file_id
      const fileLink = await ctx.telegram.getFileLink(fileId)
      const res = await fetch(fileLink.href)
      const buffer = await res.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      const caption = ctx.message.caption || 'Реши это задание подробно'
      contents = [{ inlineData: { mimeType: 'image/jpeg', data: base64 } }, { text: caption }]
    } else {
      contents = ctx.message.text
    }
    const result = await ai.models.generateContent({
  model: 'gemini-3.5-flash',
  contents: [{ role: 'user', parts: [{ text: "Отвечай ТОЛЬКО обычным текстом. ЗАПРЕЩЕНО использовать LaTeX, \\times, \\cdot, \\begin, $, {array}. Пиши знак умножения как x или *. Задание: " + contents }] }]
})
let text = result.text.replace(/\\times/g,'x').replace(/\\cdot/g,'*').replace(/\\[a-z]+/g,'').replace(/[\$\\{}]/g,'').replace(/{array}/g,'')
    // Если не премиум - ограничение
    if (!premium.has(ctx.from.id)) text = text.slice(0,1000) + '\n\n⭐ Купи премиум для полных ответов'
    ctx.reply(text, { parse_mode: 'Markdown' })
  } catch (e) { ctx.reply('Ошибка: ' + e.message.slice(0,300)) }
})

require('http').createServer((_,res)=>res.end('ok')).listen(process.env.PORT||10000)
bot.launch()
