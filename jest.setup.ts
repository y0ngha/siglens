/**
 * Jest 실행 시 환경변수를 주입한다.
 */

process.env.ALPACA_API_KEY = 'test-alpaca-key';
process.env.ALPACA_API_SECRET = 'test-alpaca-secret';
process.env.AI_PROVIDER = 'claude';
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
process.env.GEMINI_API_KEY = 'test-gemini-key';

// next/cache의 런타임 API('use cache' 지시자, cacheLife, cacheTag)는
// Next.js 빌드 컨텍스트에서만 동작한다. jest 환경에서는 noop으로 대체한다.
jest.mock('next/cache', () => ({
    cacheLife: () => {},
    cacheTag: () => {},
    revalidatePath: () => {},
    revalidateTag: () => {},
    unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
}));
