import { describe, expect, it, vi } from 'vitest';

const constructorArgs: unknown[] = [];
const quoteImpl = vi.fn(async (symbol: string) => ({ symbol }));
// allowlist에 없는 동기 헬퍼 흉내 — 감싸이면 안 되므로 async가 아니다.
const syncHelperImpl = vi.fn((symbol: string) => ({ symbol, sync: true }));

vi.mock('yahoo-finance2', () => ({
    default: class MockYahooFinance {
        constructor(opts?: unknown) {
            constructorArgs.push(opts);
        }
        quote(symbol: string) {
            return quoteImpl(symbol);
        }
        // yahoo-finance2 allowlist 밖의 동기 헬퍼를 흉내낸다(예: `_setOpts`류).
        notAGuardedMethod(symbol: string) {
            return syncHelperImpl(symbol);
        }
    },
}));

import {
    createYahooClient,
    YAHOO_FETCH_TIMEOUT_MS,
} from '@/shared/api/yahoo/createYahooClient';
import { __resetOfflineBuildWarningsForTests } from '@/shared/api/offlineBuild';

interface CapturedOptions {
    suppressNotices?: string[];
    validation?: { logErrors?: boolean };
    fetch?: (input: unknown, init?: RequestInit) => Promise<Response>;
}

/**
 * yahoo는 종목 페이지 **렌더를 막는 경로**에 있고, 라이브러리 기본 timeout은
 * 3.15.3에서 죽은 속성이다(`queue.timeout`이 주석 처리돼 있고 큐가 읽지도 않는다).
 * 타임아웃이 없으면 공유 큐(`concurrency: 4`)에 소켓 4개가 물리는 순간 프로세스 안의
 * 모든 yahoo 호출이 직렬화되고, ALB idle 60초에 걸려 504가 나간다.
 */
describe('createYahooClient', () => {
    it('요청마다 새 타임아웃 시그널을 만든다', async () => {
        createYahooClient();
        const opts = constructorArgs.at(-1) as CapturedOptions;
        expect(opts.fetch).toBeTypeOf('function');

        const seen: (AbortSignal | undefined)[] = [];
        // `new AbortController().signal`도 "매 호출 새 인스턴스"·"아직 abort 안 됨"
        // 조건은 통과한다 — 그건 절대 타임아웃되지 않는 시그널이기 때문이다. 실제로
        // `AbortSignal.timeout`이 우리 상수로 불렸는지까지 확인해야 이 클라이언트가
        // 존재하는 이유(타임아웃이 실제로 발동한다)를 검증한다.
        const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockImplementation(async (_input, init) => {
                seen.push(init?.signal ?? undefined);
                return new Response('{}');
            });

        let timeoutCalls: unknown[][];
        try {
            await opts.fetch!('https://example.test/a');
            await opts.fetch!('https://example.test/b');
            // `mockRestore()`는 원래 구현 복원뿐 아니라 `mock.calls` 기록도 지운다 —
            // finally에서 복원하기 전에 호출 기록을 먼저 떼어 둔다.
            timeoutCalls = timeoutSpy.mock.calls;
        } finally {
            fetchSpy.mockRestore();
            timeoutSpy.mockRestore();
        }

        expect(seen).toHaveLength(2);
        expect(seen[0]).toBeInstanceOf(AbortSignal);
        // 시그널을 인스턴스 옵션에 한 번만 만들어 두면 첫 타임아웃 이후 모든 호출이
        // 이미 abort된 시그널을 받는다 — 그래서 호출마다 달라야 한다.
        expect(seen[0]).not.toBe(seen[1]);
        expect(seen[0]!.aborted).toBe(false);
        expect(timeoutCalls).toHaveLength(2);
        expect(timeoutCalls[0]).toEqual([YAHOO_FETCH_TIMEOUT_MS]);
        expect(timeoutCalls[1]).toEqual([YAHOO_FETCH_TIMEOUT_MS]);
    });

    it('호출부 시그널이 있으면 둘 다 존중한다', async () => {
        createYahooClient();
        const opts = constructorArgs.at(-1) as CapturedOptions;

        const controller = new AbortController();
        let captured: AbortSignal | undefined;
        const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockImplementation(async (_input, init) => {
                captured = init?.signal ?? undefined;
                return new Response('{}');
            });

        let timeoutCalls: unknown[][];
        try {
            await opts.fetch!('https://example.test/c', {
                signal: controller.signal,
            });
            // `mockRestore()`가 `mock.calls` 기록까지 지우므로 복원 전에 떼어 둔다.
            timeoutCalls = timeoutSpy.mock.calls;
        } finally {
            fetchSpy.mockRestore();
            timeoutSpy.mockRestore();
        }

        expect(captured).toBeInstanceOf(AbortSignal);
        expect(captured!.aborted).toBe(false);
        // 상위 취소가 우리 타임아웃에 삼켜지면 안 된다.
        controller.abort();
        expect(captured!.aborted).toBe(true);
        // 호출부 시그널이 있어도 우리 타임아웃은 여전히 걸려야 한다 —
        // `AbortSignal.any([init.signal, timeout])`가 timeout 쪽을 빼먹으면
        // 호출부가 취소를 안 할 경우 무한정 걸린다.
        expect(timeoutCalls).toEqual([[YAHOO_FETCH_TIMEOUT_MS]]);
    });

    it('타임아웃이 ALB idle(60초)보다 충분히 짧다', () => {
        expect(YAHOO_FETCH_TIMEOUT_MS).toBeLessThan(60_000);
    });
});

