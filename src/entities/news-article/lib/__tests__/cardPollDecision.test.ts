import {
    EMPTY_SNAPSHOT_MAX_POLLS,
    MAX_CONSECUTIVE_FAILURES,
    MAX_POLL_DURATION_MS,
    STAGNANT_POLL_LIMIT,
    STAGNATION_FLOOR_POLLS,
} from '@/shared/config/cardPollingConfig';
import {
    CARD_WAIT_TIMEOUT_MESSAGE,
    type CardListPollPolicy,
    type CardPollCounters,
    type CardPollOutcome,
    type CardWaitPollPolicy,
    decideCardListPoll,
    decideCardWaitPoll,
    type EnrichableCard,
    hasAnyEnrichedCard,
    hasPendingCard,
    INITIAL_CARD_POLL_COUNTERS,
} from '@/entities/news-article/lib/cardPollDecision';

interface Card extends EnrichableCard {
    id: string;
}

const enriched = (id: string): Card => ({
    id,
    sentiment: 'positive',
    priceImpact: 'high',
});
const pending = (id: string): Card => ({
    id,
    sentiment: null,
    priceImpact: null,
});

const ok = (data: Card[]): CardPollOutcome<Card> => ({ ok: true, data });
const fail = (message = 'db error'): CardPollOutcome<Card> => ({
    ok: false,
    error: new Error(message),
});

const SYMBOL_LIST: CardListPollPolicy = {
    completeMinPolls: 5,
    errorsCountAsPolls: true,
    completeOnTimeout: true,
    logTag: 'test-symbol',
};
const MARKET_LIST: CardListPollPolicy = {
    completeMinPolls: 0,
    errorsCountAsPolls: false,
    completeOnTimeout: false,
    logTag: 'test-market',
};
const SYMBOL_WAIT: CardWaitPollPolicy = {
    stopOnEmpty: true,
    timeoutIsError: false,
    logTag: 'test-symbol-wait',
};
const MARKET_WAIT: CardWaitPollPolicy = {
    stopOnEmpty: false,
    timeoutIsError: true,
    logTag: 'test-market-wait',
};

function counters(overrides: Partial<CardPollCounters>): CardPollCounters {
    return { ...INITIAL_CARD_POLL_COUNTERS, ...overrides };
}

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('hasPendingCard / hasAnyEnrichedCard', () => {
    it('sentiment나 priceImpact가 null이면 보강 전이다', () => {
        expect(hasPendingCard([enriched('a'), pending('b')])).toBe(true);
        expect(hasPendingCard([{ sentiment: 'x', priceImpact: null }])).toBe(
            true
        );
        expect(hasPendingCard([enriched('a')])).toBe(false);
    });

    it('sentiment가 하나라도 있으면 보강된 카드가 있다', () => {
        expect(hasAnyEnrichedCard([pending('a'), enriched('b')])).toBe(true);
        expect(hasAnyEnrichedCard([pending('a')])).toBe(false);
        expect(hasAnyEnrichedCard([])).toBe(false);
    });
});

