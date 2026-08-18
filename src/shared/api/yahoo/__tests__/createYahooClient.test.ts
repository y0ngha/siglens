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
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockImplementation(async (_input, init) => {
                seen.push(init?.signal ?? undefined);
                return new Response('{}');
            });

        try {
            await opts.fetch!('https://example.test/a');
            await opts.fetch!('https://example.test/b');
        } finally {
            fetchSpy.mockRestore();
        }

        expect(seen).toHaveLength(2);
        expect(seen[0]).toBeInstanceOf(AbortSignal);
        // 시그널을 인스턴스 옵션에 한 번만 만들어 두면 첫 타임아웃 이후 모든 호출이
        // 이미 abort된 시그널을 받는다 — 그래서 호출마다 달라야 한다.
        expect(seen[0]).not.toBe(seen[1]);
        expect(seen[0]!.aborted).toBe(false);
    });

    it('호출부 시그널이 있으면 둘 다 존중한다', async () => {
        createYahooClient();
        const opts = constructorArgs.at(-1) as CapturedOptions;

        const controller = new AbortController();
        let captured: AbortSignal | undefined;
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockImplementation(async (_input, init) => {
                captured = init?.signal ?? undefined;
                return new Response('{}');
            });

        try {
            await opts.fetch!('https://example.test/c', {
                signal: controller.signal,
            });
        } finally {
            fetchSpy.mockRestore();
        }

        expect(captured).toBeInstanceOf(AbortSignal);
        expect(captured!.aborted).toBe(false);
        // 상위 취소가 우리 타임아웃에 삼켜지면 안 된다.
        controller.abort();
        expect(captured!.aborted).toBe(true);
    });

    it('타임아웃이 ALB idle(60초)보다 충분히 짧다', () => {
        expect(YAHOO_FETCH_TIMEOUT_MS).toBeLessThan(60_000);
    });
});
