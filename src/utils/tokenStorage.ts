import fs from 'fs/promises';
import path from 'path';
import { TokenListing } from '../types';

const STORAGE_FILE = path.join(__dirname, '../../data/tokens.json');

export async function ensureStorageDirectory(): Promise<void> {
    const dir = path.dirname(STORAGE_FILE);
    try {
        await fs.access(dir);
    } catch {
        await fs.mkdir(dir, { recursive: true });
    }
}

export async function loadStoredTokens(): Promise<TokenListing[]> {
    try {
        await ensureStorageDirectory();
        const data = await fs.readFile(STORAGE_FILE, 'utf-8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

export async function storeTokens(tokens: TokenListing[]): Promise<void> {
    try {
        await ensureStorageDirectory();
        await fs.writeFile(STORAGE_FILE, JSON.stringify(tokens, null, 2));
    } catch (error) {
        console.error('Error storing tokens:', error);
    }
} 