// proxyAxios.ts
import axios from 'axios';
import https from 'https';
import dotenv from 'dotenv';
dotenv.config();

const RETRY_CONFIG = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 5000
};

// Create custom HTTPS agent that ignores certificate errors
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

// Format proxy auth properly
const proxyAuth = {
    username: 'brd-customer-hl_c1ebbeb3-zone-datacenter_proxy1',
    password: 's5nv0g1n9ag5'
};

const proxyAxios = axios.create({
    proxy: {
        host: 'brd.superproxy.io',
        port: 22225,
        auth: {
            username: proxyAuth.username,
            password: proxyAuth.password
        },
        protocol: 'https'
    },
    httpsAgent,
    timeout: 10000,
    headers: {
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive',
        'Keep-Alive': 'timeout=5, max=1000',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Referer': 'https://www.clanker.world/clanker',
        'Proxy-Authorization': `Basic ${Buffer.from(`${proxyAuth.username}:${proxyAuth.password}`).toString('base64')}`,
        'X-Requested-With': 'XMLHttpRequest'
    }
});

// Add request interceptor for debugging
proxyAxios.interceptors.request.use(request => {
    return request;
});

// Add response interceptor for debugging
proxyAxios.interceptors.response.use(
    response => response,
    async (err) => {
        console.error('Proxy Error Details:', {
            status: err.response?.status,
            statusText: err.response?.statusText,
            headers: err.response?.headers,
            data: err.response?.data
        });

        if (!err.config) {
            return Promise.reject(err);
        }

        err.config.retry = err.config.retry || 0;

        if (err.config.retry >= RETRY_CONFIG.maxRetries) {
            return Promise.reject(err);
        }

        err.config.retry += 1;

        const delayTime = Math.min(
            RETRY_CONFIG.initialDelay * Math.pow(2, err.config.retry - 1),
            RETRY_CONFIG.maxDelay
        );

        console.log(`Proxy connection failed (attempt ${err.config.retry}/${RETRY_CONFIG.maxRetries}). Retrying in ${delayTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayTime));

        return proxyAxios(err.config);
    }
);

export default proxyAxios;