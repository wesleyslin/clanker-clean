import { createPublicClient, createWalletClient, http, webSocket } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { retrieveEnvVariable } from '../src/utils/index';

const HTTPS_ENDPOINT = retrieveEnvVariable('HTTPS_ENDPOINT');
const WSS_ENDPOINT = retrieveEnvVariable('WSS_ENDPOINT');

const transportRPC = http(HTTPS_ENDPOINT);
const transportWS = webSocket(WSS_ENDPOINT);

export const clientRPC = createPublicClient({
    chain: base,
    transport: transportRPC,
});

export const clientWS = createPublicClient({
    chain: base,
    transport: transportWS,
});

// Format private key to ensure it has 0x prefix
function formatPrivateKey(key: string): `0x${string}` {
    // Remove any whitespace and convert to lowercase
    key = key.trim().toLowerCase();
    
    // Remove 0x prefix if it exists
    key = key.replace('0x', '');
    
    // Remove any non-hex characters
    const hexOnly = key.replace(/[^0-9a-f]/g, '');
    
    // Ensure exactly 64 characters (32 bytes) of hex
    if (hexOnly.length !== 64) {
        throw new Error(`Invalid private key length. Expected 64 hex characters (without 0x), got ${hexOnly.length}`);
    }
    
    // Add 0x prefix back
    return `0x${hexOnly}` as `0x${string}`;
}

// Create the wallet and address outside of try-catch
const SNIPER_PK = privateKeyToAccount(formatPrivateKey(retrieveEnvVariable('PK1')));
export const SNIPER_ADDRESS = SNIPER_PK.address;
export const SNIPER_WALLET = createWalletClient({
    account: SNIPER_PK,
    chain: base,
    transport: transportRPC
});