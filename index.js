const { Telegraf, Markup } = require('telegraf')
const { GoogleGenAI } = require('@google/genai')
const bot = new Telegraf(process.env.TELEGRAM_TOKEN || process.env.BOT_TOKEN)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

const ADMIN_ID = 7959760533
let enabled = true
const users = new Set()
const premium = new Set([7959760533])
const limits = new Map()

function canUse(id){
  if(premium.has(id)) return {ok:true, left:'∞'}
  const today = new Date().toDateString()
  let d = limits.get(id)
  if(!d || d.date!=today){ d={count:0, date:today}; limits.set(id,d) }
  if(d.count>=20) return {ok:false}
  d.count++
  return {ok:true, left: 20 - d.count}
}

bot.use((ctx, next) => {
  if (ctx.from) users.add(ctx.from.id)
  if (!enabled && ctx.from.id!=ADMIN_ID) return ctx.reply('🔧 Тех работы, бот выключен админом')
  return next()
})

bot.start((ctx) => ctx.reply('Привет! Отправь задание (текст или фото) 📚'))

function adminPanel(){
  return Markup.inlineKeyboard([
    [Markup.button.callback(enabled?'🟢 Выключить бота':'🔴 Включить бота','toggle')],
    [Markup.button.callback(`👥 Юзеры: ${users.size}`,'stats'), Markup.button.callback(`⭐ Премиум: ${premium.size}`,'prem_list')],
    [Markup.button.callback('➕ Дать премиум','add_prem'), Markup.button.callback('➖ Забрать премиум','rem_prem')]
  ])
}

bot.command('admin',(ctx)=>{
  if(ctx.from.id!=ADMIN_ID) return
  ctx.reply(`👑 Админка\n\n👥 Всего юзеров: ${users.size}\n⭐ Премиум: ${premium.size}\nСтатус: ${enabled?'ВКЛ':'ВЫКЛ'}`, adminPanel())
})

bot.action('toggle', async (ctx)=>{ enabled=!enabled; await ctx.editMessageText(`Статус: ${enabled?'ВКЛ':'ВЫКЛ'}\nЮзеров: ${users.size}`, adminPanel()) })
bot.action('stats', async (ctx)=>{ await ctx.answerCbQuery(); ctx.reply(`📊 Юзеров: ${users.size}\n${[...users].slice(0,50).join(', ')}`) })
bot.action('prem_list', async (ctx)=>{ await ctx.answerCbQuery(); ctx.reply(`⭐ Премиум:\n${[...premium].join('\n')||'пусто'}`) })
bot.action('add_prem', async (ctx)=>{ await ctx.answerCbQuery(); ctx.reply('Напиши: /give ID') })
bot.action('rem_prem', async (ctx)=>{ await ctx.answerCbQuery(); ctx.reply('Напиши: /remove ID') })

bot.command('give',(ctx)=>{
  if(ctx.from.id!=ADMIN_ID) return
  const id=Number(ctx.message.text.split(' ')[1]); if(!id) return ctx.reply('ID не верный')
  premium.add(id); ctx.reply(`✅ Дал премиум ${id}`)
})
bot.command('remove',(ctx)=>{
  if(ctx.from.id!=ADMIN_ID) return
  const id=Number(ctx.message.text.split(' ')[1]); if(!id) return ctx.reply('ID не верный')
  premium.delete(id); ctx.reply(`❌ Забрал премиум ${id}`)
})

bot.on(['text','photo','document'], async (ctx)=>{
  if(ctx.message.text?.startsWith('/')) return
  const check=canUse(ctx.from.id)
  if(!check.ok) return ctx.reply('❌ Лимит 20 в день кончился. Завтра обнулится или купи премиум ⭐')

  try{
    await ctx.sendChatAction('typing')
    let contentsForAI
    if(ctx.message.photo || ctx.message.document){
      let fileId = ctx.message.photo? ctx.message.photo[ctx.message.photo.length-1].file_id : ctx.message.document.file_id
      const fileLink = await ctx.telegram.getFileLink(fileId)
      const res = await fetch(fileLink.href)
      const base64 = Buffer.from(await res.arrayBuffer()).toString('base64')
      const caption = ctx.message.caption || 'Реши это задание подробно, простым текстом без LaTeX'
      contentsForAI = [{ inlineData: { mimeType: 'image/jpeg', data: base64 } }, { text: caption }]
    }else{
      contentsForAI = [{ text: 'Отвечай простым текстом без LaTeX, умножение как x. Задание: ' + ctx.message.text }]
    }

    let finalText=''
    for(const m of ['gemini-2.5-flash','gemini-2.5-flash-lite']){
      try{
        const result = await ai.models.generateContent({ model: m, contents: contentsForAI })
        finalText = result.text
        break
      }catch(e){
        if(String(e).includes('503')||String(e).includes('UNAVAILABLE')||String(e).includes('overloaded')) continue
        throw e
      }
    }

    if(!finalText) return ctx.reply('Модели заняты, попробуй через минуту')
    let text = finalText.replace(/\\times/g,' x ').replace(/\\cdot/g,' * ').replace(/\\[a-zA-Z]+/g,'').replace(/[\$\\{}]/g,'')
    if(!premium.has(ctx.from.id)) text = text.slice(0,1000) + '\n\n⭐ Премиум для полных ответов'
    await ctx.reply(text)

  }catch(e){
    console.error(e)
    await ctx.reply('Ошибка: '+e.message.slice(0,200))
  }
})

require('http').createServer((_,res)=>res.end('ok')).listen(process.env.PORT||10000)
bot.launch()
console.log('Bot started limit 20')
