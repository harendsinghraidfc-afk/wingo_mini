const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const bodyParser = require('body-parser');
const cors = require('cors');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');

// --- Database Setup ---
const adapter = new FileSync('db.json');
const db = low(adapter);

// Initial database structure
db.defaults({ 
    users: {}, 
    global_history: { 60: [], 120: [] },
    admin_stats: { total_members: 0, pending_deposits: 0, pending_withdraws: 0 }
}).write();

// --- Bot Setup ---
const token = 'YOUR_BOT_TOKEN_HERE'; // User will replace this
const bot = new TelegramBot(token, { polling: true });
const WEBAPP_URL = 'YOUR_DEPLOYED_URL_HERE'; // User will replace this or use localtunnel/ngrok

// --- Express Server ---
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname)); // Serve HTML/CSS/JS files

// --- API Endpoints for Frontend ---

// Get User Data
app.get('/api/user/:id', (req, res) => {
    const userId = req.params.id;
    let user = db.get('users').get(userId).value();
    
    if (!user) {
        user = {
            id: userId,
            balance: 0,
            totalDeposited: 0,
            currentTurnover: 0,
            turnoverTarget: 0,
            isBlocked: false,
            requests: []
        };
        db.get('users').set(userId, user).write();
    }
    res.json(user);
});

// Place Bet
app.post('/api/bet', (req, res) => {
    const { userId, amount, selection, type, period, mode } = req.body;
    let user = db.get('users').get(userId).value();
    
    if (user && user.balance >= amount && !user.isBlocked) {
        user.balance -= amount;
        user.currentTurnover += amount;
        
        // In a real app, you'd store the bet in a 'bets' collection
        db.get('users').get(userId).set('balance', user.balance).write();
        db.get('users').get(userId).set('currentTurnover', user.currentTurnover).write();
        
        res.json({ success: true, balance: user.balance });
    } else {
        res.status(400).json({ success: false, message: 'Invalid bet' });
    }
});

// Admin Update Request
app.post('/api/admin/request', (req, res) => {
    const { userId, requestId, status } = req.body;
    // Admin logic to update status and balance
    res.json({ success: true });
});

// --- Telegram Bot Commands ---

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Welcome to WinGo! 🚀\nPlay and win real rewards.", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "🚀 Open WinGo Game", web_app: { url: WEBAPP_URL } }]
            ]
        }
    });
});

// --- Server Start ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Telegram WebApp URL should be set to your public URL`);
});
