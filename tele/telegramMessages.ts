// telegramMessages.ts
import TelegramBot, { ParseMode, SendMessageOptions } from 'node-telegram-bot-api';
import { TokenListing } from '../src/types';
import { retrieveEnvVariable } from '../src/utils';
import { buyTokensWithETH } from '../src/buyTokens';
import { clientRPC, SNIPER_ADDRESS, SNIPER_WALLET } from '../client/client1';
import { parseUnits, formatUnits } from 'viem';
import { UNISWAP_V3_ROUTER, UNISWAP_V3_ABI } from '../src/constants';

const TELEGRAM_BOT_TOKEN = retrieveEnvVariable('TELEGRAM_BOT_TOKEN');
const ALLOWED_CHAT_ID = retrieveEnvVariable('ALLOWED_CHAT_IDS');

let bot: TelegramBot | null = null;
let isReconnecting = false;

export function formatTokenMessage(token: TokenListing): string {
    return `━━━━━━━━━━━━━━━━━━━━━━━
*${escapeMarkdown(token.name)}* #${escapeMarkdown(token.symbol)}
\`${token.contract_address}\`

🌐 Pool Address:
\`${token.pool_address}\`

📊 Token Info:
  - Type: ${token.type}
  - Chart: [View on Basescan](https://basescan.org/token/${token.contract_address})
━━━━━━━━━━━━━━━━━━━━━━━`;
}

export function createTxHashLink(txHash: string): string {
    return `[${txHash}](https://basescan.org/tx/${txHash})`;
}

export async function initializeBot() {
    if (bot) return bot;
    
    try {
        bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
        
        bot.on('polling_error', (error) => {
            console.error('Polling error:', error);
            reconnectBot();
        });

        bot.on('error', (error) => {
            console.error('Bot error:', error);
            reconnectBot();
        });

        // Add callback query handler for buttons
        bot.on('callback_query', async (query) => {
            if (!query.data) return;

            try {
                const [action, amount, address] = query.data.split('_');
                const chatId = query.message?.chat.id;
                const username = query.from.username || query.from.id;

                if (!chatId || !bot) return;

                await bot.answerCallbackQuery(query.id);

                if (action === 'buy') {
                    await handleBuyAction(chatId, username, amount, address);
                } else if (action === 'sell') {
                    await handleSellAction(chatId, username, amount, address);
                } else if (action === 'balance') {
                    await handleBalanceAction(chatId, username, address);
                }
            } catch (error) {
                console.error('Error processing callback:', error);
                if (query.message?.chat.id && bot) {
                    await bot.sendMessage(
                        query.message.chat.id,
                        'Error processing your request. Please try again.'
                    );
                }
            }
        });

        return bot;
    } catch (error) {
        console.error('Error initializing bot:', error);
        throw error;
    }
}

async function reconnectBot() {
    if (isReconnecting) return;
    isReconnecting = true;

    try {
        if (bot) {
            await bot.stopPolling();
            bot = null;
        }
        await initializeBot();
    } catch (error) {
        console.log('Error during reconnection:', error);
    } finally {
        isReconnecting = false;
    }
}

export async function sendTokensToTelegram(tokens: TokenListing[]): Promise<void> {
    if (!bot) {
        bot = await initializeBot();
    }

    for (const token of tokens) {
        try {
            const messageOpts: SendMessageOptions = {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "💵 Buy 0.001 ETH",
                                callback_data: `buy_0.001_${token.contract_address}`,
                            },
                            {
                                text: "💵 Buy 0.1 ETH",
                                callback_data: `buy_0.1_${token.contract_address}`,
                            },
                        ],
                        [
                            {
                                text: "💵 Buy .3 ETH",
                                callback_data: `buy_0.3_${token.contract_address}`,
                            },
                            {
                                text: "💵 Buy .5 ETH",
                                callback_data: `buy_0.5_${token.contract_address}`,
                            },
                        ],
                        [
                            {
                                text: "🛑 Sell 25%",
                                callback_data: `sell_25_${token.contract_address}`,
                            },
                            {
                                text: "🛑 Sell 50%",
                                callback_data: `sell_50_${token.contract_address}`,
                            },
                        ],
                        [
                            {
                                text: "🛑 Sell All",
                                callback_data: `sell_100_${token.contract_address}`,
                            },
                        ],
                        [
                            {
                                text: "🏦 Get Balance",
                                callback_data: `balance_0_${token.contract_address}`,
                            },
                        ],
                    ],
                },
                parse_mode: 'Markdown' as ParseMode,
                disable_web_page_preview: true,
            };

            if (!bot) continue;

            const sentMessage = await bot.sendMessage(
                ALLOWED_CHAT_ID,
                formatTokenMessage(token),
                messageOpts
            );

            // Send image if available
            if (token.img_url && token.img_url !== "no image" && bot) {
                try {
                    await bot.sendPhoto(ALLOWED_CHAT_ID, token.img_url).catch(async () => {
                        if (bot) {
                            await bot.sendMessage(ALLOWED_CHAT_ID, `Logo: ${token.img_url}`);
                        }
                    });
                } catch (error) {
                    console.error('Error handling image:', error);
                }
            }

            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.error('Error sending telegram message:', error);
        }
    }
}

