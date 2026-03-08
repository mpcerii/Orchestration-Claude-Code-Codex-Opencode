import { initBot } from './bot.js';

export function startTelegramBot(token: string): void {
    const bot = initBot(token);

    // Launch the bot in polling mode
    bot.launch()
        .then(() => console.log('🤖 Telegram Bot started!'))
        .catch(err => console.error('Failed to start Telegram Bot:', err));

    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
