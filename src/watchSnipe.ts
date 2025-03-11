import { config } from 'dotenv';
import { parseUnits } from 'viem';
import proxyAxios from '../proxy/proxyAxios';
import { buyTokensWithETH } from './buyTokens';
import { TokenResponse, TokenListing } from './types';
import { 
  clientRPC, 
  clientWS, 
  SNIPER_WALLET, 
  SNIPER_ADDRESS 
} from '../client/client1';
import { loadStoredTokens, storeTokens } from './utils/tokenStorage';
import { 
  sendTokensToTelegram, 
  initializeBot, 
  formatTokenMessage 
} from '../tele/telegramMessages';

config();

const SCAN_INTERVAL = 1000; // 1 second
const BUY_AMOUNT = "0.001"; // Amount of ETH to buy with
const ALREADY_PROCESSED = new Set<string>(); // Track processed tokens
const TELEGRAM_SENT = new Set<string>(); // Track tokens that have been sent to Telegram

// Add autobuy toggle
let AUTOBUY_ENABLED = false;

// Function to toggle autobuy
export function toggleAutobuy(enable: boolean) {
    AUTOBUY_ENABLED = false;
    console.log(`Autobuy has been ${enable ? 'enabled' : 'disabled'}`);
}

// Function to check autobuy status
export function isAutobuyEnabled(): boolean {
    return AUTOBUY_ENABLED;
}

async function fetchNewTokens(limit: number = 30): Promise<TokenListing[]> {
  try {
    const response = await proxyAxios.get<TokenResponse>(
      'https://www.clanker.world/api/tokens',
      {
        params: {
          sort: 'desc',
          page: 1,
          type: 'all',
          limit: limit
        },
        headers: {
          'accept': '*/*',
          'accept-language': 'en-US,en;q=0.9',
          'referer': 'https://www.clanker.world/clanker',
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
        }
      }
    );

    return response.data.data.slice(0, limit);
  } catch (error) {
    console.error('Error fetching tokens:', error);
    return [];
  }
}

function isNewToken(token: TokenListing): boolean {
  if (ALREADY_PROCESSED.has(token.contract_address)) {
    return false;
  }

  const tokenCreatedAt = new Date(token.created_at);
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
  
  return tokenCreatedAt > oneMinuteAgo;
}

// Simplified function - only checks if we've sent it before
function shouldSendTelegramMessage(token: TokenListing): boolean {
  return !TELEGRAM_SENT.has(token.contract_address);
}

async function checkEthBalance(): Promise<boolean> {
  try {
    const balance = await clientRPC.getBalance({ address: SNIPER_ADDRESS });
    const minBalance = parseUnits(BUY_AMOUNT, 18);
    
    if (balance < minBalance) {
      console.error(`Insufficient ETH balance. Have: ${balance}, Need: ${minBalance}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error checking ETH balance:', error);
    return false;
  }
}

async function processNewToken(token: TokenListing) {
  try {
    console.log(`
New token detected:
------------------
Name: ${token.name} (${token.symbol})
Contract: ${token.contract_address}
Pool: ${token.pool_address}
Type: ${token.type}
------------------
    `);

    // Only send if we haven't sent it before
    if (shouldSendTelegramMessage(token)) {
      await sendTokensToTelegram([token]);
      TELEGRAM_SENT.add(token.contract_address);
      console.log(`Sent Telegram notification for token: ${token.symbol}`);
    } else {
      console.log(`Skipping Telegram notification for already notified token: ${token.symbol}`);
    }

    // Add token to processed set
    ALREADY_PROCESSED.add(token.contract_address);

    // Only attempt to buy if autobuy is enabled
    if (AUTOBUY_ENABLED) {
      console.log('Autobuy is enabled, attempting to buy...');
      
      // Check ETH balance before attempting to buy
      if (!await checkEthBalance()) {
        return null;
      }

      const txHash = await buyTokensWithETH(
        {
          address: token.contract_address as `0x${string}`,
          name: token.name,
          symbol: token.symbol
        },
        BUY_AMOUNT,
        SNIPER_WALLET,
        { slippageTolerance: 10 }
      );

      console.log(`Buy transaction sent: ${txHash}`);
      
      // Wait for transaction confirmation
      const receipt = await clientRPC.waitForTransactionReceipt({ hash: txHash });
      console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
      
      return txHash;
    } else {
      console.log('Autobuy is disabled, skipping buy...');
      return null;
    }
  } catch (error) {
    console.error(`Failed to process token ${token.symbol}:`, error);
    return null;
  }
}

async function initializeWatcher(): Promise<void> {
    try {
        // Load stored tokens
        const storedTokens = await loadStoredTokens();
        const storedAddresses = new Set(storedTokens.map(t => t.contract_address));

        // Fetch recent tokens
        const recentTokens = await fetchNewTokens(30);
        
        if (recentTokens.length > 0) {
            // Find missed tokens (tokens that exist but weren't in our storage)
            const missedTokens = recentTokens.filter(token => 
                !storedAddresses.has(token.contract_address) && 
                !TELEGRAM_SENT.has(token.contract_address)
            );

            // Send notifications for missed tokens
            if (missedTokens.length > 0) {
                console.log(`Found ${missedTokens.length} missed tokens. Sending notifications...`);
                for (const token of missedTokens) {
                    await sendTokensToTelegram([token]);
                    TELEGRAM_SENT.add(token.contract_address);
                    console.log(`Sent notification for missed token: ${token.symbol}`);
                }
            }

            // Add all tokens to processed sets
            recentTokens.forEach(token => {
                ALREADY_PROCESSED.add(token.contract_address);
                TELEGRAM_SENT.add(token.contract_address);
            });

            // Store all tokens
            await storeTokens(recentTokens);
            
            console.log(`Initialization complete. Processed ${recentTokens.length} tokens, ${missedTokens.length} were missed.`);
        }
    } catch (error) {
        console.error('Error in initialization:', error);
    }
}

async function watchNewTokens() {
    console.log(`
Starting token watch:
-------------------
Wallet: ${SNIPER_ADDRESS}
Buy Amount: ${BUY_AMOUNT} ETH
Scan Interval: ${SCAN_INTERVAL}ms
Autobuy: ${AUTOBUY_ENABLED ? 'Enabled' : 'Disabled'}
-------------------
    `);

    // Initialize bot first
    console.log('Initializing Telegram bot...');
    await initializeBot();
    console.log('Telegram bot initialization complete');

    // Then initialize watcher
    await initializeWatcher();

    while (true) {
        try {
            const tokens = await fetchNewTokens();
            
            for (const token of tokens) {
                if (isNewToken(token)) {
                    await processNewToken(token);
                    const storedTokens = await loadStoredTokens();
                    await storeTokens([token, ...storedTokens]);
                }
            }

            // Clean up processed tokens and telegram notifications periodically
            if (ALREADY_PROCESSED.size > 1000) {
                ALREADY_PROCESSED.clear();
            }
            if (TELEGRAM_SENT.size > 1000) {
                TELEGRAM_SENT.clear();
            }

            await new Promise(resolve => setTimeout(resolve, SCAN_INTERVAL));
        } catch (error) {
            console.error('Error in watch loop:', error);
            await new Promise(resolve => setTimeout(resolve, SCAN_INTERVAL * 2));
        }
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  process.exit(0);
});

// Start the watch process
if (require.main === module) {
  watchNewTokens().catch(console.error);
}

