import { config } from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';

config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;

if (!TELEGRAM_BOT_TOKEN) {
  console.error('Please set TELEGRAM_BOT_TOKEN in your .env file');
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

console.log('Bot started. Send any message to get your chat ID...');

bot.on('message', (msg) => {
  console.log(`
Chat Information:
----------------
Chat ID: ${msg.chat.id}
From: ${msg.from?.username || 'Unknown'}
Type: ${msg.chat.type}
----------------
`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  bot.stopPolling();
  process.exit(0);
}); 