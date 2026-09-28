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
  if(premium.has(id)) return {ok:true}
  const today = new Date().toDateString()
  let d = limits.get(id)
  if(!d || d.date!=today){ d={count:0,date:today}; limits.set(id,d) }
  if(d.count>=20) return {ok:false}
  d.count++
  return {ok:true}
}

bot.use((ctx,next)=>{
  if(ctx.from) users.add(ctx.from.id)
  if(!enabled && ctx.from.id!=ADMIN_ID) return ctx.reply('🔧 Тех работы')
  return next()
})

bot.start((ctx)=>ctx.reply('Привет! Отправь задание 📚'))
function adminPanel(){
  return Markup.inlineKeyboard([
    [Markup.button.callback(enabled?'🟢 Выключить':'🔴 Включить','toggle')],
    [Markup.button.callback(`👥 ${users.size}`,'stats'), Markup.button.callback(`⭐ ${premium.size}`,'prem_list')],
    [Markup.button.callback('➕ Дать','add_prem'), Markup.button.callback('➖ Забрать','rem_prem')]
  ])
}
bot.command('admin',(ctx)=>{ if(ctx.from.id!=ADMIN_ID) return; ctx.reply(`Админка\nЮзеров: ${users.size}\nПремиум: ${premium.size}\nСтатус: ${enabled?'ВКЛ':'ВЫКЛ'}`,adminPanel()) })
bot.action('toggle',async(ctx)=>{ enabled=!enabled; await ctx.editMessageText(`Статус: ${enabled?'ВКЛ':'ВЫКЛ'}`,adminPanel()) })
bot.action('stats',async(ctx)=>{ await ctx.answerCbQuery(); ctx.reply(`Юзеров: ${[...users].slice(0,100).join(', ')}`) })
bot.action('prem_list',async(ctx)=>{ await ctx.answerCbQuery(); ctx.reply(`Премиум: ${[...premium].join(', ')}`) })
bot.action('add_prem',async(ctx)=>{ await ctx.answerCbQuery(); ctx.reply('Напиши: /give ID') })
bot.action('rem_prem',async(ctx)=>{ await ctx.answerCbQuery(); ctx.reply('Напиши: /remove ID') })
bot.command('give',(ctx)=>{ if(ctx.from.id!=ADMIN_ID) return; const id=Number(ctx.message.text.split(' ')[1]); premium.add(id); ctx.reply(`✅ Дал ${id}`) })
bot.command('remove',(ctx)=>{ if(ctx.from.id!=ADMIN_ID) return; const id=Number(ctx.message.text.split(' ')[1]); premium.delete(id); ctx.reply(`❌ Забрал ${id}`) })

bot.on(['text','photo','document'], async (ctx)=>{
  if(ctx.message.text?.startsWith('/')) return
  if(!canUse(ctx.from.id).ok) return ctx.reply('❌ Лимит 20 в день кончился')

  try{
    await ctx.sendChatAction('typing')
    let contentsForAI
    if(ctx.message.photo || ctx.message.document){
      let fileId = ctx.message.photo? ctx.message.photo[ctx.message.photo.length-1].file_id : ctx.message.document.file_id
      const fileLink = await ctx.telegram.getFileLink(fileId)
      const res = await fetch(fileLink.href)
      const base64 = Buffer.from(await res.arrayBuffer()).toString('base64')
      const caption = ctx.message.caption || 'Реши подробно простым текстом без LaTeX'
      contentsForAI = [{ inlineData: { mimeType: 'image/jpeg', data: base64 } }, { text: caption }]
    }else{
      contentsForAI = [{ text: 'Отвечай простым текстом без LaTeX, умножение как x. Задание: ' + ctx.message.text }]
    }

    // НОВЫЕ МОДЕЛИ 2026
    let finalText=''
    const modelsToTry = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-1.5-flash']
    for(const m of modelsToTry){
      try{
        const result = await ai.models.generateContent({ model: m, contents: contentsForAI })
        finalText = result.text
        if(finalText) break
      }catch(e){
        console.log(`Модель ${m} не сработала: ${e.message.slice(0,100)}`)
        if(String(e).includes('404') || String(e).includes('503') || String(e).includes('UNAVAILABLE') || String(e).includes('overloaded')){
          continue // пробуем следующую
        }
        throw e
      }
    }

    if(!finalText) return ctx.reply('⏳ Все модели перегружены, попробуй через 1-2 минуты. Это бывает когда много запросов.')

    let text=finalText.replace(/\\times/g,' x ').replace(/\\cdot/g,' * ').replace(/\\[a-zA-Z]+/g,'').replace(/[\$\\{}]/g,'')
    if(!premium.has(ctx.from.id)) text=text.slice(0,1000)+'\n\n⭐ Премиум для полных ответов'
    await ctx.reply(text)

  }catch(e){
    console.error(e)
    await ctx.reply('Ошибка: '+e.message.slice(0,300))
  }
})
const APP_URL = process.env.URL; // URL вашего приложения (например, https://onrender.com)

if (APP_URL) {
  setInterval(async () => {
    try {
      await fetch(APP_URL);
      console.log('Само-пинг выполнен успешно');
    } catch (e) {
      console.error('Ошибка само-пинга:', e.message);
    }
  }, 10 * 60 * 1000); // 10 минут в миллисекундах
}

require('http').createServer((_,res)=>res.end('ok')).listen(process.env.PORT||10000)
bot.launch()
console.log('Bot started 3.8-flash limit 20')
