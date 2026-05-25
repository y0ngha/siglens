import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import { TextDecoder, TextEncoder } from 'util';

if (typeof globalThis.TextDecoder === 'undefined') {
    (globalThis as unknown as { TextDecoder: typeof TextDecoder }).TextDecoder = TextDecoder;
}
if (typeof globalThis.TextEncoder === 'undefined') {
    (globalThis as unknown as { TextEncoder: typeof TextEncoder }).TextEncoder = TextEncoder;
}

process.env.ALPACA_API_KEY = 'test-alpaca-key';
process.env.ALPACA_API_SECRET = 'test-alpaca-secret';
process.env.AI_PROVIDER = 'claude';
process.env.GEMINI_CHAT_FREE_API_KEY = 'test-gemini-user-api-key';
process.env.GEMINI_CHAT_API_KEY = 'test-gemini-key';
process.env.ANTHROPIC_CHAT_API_KEY = 'test-anthropic-key';
process.env.OPENAI_CHAT_API_KEY = 'test-openai-key';
process.env.DATABASE_URL = 'test-database-url';

vi.mock('next/cache', () => ({
    cacheLife: () => {},
    cacheTag: () => {},
    revalidatePath: () => {},
    revalidateTag: () => {},
    unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
}));
