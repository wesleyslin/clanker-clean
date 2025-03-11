import { config } from 'dotenv';
import { parseUnits, type Hash } from 'viem';
import { EthereumAddress, SwapConfig, TokenInfo } from './types';
import { 
  UNISWAP_V3_ROUTER, 
  WETH_ADDRESS, 
  DEFAULT_SWAP_CONFIG,
  POOL_FEES,
  UNISWAP_V3_ABI
} from './constants';
import { clientRPC, SNIPER_ADDRESS } from '../client/client1';

config();

const FEE_TIERS = [100, 500, 3000, 10000] as const; // 0.01%, 0.05%, 0.3%, 1%

export async function buyTokensWithETH(
  tokenInfo: TokenInfo,
  ethAmount: string,
  walletClient: any,
  config: Partial<SwapConfig> = {}
): Promise<Hash> {
  const swapConfig = { ...DEFAULT_SWAP_CONFIG, ...config };
  const account = walletClient.account;
  
  try {
    const amountIn = parseUnits(ethAmount, 18);
    
    console.log('Executing buy with params:', {
      tokenIn: WETH_ADDRESS,
      tokenOut: tokenInfo.address,
      amount: ethAmount,
      fee: 10000 // Fixed 1% fee tier
    });

    const params = {
      tokenIn: WETH_ADDRESS,
      tokenOut: tokenInfo.address,
      fee: 10000, // Fixed 1% fee tier
      recipient: account.address,
      amountIn,
      amountOutMinimum: 0n,
      sqrtPriceLimitX96: 0n
    };

    const buyTx = await walletClient.writeContract({
      address: UNISWAP_V3_ROUTER,
      abi: UNISWAP_V3_ABI,
      functionName: 'exactInputSingle',
      args: [params],
      value: amountIn,
      gas: BigInt(swapConfig.gasLimit)
    });

    console.log('Buy transaction sent:', buyTx);
    return buyTx;
  } catch (error: any) {
    console.error('Buy error details:', {
      token: tokenInfo.address,
      amount: ethAmount,
      error: error.message,
      cause: error.cause
    });
    throw error;
  }
}
