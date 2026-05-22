/**
 * Jest 실행 시 환경변수를 주입한다.
 */

// jsdom 환경에는 TextDecoder/TextEncoder가 전역에 노출되어 있지 않다.
// `@neondatabase/serverless`(드라이즐을 통해 모든 *Repository → isNeonTransientError
// 경로에서 transitively import됨)가 모듈 로드 시점에 TextDecoder를 참조하므로,
// jsdom env로 마킹된 컴포넌트 테스트가 ContactForm 같은 user-action 체인을
// 거치는 순간 `ReferenceError: TextDecoder is not defined`로 죽는다.
// Node가 노출하는 native 구현을 그대로 전역에 폴리필해 두면 두 환경 모두 안전.
import { TextDecoder, TextEncoder } from 'util';

if (typeof globalThis.TextDecoder === 'undefined') {
    // jsdom env에 한해 채워 넣는다 — node env에서는 typeof check가 이미 true.
    // `as unknown as`: TypeScript 표준 `globalThis` 타입은 임의 property 추가를
    // 거절한다. 런타임의 globalThis는 extensible object이므로 property injection은
    // 안전 (Node `util`의 native TextDecoder/TextEncoder를 그대로 attach).
    (globalThis as unknown as { TextDecoder: typeof TextDecoder }).TextDecoder =
        TextDecoder;
}
if (typeof globalThis.TextEncoder === 'undefined') {
    (globalThis as unknown as { TextEncoder: typeof TextEncoder }).TextEncoder =
        TextEncoder;
}

process.env.ALPACA_API_KEY = 'test-alpaca-key';
process.env.ALPACA_API_SECRET = 'test-alpaca-secret';
process.env.AI_PROVIDER = 'claude';
process.env.GEMINI_CHAT_FREE_API_KEY = 'test-gemini-user-api-key';
process.env.GEMINI_CHAT_API_KEY = 'test-gemini-key';
process.env.ANTHROPIC_CHAT_API_KEY = 'test-anthropic-key';
process.env.OPENAI_CHAT_API_KEY = 'test-openai-key';
process.env.DATABASE_URL = 'test-database-url';

// next/cache의 런타임 API('use cache' 지시자, cacheLife, cacheTag)는
// Next.js 빌드 컨텍스트에서만 동작한다. jest 환경에서는 noop으로 대체한다.
jest.mock('next/cache', () => ({
    cacheLife: () => {},
    cacheTag: () => {},
    revalidatePath: () => {},
    revalidateTag: () => {},
    unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
}));
