import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    incrementActiveStreams,
    decrementActiveStreams,
    waitForActiveStreams,
    __resetActiveStreamsForTests,
    __activeStreamCount,
    canAcceptAnalysisStream,
    MAX_CONCURRENT_ANALYSIS_STREAMS,
} from '../activeStreams';

/**
 * Task 11: MAX_CONCURRENT_ANALYSIS_STREAMS 상한 리터럴 고정.
 *
 * 기존 테스트는 상수를 import해서 루프에 쓰므로 값이 10 000이 돼도 녹색이 된다.
 * 이 단언이 없으면 미래 리팩터가 실수로 상한을 올려도 아무 게이트도 잡지 못한다.
 *
 * 실측 근거(2026-08): t4g.medium 기준으로 정상 트래픽은 이 근처에 오지 않는다.
 * 넘으면 과부하이거나 남용이다. 이 값보다 훨씬 큰 값을 쓰면 인스턴스가 고갈된다.
 */
it('MAX_CONCURRENT_ANALYSIS_STREAMS가 합리적인 상한(100 이하)을 유지한다', () => {
    // heartbeatStream 테스트의 HEARTBEAT_INTERVAL_MS 단언과 같은 패턴 —
    // 리터럴을 직접 비교해 상수 자체에 대한 회귀를 잡는다.
    expect(MAX_CONCURRENT_ANALYSIS_STREAMS).toBeLessThanOrEqual(100);
    expect(MAX_CONCURRENT_ANALYSIS_STREAMS).toBeGreaterThan(0);
});

describe('canAcceptAnalysisStream — 동시 상한 경계', () => {
    beforeEach(() => {
        __resetActiveStreamsForTests();
    });

    afterEach(() => {
        __resetActiveStreamsForTests();
    });

    it('count === MAX - 1 이면 true를 반환한다(아직 여유가 있다)', () => {
        for (let i = 0; i < MAX_CONCURRENT_ANALYSIS_STREAMS - 1; i++) {
            incrementActiveStreams();
        }
        expect(canAcceptAnalysisStream()).toBe(true);
    });

    it('count === MAX 이면 false를 반환한다(상한 도달)', () => {
        for (let i = 0; i < MAX_CONCURRENT_ANALYSIS_STREAMS; i++) {
            incrementActiveStreams();
        }
        expect(canAcceptAnalysisStream()).toBe(false);
    });
});

describe('activeStreams', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        __resetActiveStreamsForTests();
    });

    afterEach(() => {
        vi.useRealTimers();
        __resetActiveStreamsForTests();
    });

    describe('incrementActiveStreams / decrementActiveStreams', () => {
        it('increment이 카운터를 1씩 증가시킨다', () => {
            expect(__activeStreamCount()).toBe(0);
            incrementActiveStreams();
            expect(__activeStreamCount()).toBe(1);
            incrementActiveStreams();
            expect(__activeStreamCount()).toBe(2);
        });

        it('decrement이 카운터를 1씩 감소시킨다', () => {
            incrementActiveStreams();
            incrementActiveStreams();
            decrementActiveStreams();
            expect(__activeStreamCount()).toBe(1);
        });

        it('이미 0인 상태에서 decrement해도 음수가 되지 않는다', () => {
            decrementActiveStreams();
            expect(__activeStreamCount()).toBe(0);
        });
    });

    describe('waitForActiveStreams', () => {
        it('count가 이미 0이면 즉시 resolve한다', async () => {
            const settled = vi.fn();
            void waitForActiveStreams(5000).then(settled);
            // 타이머를 진행하지 않아도 즉시 resolve되어야 한다.
            await Promise.resolve();
            expect(settled).toHaveBeenCalled();
        });

        it('count가 0에 도달하면 대기 중인 waiter를 깨운다', async () => {
            incrementActiveStreams();
            const settled = vi.fn();
            void waitForActiveStreams(5000).then(settled);

            await Promise.resolve();
            expect(settled).not.toHaveBeenCalled();

            decrementActiveStreams(); // 0에 도달
            await Promise.resolve();
            expect(settled).toHaveBeenCalled();
        });

        it('deadline을 초과하면 count와 무관하게 resolve한다', async () => {
            incrementActiveStreams();
            const settled = vi.fn();
            void waitForActiveStreams(1000).then(settled);

            await Promise.resolve();
            expect(settled).not.toHaveBeenCalled();

            vi.advanceTimersByTime(1000);
            await Promise.resolve();
            expect(settled).toHaveBeenCalled();
        });

        it('count가 0에 도달하면 deadline 타이머를 정리해 프로세스가 매달리지 않는다', async () => {
            const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

            incrementActiveStreams();
            void waitForActiveStreams(5000);

            decrementActiveStreams(); // 0에 도달 → timer 정리
            await Promise.resolve();

            expect(clearTimeoutSpy).toHaveBeenCalled();
        });

        it('여러 waiter가 등록된 경우 count 0 도달 시 모두 깨운다', async () => {
            incrementActiveStreams();
            const settled1 = vi.fn();
            const settled2 = vi.fn();
            void waitForActiveStreams(5000).then(settled1);
            void waitForActiveStreams(5000).then(settled2);

            decrementActiveStreams();
            await Promise.resolve();

            expect(settled1).toHaveBeenCalled();
            expect(settled2).toHaveBeenCalled();
        });
    });

    it('봇은 더 높은 천장을 쓴다 — 사람 상한이 찼어도 크롤러는 통과한다', () => {
        // 사람 트래픽이 슬롯을 채운 동안 Googlebot이 503을 받으면 렌더된 DOM에
        // 실패 배너만 남고, robots.txt에 이 경로를 연 의미가 사라진다.
        for (let i = 0; i < MAX_CONCURRENT_ANALYSIS_STREAMS; i++) {
            incrementActiveStreams();
        }

        expect(canAcceptAnalysisStream(false)).toBe(false);
        expect(canAcceptAnalysisStream(true)).toBe(true);
    });

    it('봇도 무제한은 아니다 — 배수 천장에서 막힌다', () => {
        // `isBot`은 순수 UA 매칭이라 예외로 두면 UA에 'bot'만 넣어 우회할 수 있다.
        for (let i = 0; i < MAX_CONCURRENT_ANALYSIS_STREAMS * 2; i++) {
            incrementActiveStreams();
        }

        expect(canAcceptAnalysisStream(true)).toBe(false);
    });
});