describe('decideCardListPoll', () => {
    it('전부 보강됐어도 최소 폴 수 전에는 이어가고 스피너도 끄지 않는다(종목 뉴스)', () => {
        const step = decideCardListPoll(
            counters({ pollCount: 1 }),
            ok([enriched('a')]),
            0,
            [],
            SYMBOL_LIST
        );

        expect(step.stop).toBe(false);
        expect(step.settled).toBe(false);
    });

    it('최소 폴 수를 지나 전부 보강되면 멈추고 최종 목록으로 완료를 알린다', () => {
        const data = [enriched('a')];
        const step = decideCardListPoll(
            counters({ pollCount: SYMBOL_LIST.completeMinPolls - 1 }),
            ok(data),
            0,
            [],
            SYMBOL_LIST
        );

        expect(step.stop).toBe(true);
        expect(step.completedItems).toEqual(data);
    });

    it('최소 폴 수를 지나면 보강 대기 카드가 있어도 스피너는 끈 채 폴링을 이어간다', () => {
        const step = decideCardListPoll(
            counters({ pollCount: SYMBOL_LIST.completeMinPolls - 1 }),
            ok([pending('a')]),
            0,
            [],
            SYMBOL_LIST
        );

        expect(step.stop).toBe(false);
        expect(step.settled).toBe(true);
    });

    it('마켓 뉴스는 첫 결과에서 전부 보강이면 바로 멈춘다', () => {
        const step = decideCardListPoll(
            INITIAL_CARD_POLL_COUNTERS,
            ok([enriched('a')]),
            0,
            [],
            MARKET_LIST
        );

        expect(step.stop).toBe(true);
    });

    it('빈 스냅샷이 EMPTY_SNAPSHOT_MAX_POLLS번 이어지면 완료 알림 없이 멈춘다', () => {
        const step = decideCardListPoll(
            counters({ pollCount: EMPTY_SNAPSHOT_MAX_POLLS - 1 }),
            ok([]),
            0,
            [],
            MARKET_LIST
        );

        expect(step.stop).toBe(true);
        expect(step.completedItems).toBeNull();
    });

    it('빈 스냅샷이라도 상한 전이면 이어간다', () => {
        const step = decideCardListPoll(
            counters({ pollCount: EMPTY_SNAPSHOT_MAX_POLLS - 2 }),
            ok([]),
            0,
            [],
            MARKET_LIST
        );

        expect(step.stop).toBe(false);
    });

    it('보강이 진행되다 STAGNANT_POLL_LIMIT번 그대로면 정체로 접고 완료를 알린다', () => {
        const data = [enriched('a'), pending('b')];
        const step = decideCardListPoll(
            counters({
                pollCount: STAGNATION_FLOOR_POLLS,
                enrichedCount: 1,
                stagnantPolls: STAGNANT_POLL_LIMIT - 1,
            }),
            ok(data),
            0,
            [],
            SYMBOL_LIST
        );

        expect(step.stop).toBe(true);
        expect(step.completedItems).toEqual(data);
    });

    it('보강 수가 늘면 정체 카운터를 0으로 되돌린다', () => {
        const step = decideCardListPoll(
            counters({
                pollCount: STAGNATION_FLOOR_POLLS,
                enrichedCount: 1,
                stagnantPolls: STAGNANT_POLL_LIMIT - 1,
            }),
            ok([enriched('a'), enriched('b'), pending('c')]),
            0,
            [],
            SYMBOL_LIST
        );

        expect(step.stop).toBe(false);
        expect(step.counters).toMatchObject({
            enrichedCount: 2,
            stagnantPolls: 0,
        });
    });

    it('보강이 한 번도 없었으면(0건) 정체로 접지 않는다 — 콜드 종목', () => {
        const step = decideCardListPoll(
            counters({
                pollCount: STAGNATION_FLOOR_POLLS + STAGNANT_POLL_LIMIT,
                stagnantPolls: STAGNANT_POLL_LIMIT + 5,
            }),
            ok([pending('a')]),
            0,
            [],
            SYMBOL_LIST
        );

        expect(step.stop).toBe(false);
    });

    it('실패는 연속 횟수를 세고 MAX_CONSECUTIVE_FAILURES에서 오류로 멈춘다', () => {
        const below = decideCardListPoll(
            counters({ consecutiveFailures: MAX_CONSECUTIVE_FAILURES - 2 }),
            fail(),
            0,
            [],
            MARKET_LIST
        );
        expect(below.stop).toBe(false);
        expect(below.error).toBeNull();

        const atLimit = decideCardListPoll(
            below.counters,
            fail('db error'),
            0,
            [],
            MARKET_LIST
        );
        expect(atLimit.stop).toBe(true);
        expect(atLimit.error?.message).toBe('db error');
    });

    it('성공하면 연속 실패 수를 0으로 되돌린다', () => {
        const step = decideCardListPoll(
            counters({ consecutiveFailures: 2 }),
            ok([pending('a')]),
            0,
            [],
            MARKET_LIST
        );

        expect(step.counters.consecutiveFailures).toBe(0);
    });

    it('마켓 뉴스는 실패를 폴 수로 세지 않는다', () => {
        const step = decideCardListPoll(
            INITIAL_CARD_POLL_COUNTERS,
            fail(),
            0,
            [],
            MARKET_LIST
        );

        expect(step.counters.pollCount).toBe(0);
    });

    it('종목 뉴스는 실패도 폴 수로 세고, 상한에서 남은 보강이 없으면 접는다', () => {
        const step = decideCardListPoll(
            counters({ pollCount: EMPTY_SNAPSHOT_MAX_POLLS - 1 }),
            fail(),
            0,
            [enriched('a')],
            SYMBOL_LIST
        );

        expect(step.stop).toBe(true);
        expect(step.error).toBeNull();
    });

    it('5분 상한을 넘기면 멈추고, 종목 뉴스는 최신 목록으로 완료를 알린다', () => {
        const latest = [pending('a')];
        const step = decideCardListPoll(
            INITIAL_CARD_POLL_COUNTERS,
            fail(),
            MAX_POLL_DURATION_MS + 1,
            latest,
            SYMBOL_LIST
        );

        expect(step.stop).toBe(true);
        expect(step.completedItems).toEqual(latest);
    });

    it('5분 상한 종료라도 마켓 뉴스는 완료를 알리지 않는다', () => {
        const step = decideCardListPoll(
            INITIAL_CARD_POLL_COUNTERS,
            ok([pending('a')]),
            MAX_POLL_DURATION_MS + 1,
            [],
            MARKET_LIST
        );

        expect(step.stop).toBe(true);
        expect(step.completedItems).toBeNull();
    });
});

