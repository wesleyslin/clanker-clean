import TelegramBot from 'node-telegram-bot-api';
import { TokenListing } from '../types';
import { retrieveEnvVariable } from './index';

const TELEGRAM_BOT_TOKEN = retrieveEnvVariable('TELEGRAM_BOT_TOKEN');
const ALLOWED_CHAT_ID = retrieveEnvVariable('ALLOWED_CHAT_IDS');

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });

export function formatTokenMessage(token: TokenListing): string {
    return `
🆕 New Token Listed:
-------------------
Name: ${token.name} (${token.symbol})
Contract: \`${token.contract_address}\`
Type: ${token.type}
-------------------`;
}

export async function sendTokensToTelegram(tokens: TokenListing[]): Promise<void> {
    for (const token of tokens) {
        try {
            await bot.sendMessage(
                ALLOWED_CHAT_ID,
                formatTokenMessage(token),
                { parse_mode: 'Markdown' }
            );
            // Add small delay between messages
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.error('Error sending telegram message:', error);
        }
    }
} 