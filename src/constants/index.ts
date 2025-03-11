import { EthereumAddress } from '../types';

export const UNISWAP_V3_ROUTER = '0x2626664c2603336E57B271c5C0b26F421741e481' as const;
export const WETH_ADDRESS = '0x4200000000000000000000000000000000000006' as const;

export const DEFAULT_SWAP_CONFIG = {
  slippageTolerance: 5, // 5%
  deadlineMinutes: 20,
  gasLimit: 500000
};

export const POOL_FEES = {
  LOWEST: 100,   // 0.01%
  LOW: 500,      // 0.05%
  MEDIUM: 3000,  // 0.3%
  HIGH: 10000    // 1%
} as const;

export const UNISWAP_V3_ABI = [
  {
    "inputs": [{
      "components": [
        { "name": "tokenIn", "type": "address" },
        { "name": "tokenOut", "type": "address" },
        { "name": "fee", "type": "uint24" },
        { "name": "recipient", "type": "address" },
        { "name": "amountIn", "type": "uint256" },
        { "name": "amountOutMinimum", "type": "uint256" },
        { "name": "sqrtPriceLimitX96", "type": "uint160" }
      ],
      "name": "params",
      "type": "tuple"
    }],
    "name": "exactInputSingle",
    "outputs": [{ "name": "amountOut", "type": "uint256" }],
    "stateMutability": "payable",
    "type": "function"
  }
] as const; 