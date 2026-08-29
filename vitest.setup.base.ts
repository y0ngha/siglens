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

/**
 * `localStorage` 폴리필 — **무조건** 설치하고, `Storage`도 같이 갈아 끼운다.
 *
 * 종전에는 "없거나 setItem이 함수가 아닐 때"만 채웠다. Node 25가 네이티브 전역
 * `localStorage`를 들고 오면서 그 가드가 스킵되고, jsdom 환경에서도 Node 것이
 * `window.localStorage`까지 차지한다(`window.localStorage === globalThis.localStorage`,
 * 생성자 `Object`). 동작은 하므로 조용한 교체였다.
 *
 * 조용하지 않은 결과: Node 네이티브 객체는 프로토타입이 `Storage.prototype`이 아니라
 * 평범한 `Object`다. 그래서 `vi.spyOn(Storage.prototype, 'setItem')` — 이 저장소가
 * 저장소 실패를 흉내 낼 때 쓰는 유일한 방법이자 15군데에서 쓰는 패턴 — 이 아무것도
 * 가로채지 못한다. 던지도록 만든 목이 호출되지 않으니 "저장소가 막혀도 죽지 않는다"를
 * 검증하던 테스트가 **아무것도 검증하지 않게 된다.** 두 건은 호출 횟수를 단언해 실패로
 * 드러났지만 나머지는 통과한 채로 비었다 — 더 나쁜 쪽이다.
 *
 * 그래서 `Storage` 전역 자체를 여기 정의한 클래스로 바꾸고 `localStorage`를 그 인스턴스로
 * 둔다. 테스트가 보는 `Storage.prototype`이 이 클래스의 프로토타입이 되므로 기존 스파이
 * 15군데가 손대지 않고 다시 동작한다.
 *
 * **남의 프로토타입에 얹지 않는 이유**: jsdom과 Node의 `Storage.prototype`은 메서드가
 * 브랜드 검사에 걸려 있어(`'setItem' called on an object that is not a valid instance of
 * Storage`) 이 구성에서 쓸 수 없고, `length`가 non-configurable이라 덮어쓰려 하면
 * `TypeError: Cannot redefine property: length`로 셋업 자체가 죽는다.
 */
{
    class TestStorage {
        private readonly store = new Map<string, string>();

        getItem(key: string): string | null {
            return this.store.get(String(key)) ?? null;
        }

        setItem(key: string, value: string): void {
            this.store.set(String(key), String(value));
        }

        removeItem(key: string): void {
            this.store.delete(String(key));
        }

        clear(): void {
            this.store.clear();
        }

        key(index: number): string | null {
            return [...this.store.keys()][index] ?? null;
        }

        get length(): number {
            return this.store.size;
        }
    }

    const define = (name: string, value: unknown): void => {
        Object.defineProperty(globalThis, name, {
            value,
            writable: true,
            configurable: true,
        });
    };

    define('Storage', TestStorage);
    define('localStorage', new TestStorage());
}

vi.mock('next/cache', () => ({
    cacheLife: () => {},
    cacheTag: () => {},
    revalidatePath: () => {},
    revalidateTag: () => {},
    unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
}));

const expectedConsolePrefixes = [
    '[CachedFinancials]',
    '[ReanalyzeCooldown]',
    '[SymbolPage]',
    '[PWA]',
    '[YahooOptionsAdapter]',
    '[cancel route]',
    '[cancelAnalysisJobAction]',
    '[cancelFundamentalAnalysisJobAction]',
    '[cancelMarketNewsDigestAction]',
    '[cancelNewsAnalysisJobAction]',
    '[cancelOverallAnalysisJobAction]',
    '[confirmPasswordResetAction]',
    '[currentUserAction]',
    '[deleteAccountAction]',
    '[ensureMarketNewsCardsAnalyzedAction]',
    '[ensureNewsCardsAnalyzedAction]',
    '[getAssetInfo]',
    '[getAssetInfoResilient]',
    '[getMarketNewsCardsAction]',
    '[getMarketSummaryAction]',
    '[getRegisteredProvidersAction]',
    '[getSectorSignalsAction]',
    '[koreanNameStore]',
    '[loginAction]',
    '[newsClient]',
    '[optionsDataCache]',
    '[pollMarketNewsDigestAction]',
    '[pollOptionsAnalysisAction]',
    '[requestEmailVerification]',
    '[requestEmailVerificationAction]',
    '[requestPasswordReset]',
    '[requestPasswordResetAction]',
    '[searchTicker]',
    '[submitAnalysisAction]',
    '[submitContactAction]',
    '[submitFundamentalAnalysisAction]',
    '[submitMarketNewsDigestAction]',
    '[submitNewsAnalysisAction]',
    '[submitOptionsAnalysisAction]',
    '[submitOverallAnalysisAction]',
    '[useAnalysis]',
    '[useMarketNewsCardPolling]',
    '[useMarketNewsDigest]',
    '[useNewsCardPolling]',
    '[useWaitForMarketNewsCards]',
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
