const { Telegraf } = require('telegraf');
const { GoogleGenAI } = require('@google/genai'); 
const http = require('http');
const sqlite3 = require('sqlite3'); 

// 1. Запуск обязательного веб-сервера для Render
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running\n');
}).listen(process.env.PORT || 3000);

// 2. Безопасное чтение токена
// Если у вас в коде токен был вставлен строкой, замените process.env.TELEGRAM_TOKEN на 'ВАШ_ТОКЕН'
const botToken = process.env.TELEGRAM_TOKEN || process.env.BOT_TOKEN;

if (!botToken) {
    console.error("❌ ОШИБКА: Токен Telegram бота не найден в переменных окружения!");
    process.exit(1);
}

const bot = new Telegraf(botToken);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "DUMMY_KEY" });

const ADMIN_ID = 7959760533;
const SECRET_CODE = 'GEMINI-X99_🔸_d7b8a2';
const MAX_FREE_ATTEMPTS = 10;
const isAdmin = (ctx) => ctx.from?.id === ADMIN_ID;
let botEnabled = true;

// --- ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ ---
const db = new sqlite3.Database('bot_users.db');

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY,
            searches_left INTEGER DEFAULT 10,
            is_premium INTEGER DEFAULT 0,
            last_search_date TEXT
        )
    `);
});

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
const getUser = (userId) => {
    return new Promise((resolve) => {
        const today = new Date().toISOString().split('T')[0];
        db.get('SELECT searches_left, is_premium, last_search_date FROM users WHERE user_id = ?', [userId], (err, row) => {
            if (!row) {
                db.run('INSERT INTO users (user_id, searches_left, last_search_date) VALUES (?, ?, ?)', [userId, MAX_FREE_ATTEMPTS, today]);
                resolve({ searches_left: MAX_FREE_ATTEMPTS, is_premium: 0, last_search_date: today });
            } else {
                resolve(row);
            }
        });
    });
};

// Простейшая команда для теста запуска
bot.start((ctx) => ctx.reply('Привет! Бот успешно запущен на Render.'));

// Хэндлер ошибок, чтобы бот не падал при неверных запросах к ИИ
bot.catch((err, ctx) => {
    console.error(`Ошибка в обработчике Telegraf для ${ctx.updateType}:`, err);
});

// Запуск бота
bot.launch()
    .then(() => console.log('✅ Бот успешно подключился к серверам Telegram!'))
    .catch((err) => {
        console.error('❌ Критическая ошибка старта бота:', err);
        process.exit(1);
    });

// Корректная остановка
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