describe('decideCardWaitPoll', () => {
    it('보강된 카드가 하나라도 오면 멈춘다(보강 전 카드와 섞여 있어도)', () => {
        const step = decideCardWaitPoll(
            INITIAL_CARD_POLL_COUNTERS,
            ok([pending('a'), enriched('b')]),
            0,
            MARKET_WAIT
        );

        expect(step.stop).toBe(true);
        expect(step.error).toBeNull();
    });

    it('아직 보강된 카드가 없으면 이어간다', () => {
        const step = decideCardWaitPoll(
            INITIAL_CARD_POLL_COUNTERS,
            ok([pending('a')]),
            0,
            MARKET_WAIT
        );

        expect(step.stop).toBe(false);
    });

    it('종목 뉴스는 기사 자체가 없음이 EMPTY_SNAPSHOT_MAX_POLLS번 이어지면 접는다', () => {
        const step = decideCardWaitPoll(
            counters({ pollCount: EMPTY_SNAPSHOT_MAX_POLLS - 1 }),
            ok([]),
            0,
            SYMBOL_WAIT
        );

        expect(step.stop).toBe(true);
    });

    it('기사가 있지만 보강 전이면 같은 횟수에서 접지 않는다', () => {
        const step = decideCardWaitPoll(
            counters({ pollCount: EMPTY_SNAPSHOT_MAX_POLLS - 1 }),
            ok([pending('a')]),
            0,
            SYMBOL_WAIT
        );

        expect(step.stop).toBe(false);
    });

    it('마켓 뉴스는 빈 목록이 이어져도 상한 전에는 접지 않는다', () => {
        const step = decideCardWaitPoll(
            counters({ pollCount: EMPTY_SNAPSHOT_MAX_POLLS }),
            ok([]),
            0,
            MARKET_WAIT
        );

        expect(step.stop).toBe(false);
    });

    it('연속 실패가 MAX_CONSECUTIVE_FAILURES에 닿으면 오류로 멈춘다', () => {
        const step = decideCardWaitPoll(
            counters({ consecutiveFailures: MAX_CONSECUTIVE_FAILURES - 1 }),
            fail('db error'),
            0,
            MARKET_WAIT
        );

        expect(step.stop).toBe(true);
        expect(step.error?.message).toBe('db error');
    });

    it('5분 상한: 마켓 뉴스는 timeout 오류로, 종목 뉴스는 조용히 멈춘다', () => {
        const market = decideCardWaitPoll(
            INITIAL_CARD_POLL_COUNTERS,
            ok([]),
            MAX_POLL_DURATION_MS + 1,
            MARKET_WAIT
        );
        expect(market.stop).toBe(true);
        expect(market.error?.message).toBe(CARD_WAIT_TIMEOUT_MESSAGE);

        const symbol = decideCardWaitPoll(
            INITIAL_CARD_POLL_COUNTERS,
            ok([]),
            MAX_POLL_DURATION_MS + 1,
            SYMBOL_WAIT
        );
        expect(symbol.stop).toBe(true);
        expect(symbol.error).toBeNull();
    });
});
