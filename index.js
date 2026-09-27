const { Telegraf } = require('telegraf')
// Исправленный импорт официального SDK Google Gen AI
const { GoogleGenAI } = require('@google/genai')
const http = require('http')
const sqlite3 = require('sqlite3') // Добавлен модуль базы данных

const bot = new Telegraf(process.env.TELEGRAM_TOKEN || process.env.BOT_TOKEN || process.env.TELEGRAM_TOKEN)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

// --- НАСТРОЙКИ ---
const ADMIN_ID = 7959760533; // Ваш Telegram ID
const SECRET_CODES = [
  'GEMINI-X99_🔥_d7b8a2c4e1', 
  'AI-STUDENT_⚡_z5x9y2w1q8', 
  'VIP-PREMIUM_💎_a4b3c2d1e0'
]; // Список ваших замудренных промокодов
const MAX_FREE_ATTEMPTS = 10;  // Лимит бесплатных запросов в день

const isAdmin = (ctx) => ctx.from?.id === ADMIN_ID
let botEnabled = true

// --- ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ ---
const db = new sqlite3.Database('bot_users.db')

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY,
            searches_left INTEGER DEFAULT 10,
            is_premium INTEGER DEFAULT 0,
            last_search_date TEXT
        )
    `)
if (!row) {
    // Если пользователя нет в базе, создаем его с 10 попытками и текущей датой
    db.run('INSERT INTO users (user_id, searches_left, last_search_date) VALUES (?, ?, ?)', [userId, MAX_FREE_ATTEMPTS, today]);
    
    // НАЧАЛО НОВОГО КОДА: Уведомление админа
    const userName = ctx.from?.first_name || 'Инкогнито';
    const userTag = ctx.from?.username ? `@${ctx.from.username}` : 'нет юзернейма';
    bot.telegram.sendMessage(ADMIN_ID, `🆕 <b>Новый пользователь в боте!</b>\nИмя: ${userName}\nЮзернейм: ${userTag}\nID: <code>${userId}</code>`, { parse_mode: 'HTML' }).catch(() => {});
    // КОНЕЦ НОВОГО КОДА

    resolve({ searches_left: MAX_FREE_ATTEMPTS, is_premium: 0 });
}


// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ЕЖЕДНЕВНЫХ ЛИМИТОВ ---
const getUser = (userId) => {
    return new Promise((resolve) => {
        const today = new Date().toISOString().split('T')[0]; // Получаем текущую дату (ГГГГ-ММ-ДД)

        db.get('SELECT searches_left, is_premium, last_search_date FROM users WHERE user_id = ?', [userId], (err, row) => {
            if (!row) {
                // Если пользователя нет в базе, создаем его с 10 попытками и текущей датой
                db.run('INSERT INTO users (user_id, searches_left, last_search_date) VALUES (?, ?, ?)', [userId, MAX_FREE_ATTEMPTS, today]);
                resolve({ searches_left: MAX_FREE_ATTEMPTS, is_premium: 0 });
            } else {
                // Если наступил новый день и у пользователя нет премиума — сбрасываем счетчик обратно на 10
                if (row.last_search_date !== today && !row.is_premium) {
                    db.run('UPDATE users SET searches_left = ?, last_search_date = ? WHERE user_id = ?', [MAX_FREE_ATTEMPTS, today, userId]);
                    resolve({ searches_left: MAX_FREE_ATTEMPTS, is_premium: row.is_premium });
                } else {
                    resolve(row);
                }
            }
        });
    });
};

const givePremium = (userId) => {
    return new Promise((resolve) => {
        db.run('UPDATE users SET is_premium = 1 WHERE user_id = ?', [userId], () => resolve())
    })
})

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

// --- АДМИН-КОМАНДЫ УПРАВЛЕНИЯ БОТОМ ---
bot.command('admin', (ctx) => {
  if (!isAdmin(ctx)) return
  ctx.reply(`🔧 Панель управления Разработчика:\n` +
            `/on - включить бота\n` +
            `/off - выключить бота\n` +
            `/stats - проверить статус работы\n` +
            `/grant [ID] - выдать безлимитный Premium\n` +
            `/user [ID] - узнать, сколько попыток осталось у юзера`);
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

// Новая админ-команда проверки остатка попыток конкретного пользователя
bot.command('user', async (ctx) => {
    if (!isAdmin(ctx)) return;

    // Извлекаем ID из текста команды (например, /user 123456789)
    const targetId = parseInt(ctx.message.text.replace('/user', '').trim());
    if (isNaN(targetId)) {
        return ctx.reply('❌ Укажите ID пользователя. Пример: /user 123456789');
    }

    db.get('SELECT searches_left, is_premium, last_search_date FROM users WHERE user_id = ?', [targetId], (err, row) => {
        if (err || !row) {
            return ctx.reply('❌ Этот пользователь еще ни разу не запускал бота и отсутствует в базе данных.');
        }
        
        ctx.replyWithHTML(`👤 <b>Информация о пользователе <code>${targetId}</code>:</b>\n\n` +
                  `💎 <b>Premium-статус:</b> ${row.is_premium ? 'Активирован ✅ (Безлимит)' : 'Отсутствует ❌'}\n` +
                  `📉 <b>Осталось попыток на сегодня:</b> <code>${row.searches_left}</code> из 10\n` +
                  `📅 <b>Дата последней активности:</b> <code>${row.last_search_date || 'нет запросов'}</code>`);
    });
});

// Ручная выдача премиума администратором (/grant ID)
bot.command('grant', async (ctx) => {
    if (!isAdmin(ctx)) return
    const targetId = parseInt(ctx.message.text.replace('/grant', '').trim())
    if (isNaN(targetId)) {
        return ctx.reply('❌ Укажите ID. Формат: /grant 123456789')
    }
    await givePremium(targetId)
    ctx.reply(`✨ Пользователю ${targetId} успешно выдан Premium!`)
    try {
        await bot.telegram.sendMessage(targetId, '🎉 Администратор активировал вам Premium-режим!');
    } catch (e) {
        // Игнорируем, если пользователь не активировал бота ранее
    }
})

// --- ПОЛЬЗОВАТЕЛЬСКИЕ КОМАНДЫ ---

// Активация премиума по промокоду (/activate КОД)
bot.command('activate', async (ctx) => {
    const code = ctx.message.text.replace('/activate', '').trim()
    
    // Проверяем, есть ли введенный код в нашем списке SECRET_CODES
    if (SECRET_CODES.includes(code)) {
        await givePremium(ctx.from.id)
        ctx.reply('🎉 Промокод активирован! Вам открыт безлимитный Premium-доступ к нейросети.');
    } else {
        ctx.reply('❌ Неверный промокод. Формат: /activate КОД');
    }
})

bot.use((ctx, next) => {
  if (!botEnabled && !isAdmin(ctx)) return ctx.reply('🔧 Тех. работы')
  return next()
})

bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const user = await getUser(userId);
    
    let welcomeText = "";
    
    if (userId === ADMIN_ID) {
        welcomeText = `👋 Приветствую, **Разработчик**! Вы вошли с правами создателя бота. Настройки управления доступны по команде /admin.`;
    } else {
        let status = user.is_premium ? "✨ У вас безлимитный Premium-поиск!" : `Вам доступно ${user.searches_left} бесплатных запросов на сегодня.`;
        welcomeText = `👋 Привет! Скинь домашку фото или текстом\n\n${status}`;
    }
    
    ctx.replyWithMarkdown(welcomeText);
})

// --- ОСНОВНАЯ ЛОГИКА ОБРАБОТКИ ЗАПРОСОВ ---
bot.on(['text', 'photo', 'document'], async (ctx) => {
  if (ctx.message.text?.startsWith('/')) return
  
  const userId = ctx.from.id
  const user = await getUser(userId)

  // Проверка лимитов для не-премиум пользователей
  if (!user.is_premium && user.searches_left <= 0) {
      return ctx.reply('❌ Лимит бесплатных попыток на сегодня исчерпан!\nПопытки обновятся завтра. Чтобы решать без ограничений, активируйте Premium.');
  }

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
      let answer = res.text.replace(/\$/g, '')
      
      // Списание попытки для обычных пользователей
      if (!user.is_premium) {
          const newLimit = user.searches_left - 1
          const today = new Date().toISOString().split('T')[0]
          db.run('UPDATE users SET searches_left = ?, last_search_date = ? WHERE user_id = ?', [newLimit, today, userId])
          answer += `\n\n📉 Осталось бесплатных попыток на сегодня: ${newLimit}`
      } else {
          answer += `\n\n✨ Безлимитный Premium-режим`
      }

      await ctx.reply(answer)
    } else {
      await ctx.reply('⚠️ Нейросеть вернула пустой ответ. Попробуйте отправить другое фото.')
    }

  } catch (e) { 

