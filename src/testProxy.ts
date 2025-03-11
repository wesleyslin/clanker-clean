import proxyAxios from '../proxy/proxyAxios';

async function testProxy() {
    try {
        console.log('Testing proxy connection...');
        const response = await proxyAxios.get('https://www.clanker.world/api/tokens', {
            params: {
                sort: 'desc',
                page: 1,
                type: 'all'
            }
        });
        console.log('Proxy test successful!');
        console.log('Response status:', response.status);
        console.log('First token:', response.data.data[0]);
    } catch (error: any) {
        console.error('Proxy test failed:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });
    }
}

testProxy(); 