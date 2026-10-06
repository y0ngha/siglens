import {
    EMPTY_SNAPSHOT_MAX_POLLS,
    MAX_CONSECUTIVE_FAILURES,
    MAX_POLL_DURATION_MS,
    STAGNANT_POLL_LIMIT,
    STAGNATION_FLOOR_POLLS,
} from '@/shared/config/cardPollingConfig';

/**
 * 뉴스 카드 보강 폴링의 **판정**만 담는다(종목 뉴스·마켓 뉴스 공용).
 *
 * 폴링 자체는 `usePollingQuery`가 돌리고, 결과가 하나 올 때마다 여기 함수가 "다음 상태,
 * 이어갈지, 호출부가 할 일"을 순수하게 돌려준다. 예전에는 같은 종료 조건이 훅 네 개의
 * `setInterval` 콜백 안에 조금씩 다르게 복제돼 있었다.
 */

/** `sentiment`·`priceImpact`가 `null`이면 아직 AI 보강 전이다. */
export interface EnrichableCard {
    sentiment: unknown;
    priceImpact: unknown;
}

export type CardPollOutcome<T> =
    | { ok: true; data: readonly T[] }
    | { ok: false; error: Error };

export interface CardPollCounters {
    pollCount: number;
    consecutiveFailures: number;
    /** 지금까지 관측한 보강 카드 수의 최댓값. 정체 판정의 기준선이다. */
    enrichedCount: number;
    /** 보강 수가 늘지 않은 연속 폴 수. */
    stagnantPolls: number;
}

export const INITIAL_CARD_POLL_COUNTERS: CardPollCounters = {
    pollCount: 0,
    consecutiveFailures: 0,
    enrichedCount: 0,
    stagnantPolls: 0,
};

export function hasPendingCard(items: readonly EnrichableCard[]): boolean {
    return items.some(
        item => item.sentiment === null || item.priceImpact === null
    );
}

export function hasAnyEnrichedCard(
    items: readonly Pick<EnrichableCard, 'sentiment'>[]
): boolean {
    return items.some(item => item.sentiment !== null);
}

/** 목록 폴러의 호출부별 차이. */
export interface CardListPollPolicy {
    /**
     * "전부 보강됨"으로 끝내고 스피너를 끄기 전에 지나야 하는 최소 폴 수. 종목 뉴스는 서버가
     * 뒤에서 새 기사를 받아오는 중일 수 있어 몇 번은 더 확인한다. 마켓 뉴스는 `0`.
     */
    completeMinPolls: number;
    /** 실패도 폴 수로 센다(종목 뉴스) — 실패만 이어지는 빈 목록이 상한까지 끌지 않게. */
    errorsCountAsPolls: boolean;
    /** 5분 상한으로 끝날 때도 완료 알림(`completedItems`)을 보낸다(종목 뉴스). */
    completeOnTimeout: boolean;
    logTag: string;
}

export interface CardListPollStep<T> {
    counters: CardPollCounters;
    stop: boolean;
    /** "새 소식 확인 중" 표시를 끌지. 폴링이 이어져도 끌 수 있다. */
    settled: boolean;
    error: Error | null;
    /** 정상 종료 때 호출부 완료 콜백에 넘길 최종 목록. 알릴 것이 없으면 `null`. */
    completedItems: readonly T[] | null;
}

function recordEnriched(
    counters: CardPollCounters,
    enrichedNow: number
): CardPollCounters {
    return enrichedNow > counters.enrichedCount
        ? { ...counters, enrichedCount: enrichedNow, stagnantPolls: 0 }
        : { ...counters, stagnantPolls: counters.stagnantPolls + 1 };
}

/**
 * 카드 목록 폴러의 한 걸음. 종료 조건:
 * - 5분 상한
 * - 연속 실패 `MAX_CONSECUTIVE_FAILURES`회 → `error`
 * - 빈 목록이 `EMPTY_SNAPSHOT_MAX_POLLS`번 이어짐
 * - 정체: 보강이 한 번이라도 진행된 뒤(`enrichedCount > 0`) `STAGNATION_FLOOR_POLLS`를 지나
 *   보강 수가 `STAGNANT_POLL_LIMIT`번 연속 그대로 — 영구히 보강되지 않는 카드 하나가 "전부
 *   보강" 조건을 영원히 거짓으로 만드는 것을 막는다(감사: 비용 라운드 15~16)
 * - 전부 보강됨
 */