export async function sendTransactionMessage(chatId: number, username: string | number, message: string): Promise<void> {
    if (!bot) {
        bot = await initializeBot();
    }

    try {
        await bot.sendMessage(
            chatId,
            `@${username}, ${message}`,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        console.error('Error sending transaction message:', error);
    }
}

export async function askForTokenAddress(chatId: number, userId: number, username: string | undefined, signal: AbortSignal): Promise<`0x${string}`> {
    if (!bot) {
        bot = await initializeBot();
    }

    return new Promise((resolve, reject) => {
        let promptMessage: TelegramBot.Message | undefined;
        bot?.sendMessage(chatId, 'Please provide the token address:').then(sent => promptMessage = sent);

        const messageHandler = (msg: TelegramBot.Message) => {
            if (signal.aborted) {
                cleanup();
                reject(new Error("Operation cancelled"));
                return;
            }

            const tokenAddress = msg.text?.toLowerCase() as `0x${string}`;
            if (tokenAddress?.match(/^0x[a-f0-9]{40}$/i)) {
                cleanup();
                resolve(tokenAddress);
            } else {
                bot?.sendMessage(chatId, "Invalid Ethereum address format. Please try again with a valid address (0x followed by 40 hexadecimal characters).");
            }
        };

        const cleanup = () => {
            bot?.removeListener('message', messageHandler);
            if (promptMessage) bot?.deleteMessage(chatId, promptMessage.message_id).catch(() => {});
        };

        bot?.on('message', messageHandler);
        signal.addEventListener('abort', () => {
            cleanup();
            reject(new Error("Operation cancelled"));
        });
    });
}

export async function askForConfirmation(chatId: number, userId: number, username: string | undefined, signal: AbortSignal): Promise<boolean> {
    if (!bot) {
        bot = await initializeBot();
    }

    return new Promise((resolve, reject) => {
        let promptMessage: TelegramBot.Message | undefined;
        bot?.sendMessage(chatId, 'Are you sure you want to sell all tokens? Reply with "yes" or "no":', {
            reply_markup: {
                keyboard: [[{ text: 'yes' }], [{ text: 'no' }]],
                one_time_keyboard: true,
                resize_keyboard: true
            }
        }).then(sent => promptMessage = sent);

        const messageHandler = (msg: TelegramBot.Message) => {
            if (msg.text?.toLowerCase() === 'yes') {
                cleanup();
                resolve(true);
            } else if (msg.text?.toLowerCase() === 'no') {
                cleanup();
                resolve(false);
            } else {
                bot?.sendMessage(chatId, "Please reply with 'yes' or 'no'.");
            }
        };

        const cleanup = () => {
            bot?.removeListener('message', messageHandler);
            if (promptMessage) bot?.deleteMessage(chatId, promptMessage.message_id).catch(() => {});
            bot?.sendMessage(chatId, 'Confirmation received', {
                reply_markup: { remove_keyboard: true }
            });
        };

        bot?.on('message', messageHandler);
        signal.addEventListener('abort', () => {
            cleanup();
            reject(new Error("Operation cancelled"));
        });
    });
}

export function getBot(): TelegramBot | null {
    return bot;
}

// Helper function to escape special characters in markdown
function escapeMarkdown(text: string): string {
    if (typeof text !== "string") {
        return "";
    }
    return text.replace(/([_*[\]()~`>#+=|{}.!-])/g, '\\$1');
}

async function handleBuyAction(chatId: number, username: string | number, amount: string, address: string) {
    const processingMsg = await bot?.sendMessage(chatId, 
        `🔄 @${username} is attempting to buy ${amount} ETH worth of tokens...`
    );
    
    try {
        console.log('Buy params:', { address, amount });
        
        const txHash = await buyTokensWithETH(
            {
                address: address as `0x${string}`,
                name: 'Unknown',
                symbol: 'Unknown'
            },
            amount,
            SNIPER_WALLET,
            { slippageTolerance: 10 }
        );

        console.log('Buy transaction successful:', txHash);

        if (processingMsg && bot) {
            await bot.deleteMessage(chatId, processingMsg.message_id);
        }
        
        await bot?.sendMessage(chatId, 
            `✅ @${username} successfully bought ${amount} ETH worth of tokens\nTransaction: ${createTxHashLink(txHash)}`,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        console.error('Buy error:', error);
        
        if (processingMsg && bot) {
            await bot.deleteMessage(chatId, processingMsg.message_id);
        }
        
        await bot?.sendMessage(chatId, 
            `❌ @${username}'s buy transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}

async function handleSellAction(chatId: number, username: string | number, amount: string, address: string) {
    const processingMsg = await bot?.sendMessage(chatId, 
        `🔄 @${username} is attempting to sell ${amount}% of tokens...`
    );
    
    try {
        const txHash = await sellTokens(address, parseInt(amount));
        
        await bot?.deleteMessage(chatId, processingMsg!.message_id);
        await bot?.sendMessage(chatId, 
            `✅ @${username} successfully sold ${amount}% of tokens\nTransaction: ${createTxHashLink(txHash)}`,
            { parse_mode: 'Markdown' }
        );

        // Get updated balance after sell
        const newBalance = await clientRPC.readContract({
            address: address as `0x${string}`,
            abi: [{
                name: 'balanceOf',
                type: 'function',
                inputs: [{ name: 'account', type: 'address' }],
                outputs: [{ name: 'balance', type: 'uint256' }],
                stateMutability: 'view'
            }],
            functionName: 'balanceOf',
            args: [SNIPER_ADDRESS]
        });

        // Send updated balance
        await bot?.sendMessage(chatId, 
            `🏦 New balance: ${formatUnits(newBalance, 18)} tokens`,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        console.error('Sell error:', error);
        await bot?.deleteMessage(chatId, processingMsg!.message_id);
        await bot?.sendMessage(chatId, 
            `❌ @${username}'s sell transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}

async function handleBalanceAction(chatId: number, username: string | number, address: string) {
    try {
        const TOTAL_SUPPLY = BigInt("1000000000000000000000000000"); // 1 billion with 18 decimals
        
        const balance = await clientRPC.readContract({
            address: address as `0x${string}`,
            abi: [{
                name: 'balanceOf',
                type: 'function',
                inputs: [{ name: 'account', type: 'address' }],
                outputs: [{ name: 'balance', type: 'uint256' }],
                stateMutability: 'view'
            }],
            functionName: 'balanceOf',
            args: [SNIPER_ADDRESS]
        });

        // Calculate percentage
        const percentage = Number((balance * BigInt(10000) / TOTAL_SUPPLY)) / 100;

        await bot?.sendMessage(chatId, 
            `🏦 @${username}'s balance: ${percentage.toFixed(2)}% of total supply`,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        console.error('Balance check error:', error);
        await bot?.sendMessage(chatId, 
            `❌ Error retrieving balance: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}

async function sellTokens(
    tokenAddress: string,
    percentageToSell: number
): Promise<`0x${string}`> {
    try {
        // Get token balance
        const balance = await clientRPC.readContract({
            address: tokenAddress as `0x${string}`,
            abi: [{
                name: 'balanceOf',
                type: 'function',
                inputs: [{ name: 'account', type: 'address' }],
                outputs: [{ name: 'balance', type: 'uint256' }],
                stateMutability: 'view'
            }],
            functionName: 'balanceOf',
            args: [SNIPER_ADDRESS]
        });

        // Calculate amount to sell
        const amountToSell = (balance * BigInt(percentageToSell)) / BigInt(100);

        // Check allowance
        const allowance = await clientRPC.readContract({
            address: tokenAddress as `0x${string}`,
            abi: [{
                name: 'allowance',
                type: 'function',
                inputs: [
                    { name: 'owner', type: 'address' },
                    { name: 'spender', type: 'address' }
                ],
                outputs: [{ name: 'remaining', type: 'uint256' }],
                stateMutability: 'view'
            }],
            functionName: 'allowance',
            args: [SNIPER_ADDRESS, UNISWAP_V3_ROUTER]
        });

        // Approve if needed
        if (allowance < amountToSell) {
            const approveTx = await SNIPER_WALLET.writeContract({
                address: tokenAddress as `0x${string}`,
                abi: [{
                    name: 'approve',
                    type: 'function',
                    inputs: [
                        { name: 'spender', type: 'address' },
                        { name: 'amount', type: 'uint256' }
                    ],
                    outputs: [{ name: 'success', type: 'bool' }],
                    stateMutability: 'nonpayable'
                }],
                functionName: 'approve',
                args: [UNISWAP_V3_ROUTER, amountToSell]
            });

            // Wait for approval
            await clientRPC.waitForTransactionReceipt({ hash: approveTx });
        }

        // Execute sell
        const sellTx = await SNIPER_WALLET.writeContract({
            address: UNISWAP_V3_ROUTER,
            abi: UNISWAP_V3_ABI,
            functionName: 'exactInputSingle',
            args: [{
                tokenIn: tokenAddress as `0x${string}`,
                tokenOut: '0x4200000000000000000000000000000000000006', // WETH
                fee: 10000, // 1%
                recipient: SNIPER_ADDRESS,
                amountIn: amountToSell,
                amountOutMinimum: 0n, // Be careful with this in production!
                sqrtPriceLimitX96: 0n
            }]
        });

        return sellTx;
    } catch (error) {
        console.error('Sell error:', error);
        throw error;
    }
}

// Example of how to handle bot operations safely:
async function safeSendMessage(chatId: number, message: string, options?: any) {
    if (!bot) {
        bot = await initializeBot();
    }
    
    if (bot) {
        return await bot.sendMessage(chatId, message, options);
    }
    
    throw new Error('Failed to initialize bot');
}
