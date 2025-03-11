export type EthereumAddress = `0x${string}`;

export interface SwapConfig {
  slippageTolerance: number; // in percentage (e.g., 5 for 5%)
  deadlineMinutes: number;
  gasLimit: number;
}

export interface TokenInfo {
  address: EthereumAddress;
  name?: string;
  symbol?: string;
  decimals?: number;
}

export interface TokenListing {
  id: number;
  created_at: string;
  tx_hash: string;
  contract_address: string;
  requestor_fid: number;
  name: string;
  symbol: string;
  img_url: string;
  pool_address: string;
  cast_hash: string;
  type: string;
}

export interface TokenResponse {
  data: TokenListing[];
} 