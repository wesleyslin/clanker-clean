declare global {
  namespace NodeJS {
    interface ProcessEnv {
      HTTPS_ENDPOINT: string;
      WSS_ENDPOINT: string;
      TELEGRAM_BOT_TOKEN: string;
      ALLOWED_CHAT_IDS: string;
      PRIVATE_KEYS: string;
    }
  }
}

export {}; 