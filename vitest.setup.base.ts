import { afterAll, vi } from 'vitest';
import { TextDecoder, TextEncoder } from 'util';

// E2E_TEST 누수 가드. `vmThreads` 풀은 워커 한 개 안에서 여러 테스트 파일이
// process.env를 공유하므로, 한 파일이 raw로 설정한 `process.env.E2E_TEST='1'`이
// 같은 워커의 뒤 파일로 새면 isE2E()가 켜져 factory들의 `require('./Fake*')`
// dead-branch가 활성화돼 "Cannot find module" flake가 난다. 파일 단위로(=afterAll)
// 워커 시작 시점의 값으로 복원해, 그 파일이 env를 어떻게 바꿨든 다음 파일로의 누수를
// 차단한다. `afterEach`가 아니라 `afterAll`인 이유: 같은 파일이 `beforeAll`로
// E2E_TEST를 설정하고 여러 테스트를 돌리는 경우 afterEach면 첫 테스트 후 값이 사라져
// 나머지가 깨진다 — 파일 격리만 보장하면 충분하므로 afterAll로 그 위험을 없앤다.
// (`vi.stubEnv` 누수는 config의 `unstubEnvs:true`가 테스트 단위로 담당; 이건 raw
// 할당까지 덮는 belt-and-suspenders.)
const ORIGINAL_E2E_TEST = process.env.E2E_TEST;
afterAll(() => {
    if (ORIGINAL_E2E_TEST === undefined) delete process.env.E2E_TEST;
    else process.env.E2E_TEST = ORIGINAL_E2E_TEST;
});

if (typeof globalThis.TextDecoder === 'undefined') {
    (globalThis as unknown as { TextDecoder: typeof TextDecoder }).TextDecoder =
        TextDecoder;
}
if (typeof globalThis.TextEncoder === 'undefined') {
    (globalThis as unknown as { TextEncoder: typeof TextEncoder }).TextEncoder =
        TextEncoder;
}

process.env.AI_PROVIDER = 'claude';
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
    '[SymbolPage]',
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
    '[getAssetInfoResilient]',
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
