export function retrieveEnvVariable(name: string): string {
    const value = process.env[name];
    if (!value) {
        console.error(`Missing environment variable: ${name}`);
        throw new Error(`Missing environment variable: ${name}`);
    }
    return value;
} 