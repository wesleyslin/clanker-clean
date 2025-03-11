const ALLOWED_CHAT_IDS = process.env.ALLOWED_CHAT_IDS?.split(',').map(id => Number(id)) || [];

export function isChatAllowed(chatId: number): boolean {
  return ALLOWED_CHAT_IDS.includes(chatId);
} 