export function decideCardListPoll<T extends EnrichableCard>(
    counters: CardPollCounters,
    outcome: CardPollOutcome<T>,
    elapsedMs: number,
    latestItems: readonly T[],
    policy: CardListPollPolicy
): CardListPollStep<T> {
    const stopWith = (
        next: CardPollCounters,
        extra: Partial<CardListPollStep<T>> = {}
    ): CardListPollStep<T> => ({
        counters: next,
        stop: true,
        settled: true,
        error: null,
        completedItems: null,
        ...extra,
    });

    if (elapsedMs > MAX_POLL_DURATION_MS) {
        const items = outcome.ok ? outcome.data : latestItems;
        return stopWith(counters, {
            completedItems:
                policy.completeOnTimeout && items.length > 0 ? items : null,
        });
    }

    if (!outcome.ok) {
        const next: CardPollCounters = {
            ...counters,
            pollCount: counters.pollCount + (policy.errorsCountAsPolls ? 1 : 0),
            consecutiveFailures: counters.consecutiveFailures + 1,
        };
        console.error(`[${policy.logTag}] poll failed:`, outcome.error);
        if (next.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            return stopWith(next, { error: outcome.error });
        }
        if (
            policy.errorsCountAsPolls &&
            next.pollCount >= EMPTY_SNAPSHOT_MAX_POLLS &&
            !hasPendingCard(latestItems)
        ) {
            return stopWith(next);
        }
        return {
            counters: next,
            stop: false,
            settled: false,
            error: null,
            completedItems: null,
        };
    }

    const fresh = outcome.data;
    const next = recordEnriched(
        {
            ...counters,
            pollCount: counters.pollCount + 1,
            consecutiveFailures: 0,
        },
        fresh.filter(item => item.sentiment !== null).length
    );
    const pastMinPolls = next.pollCount >= policy.completeMinPolls;

    if (fresh.length === 0 && next.pollCount >= EMPTY_SNAPSHOT_MAX_POLLS) {
        return stopWith(next);
    }
    if (
        next.enrichedCount > 0 &&
        next.pollCount >= STAGNATION_FLOOR_POLLS &&
        next.stagnantPolls >= STAGNANT_POLL_LIMIT
    ) {
        return stopWith(next, {
            completedItems: fresh.length > 0 ? fresh : null,
        });
    }
    if (fresh.length > 0 && !hasPendingCard(fresh) && pastMinPolls) {
        return stopWith(next, { completedItems: fresh });
    }
    return {
        counters: next,
        stop: false,
        settled: fresh.length > 0 && pastMinPolls,
        error: null,
        completedItems: null,
    };
}

/** 대기 폴러의 호출부별 차이. */
export interface CardWaitPollPolicy {
    /** 기사가 아예 없음이 이어지면 일찍 접는다(종목 뉴스). */
    stopOnEmpty: boolean;
    /** 5분 상한을 실패로 알린다(마켓 뉴스 다이제스트는 대기 실패 화면으로 넘어간다). */
    timeoutIsError: boolean;
    logTag: string;
}

export interface CardWaitPollStep {
    counters: CardPollCounters;
    stop: boolean;
    error: Error | null;
}

/** 대기 시간 상한 초과를 알리는 오류 문구 — 호출부가 실패 화면 분기에 쓴다. */
export const CARD_WAIT_TIMEOUT_MESSAGE = 'timeout';

/**
 * "보강된 카드가 하나라도 생길 때까지" 기다리는 폴러의 한 걸음. 준비 여부 자체는 호출부가
 * 쿼리 데이터로 파생하므로(`hasAnyEnrichedCard`) 여기서는 이어갈지와 오류만 정한다.
 */
export function decideCardWaitPoll<T extends Pick<EnrichableCard, 'sentiment'>>(
    counters: CardPollCounters,
    outcome: CardPollOutcome<T>,
    elapsedMs: number,
    policy: CardWaitPollPolicy
): CardWaitPollStep {
    if (elapsedMs > MAX_POLL_DURATION_MS) {
        return {
            counters,
            stop: true,
            error: policy.timeoutIsError
                ? new Error(CARD_WAIT_TIMEOUT_MESSAGE)
                : null,
        };
    }
    if (!outcome.ok) {
        const next = {
            ...counters,
            consecutiveFailures: counters.consecutiveFailures + 1,
        };
        console.error(`[${policy.logTag}] poll failed:`, outcome.error);
        return next.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES
            ? { counters: next, stop: true, error: outcome.error }
            : { counters: next, stop: false, error: null };
    }
    const next = {
        ...counters,
        pollCount: counters.pollCount + 1,
        consecutiveFailures: 0,
    };
    const stop =
        hasAnyEnrichedCard(outcome.data) ||
        (policy.stopOnEmpty &&
            outcome.data.length === 0 &&
            next.pollCount >= EMPTY_SNAPSHOT_MAX_POLLS);
    return { counters: next, stop, error: null };
}
