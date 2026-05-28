import { vi } from 'vitest';
import { TextDecoder, TextEncoder } from 'util';

if (typeof globalThis.TextDecoder === 'undefined') {
    (globalThis as unknown as { TextDecoder: typeof TextDecoder }).TextDecoder =
        TextDecoder;
}
if (typeof globalThis.TextEncoder === 'undefined') {
    (globalThis as unknown as { TextEncoder: typeof TextEncoder }).TextEncoder =
        TextEncoder;
}

process.env.AI_PROVIDER = 'claude';
process.env.GEMINI_CHAT_FREE_API_KEY = 'test-gemini-user-api-key';
process.env.GEMINI_CHAT_API_KEY = 'test-gemini-key';
process.env.ANTHROPIC_CHAT_API_KEY = 'test-anthropic-key';
process.env.OPENAI_CHAT_API_KEY = 'test-openai-key';
process.env.DATABASE_URL = 'test-database-url';
// Vite의 dotenv가 .env.local(NEXT_PUBLIC_SITE_URL="http://localhost:4200")을
// 자동 로드한다. vmThreads + fsModuleCache에서 seo.ts의 SITE_URL은 모듈 캐시에
// 한 번만 평가되므로, 개별 테스트 파일의 process.env 오버라이드보다 이 setup이
// 먼저 실행되어야 canonical URL 회귀가드가 production URL로 동작한다.
process.env.NEXT_PUBLIC_SITE_URL = 'https://siglens.io';

if (
    typeof globalThis.localStorage === 'undefined' ||
    typeof globalThis.localStorage.setItem !== 'function'
) {
    const store = new Map<string, string>();
    const storage = {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, String(value)),
        removeItem: (key: string) => store.delete(key),
        clear: () => store.clear(),
        get length() {
            return store.size;
        },
        key: (index: number) => [...store.keys()][index] ?? null,
    };
    Object.defineProperty(globalThis, 'localStorage', {
        value: storage,
        writable: true,
    });
}

vi.mock('next/cache', () => ({
    cacheLife: () => {},
    cacheTag: () => {},
    revalidatePath: () => {},
    revalidateTag: () => {},
    unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
}));

const expectedConsolePrefixes = [
    '[ReanalyzeCooldown]',
    '[PWA]',
    '[YahooOptionsAdapter]',
    '[cancel route]',
    '[cancelAnalysisJobAction]',
    '[cancelFundamentalAnalysisJobAction]',
    '[cancelNewsAnalysisJobAction]',
    '[cancelOverallAnalysisJobAction]',
    '[confirmPasswordResetAction]',
    '[currentUserAction]',
    '[deleteAccountAction]',
    '[ensureNewsCardsAnalyzedAction]',
    '[getAssetInfo]',
    '[getMarketSummaryAction]',
    '[getRegisteredProvidersAction]',
    '[getSectorSignalsAction]',
    '[koreanNameStore]',
    '[loginAction]',
    '[newsClient]',
    '[optionsDataCache]',
    '[pollOptionsAnalysisAction]',
    '[requestEmailVerification]',
    '[requestEmailVerificationAction]',
    '[requestPasswordReset]',
    '[requestPasswordResetAction]',
    '[searchTicker]',
    '[submitAnalysisAction]',
    '[submitContactAction]',
    '[submitFundamentalAnalysisAction]',
    '[submitNewsAnalysisAction]',
    '[submitOptionsAnalysisAction]',
    '[submitOverallAnalysisAction]',
    '[useAnalysis]',
    '[useNewsCardPolling]',
    '[useWaitForNewsCards]',
    '[verifyEmailAction]',
    'Error in registerAction:',
];

function isExpectedConsoleMessage(args: unknown[]) {
    const [first] = args;
    if (typeof first !== 'string') return false;
    if (expectedConsolePrefixes.some(prefix => first.startsWith(prefix)))
        return true;
    if (first.includes('was not wrapped in act(')) return true;
    return false;
}

const originalConsoleError = console.error.bind(console);
const originalConsoleWarn = console.warn.bind(console);

console.error = (...args: unknown[]) => {
    if (isExpectedConsoleMessage(args)) return;
    originalConsoleError(...args);
};

console.warn = (...args: unknown[]) => {
    if (isExpectedConsoleMessage(args)) return;
    originalConsoleWarn(...args);
};
