const { Telegraf } = require('telegraf')
// Исправленный импорт официального SDK Google Gen AI
const { GoogleGenAI } = require('@google/genai')
const http = require('http')

const bot = new Telegraf(process.env.TELEGRAM_TOKEN || process.env.BOT_TOKEN || process.env.TELEGRAM_TOKEN)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

const ADMIN_ID = 7959760533
const isAdmin = (ctx) => ctx.from?.id === ADMIN_ID
let botEnabled = true

// Функция для безопасного экранирования HTML-тегов в логах ошибок
const escapeHtml = (text) => text?.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") || ''

// ГЛОБАЛЬНЫЙ СКРЫТЫЙ ПЕРЕХВАТЧИК ОШИБОК ДЛЯ АДМИНА
bot.catch(async (err, ctx) => {
  console.error('Ошибка в Telegraf:', err)
  try {
    const errMsg = `⚠️ <b>Ошибка в боте!</b>\n` +
                   `<b>Пользователь:</b> @${ctx.from?.username || 'нет'} (ID: <code>${ctx.from?.id}</code>)\n` +
                   `<b>Текст ошибки:</b> <code>${escapeHtml(err.message)}</code>\n\n` +
                   `<b>Стек:</b>\n<pre><code>${escapeHtml(err.stack?.substring(0, 2500))}</code></pre>`
    await ctx.telegram.sendMessage(ADMIN_ID, errMsg, { parse_mode: 'HTML' })
  } catch (e) {
    console.error('Не удалось отправить ошибку админу:', e)
  }
})

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
  
  // Переносим всю логику в try-catch внутри хэндлера, чтобы отвечать пользователю при падении ИИ
  try {
    await ctx.sendChatAction('typing')
    let contents

    if (ctx.message.photo || ctx.message.document) {
      let fileId, mimeType
      
      if (ctx.message.photo) {
        fileId = ctx.message.photo.pop().file_id
        mimeType = 'image/jpeg'
      } else {
        fileId = ctx.message.document.file_id
        // Автоматически определяем mime_type документа, переданного Telegram
        mimeType = ctx.message.document.mime_type || 'image/jpeg'
      }

      const link = await ctx.telegram.getFileLink(fileId)
      const response = await fetch(link.href)
      const arrayBuffer = await response.arrayBuffer()
      const base64Data = Buffer.from(arrayBuffer).toString('base64')
      
      const promptText = (ctx.message.caption || 'Реши') + '. Кратко без воды, без LaTeX'

      // Исправленная структура contents под новый SDK @google/genai
      contents = [
        {
          parts: [
            { inlineData: { mimeType: mimeType, data: base64Data } },
            { text: promptText }
          ]
        }
      ]
    } else {
      // Структура для обычного текста под новый SDK
      contents = [{ parts: [{ text: `Реши: ${ctx.message.text}` }] }]
    }

    // Правильный вызов API согласно официальной документации @google/genai
    const res = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      config: { 
        systemInstruction: "Отвечай кратко, без LaTeX, без \$" 
      },
      contents: contents
    })

    // Извлечение текста ответа в новом SDK происходит через res.text
    if (res && res.text) {
      await ctx.reply(res.text.replace(/\$/g, ''))
    } else {
      await ctx.reply('⚠️ Нейросеть вернула пустой ответ. Попробуйте отправить другое фото.')
    }

  } catch (e) { 
    console.error(e)
    // Сообщаем пользователю, а подробный лог уйдет админу через bot.catch
    await ctx.reply('❌ Произошла ошибка при обработке задания. Администратор уже уведомлен.')
    throw e // Пробрасываем ошибку дальше в глобальный bot.catch
  }
})

const port = process.env.PORT || 10000
http.createServer((req, res) => {
  res.writeHead(200); res.end('Bot is running')
}).listen(port, '0.0.0.0')

bot.launch()
console.log('Бот запущен')