describe('createYahooClient의 offline build 가드는', () => {
    beforeEach(() => {
        __resetOfflineBuildWarningsForTests();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('SIGLENS_OFFLINE_BUILD=1이면 실제 fetch 없이 [offline-build] 에러를 던진다', async () => {
        vi.stubEnv('SIGLENS_OFFLINE_BUILD', '1');
        createYahooClient();
        const opts = constructorArgs.at(-1) as CapturedOptions;

        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        try {
            // 가드가 `fetch(...)` 호출 전에 동기적으로 throw하므로(async 래핑 없음),
            // 프라미스 거부가 아니라 동기 예외로 검증한다.
            expect(() => opts.fetch!('https://example.test/offline')).toThrow(
                '[offline-build]'
            );
            expect(fetchSpy).not.toHaveBeenCalled();
        } finally {
            fetchSpy.mockRestore();
        }
    });

    it('SIGLENS_OFFLINE_BUILD가 미설정이면 평소대로 fetch를 호출한다', async () => {
        vi.stubEnv('SIGLENS_OFFLINE_BUILD', '');
        createYahooClient();
        const opts = constructorArgs.at(-1) as CapturedOptions;

        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockResolvedValue(new Response('{}'));
        try {
            await opts.fetch!('https://example.test/online');
            expect(fetchSpy).toHaveBeenCalledOnce();
        } finally {
            fetchSpy.mockRestore();
        }
    });
});

/**
 * fetch 레벨 가드는 `quote`가 타는 crumb 경로(`lib/getCrumb.js`)를 막지 못한다 —
 * 거기서 막힌 fetch의 throw가 공유 crumb promise를 영영 안 풀린 채로 남겨, 이후
 * 모든 `quote` 호출이 그 promise를 기다리며 함께 멈춘다(실측: `/market/kr`
 * prerender가 60초 타임아웃에 3번 연속 걸림). 그래서 메서드 호출 자체를 라이브러리
 * 진입 전에 막는 별도 Proxy 가드가 필요하다.
 */
describe('createYahooClient의 메서드 레벨 offline 가드는', () => {
    beforeEach(() => {
        __resetOfflineBuildWarningsForTests();
        quoteImpl.mockClear();
        syncHelperImpl.mockClear();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('SIGLENS_OFFLINE_BUILD=1이면 allowlist 메서드는 실제 라이브러리 메서드를 호출하지 않고 reject한다', async () => {
        vi.stubEnv('SIGLENS_OFFLINE_BUILD', '1');
        const client = createYahooClient();

        await expect(client.quote('005930.KS')).rejects.toThrow(
            '[offline-build]'
        );
        expect(quoteImpl).not.toHaveBeenCalled();
    });

    it('SIGLENS_OFFLINE_BUILD=1이어도 allowlist 밖의 함수 프로퍼티는 그대로 통과시켜 동기 반환을 보존한다', () => {
        vi.stubEnv('SIGLENS_OFFLINE_BUILD', '1');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock 클래스에만 있는 메서드
        const client = createYahooClient() as any;

        // Promise가 아니라 동기 값이 그대로 나와야 한다 — 감싸졌다면 Promise가 됐을 것이다.
        const result = client.notAGuardedMethod('005930.KS');
        expect(result).toEqual({ symbol: '005930.KS', sync: true });
        expect(syncHelperImpl).toHaveBeenCalledWith('005930.KS');
    });

    it('SIGLENS_OFFLINE_BUILD가 미설정이면 allowlist 메서드는 실제 라이브러리 메서드로 전달한다', async () => {
        vi.stubEnv('SIGLENS_OFFLINE_BUILD', '');
        const client = createYahooClient();

        const result = await client.quote('005930.KS');
        expect(quoteImpl).toHaveBeenCalledWith('005930.KS');
        expect(result).toEqual({ symbol: '005930.KS' });
    });
});
