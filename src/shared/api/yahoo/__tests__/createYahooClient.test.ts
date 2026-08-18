import { describe, expect, it, vi } from 'vitest';

const constructorArgs: unknown[] = [];

vi.mock('yahoo-finance2', () => ({
    default: class MockYahooFinance {
        constructor(opts?: unknown) {
            constructorArgs.push(opts);
        }
    },
}));

import {
    createYahooClient,
    YAHOO_FETCH_TIMEOUT_MS,
} from '@/shared/api/yahoo/createYahooClient';

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
