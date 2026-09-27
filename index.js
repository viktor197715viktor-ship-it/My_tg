const { Telegraf, Markup } = require('telegraf')
const { GoogleGenAI } = require('@google/genai')
const http = require('http')

const bot = new Telegraf(process.env.TELEGRAM_TOKEN)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

const ADMIN_ID = 7959760533
let enabled = true
let users = new Set()
let totalRequests = 0

function adminPanel() {
  return Markup.inlineKeyboard([
    [Markup.button.callback(enabled ? '🟢 Бот ВКЛ' : '🔴 Бот ВЫКЛ', 'toggle_bot')],
    [Markup.button.callback('📊 Статистика', 'stats'), Markup.button.callback('📢 Рассылка', 'broadcast_info')],
    [Markup.button.callback('🗑️ Очистить статистику', 'clear_stats')]
  ])
}

// АДМИН ПАНЕЛЬ
bot.command('admin', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply('Нет доступа')
  ctx.reply(`👑 АДМИН ПАНЕЛЬ\n\nСтатус: ${enabled ? '✅ ВКЛ' : '❌ ВЫКЛ'}\nЮзеров: ${users.size}\nЗапросов: ${totalRequests}`, adminPanel())
})

bot.action('toggle_bot', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return
  enabled = !enabled
  await ctx.answerCbQuery(enabled ? 'Бот включен' : 'Бот выключен')
  await ctx.editMessageText(`👑 АДМИН ПАНЕЛЬ\n\nСтатус: ${enabled ? '✅ ВКЛ' : '❌ ВЫКЛ'}\nЮзеров: ${users.size}\nЗапросов: ${totalRequests}`, adminPanel())
})

bot.action('stats', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return
  await ctx.answerCbQuery()
  ctx.reply(`📊 Статистика:\n\n👥 Юзеров: ${users.size}\n📨 Запросов: ${totalRequests}\nСтатус: ${enabled ? 'ВКЛ' : 'ВЫКЛ'}`)
})

bot.action('broadcast_info', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return
  await ctx.answerCbQuery()
  ctx.reply('Чтобы сделать рассылку, напиши:\n\n/ras текст рассылки')
})

bot.action('clear_stats', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return
  users.clear()
  totalRequests = 0
  await ctx.answerCbQuery('Очищено')
  await ctx.editMessageText(`👑 АДМИН ПАНЕЛЬ\n\nСтатус: ${enabled ? '✅ ВКЛ' : '❌ ВЫКЛ'}\nЮзеров: ${users.size}\nЗапросов: ${totalRequests}`, adminPanel())
})

// Команды
bot.command('on', (ctx) => {
