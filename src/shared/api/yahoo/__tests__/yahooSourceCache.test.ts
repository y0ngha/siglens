import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const quoteSummary = vi.fn();
const fundamentalsTimeSeries = vi.fn();

vi.mock('yahoo-finance2', () => ({
    default: class {
        quoteSummary = quoteSummary;
        fundamentalsTimeSeries = fundamentalsTimeSeries;
    },
}));

const { getYahooFundamentals, _resetYahooFundamentalCacheForTest } =
    await import('../yahooFundamentalSource');
const { getYahooStatements, _resetYahooStatementsCacheForTest } =
    await import('../yahooStatementsSource');

/** dedup 창(60초)보다 확실히 큰 값. */
const PAST_DEDUP_WINDOW_MS = 61_000;

beforeEach(() => {
    quoteSummary.mockReset().mockResolvedValue({ price: { longName: 'X' } });
    fundamentalsTimeSeries.mockReset().mockResolvedValue([]);
    _resetYahooFundamentalCacheForTest();
    _resetYahooStatementsCacheForTest();
    vi.useFakeTimers();
});

afterEach(() => vi.useRealTimers());

describe('getYahooFundamentals dedup', () => {
    it('collapses concurrent calls for the same symbol into one fetch', async () => {
        // FundamentalProvider는 16개 메서드를 병렬로 부른다 — dedup이 없으면
        // 한 종목이 yahoo에 16번 동시 요청을 보내 rate limit을 부른다.
        const results = await Promise.all([
            getYahooFundamentals('005930.KS'),
            getYahooFundamentals('005930.KS'),
            getYahooFundamentals('005930.KS'),
        ]);

        expect(quoteSummary).toHaveBeenCalledTimes(1);
        expect(results[0]).toBe(results[1]);
        expect(results[1]).toBe(results[2]);
    });

    it('reuses the cached result inside the dedup window', async () => {
        await getYahooFundamentals('005930.KS');
        vi.advanceTimersByTime(30_000);
        await getYahooFundamentals('005930.KS');

        expect(quoteSummary).toHaveBeenCalledTimes(1);
    });

    it('refetches once the dedup window has elapsed', async () => {
        await getYahooFundamentals('005930.KS');
        vi.advanceTimersByTime(PAST_DEDUP_WINDOW_MS);
        await getYahooFundamentals('005930.KS');

        expect(quoteSummary).toHaveBeenCalledTimes(2);
    });

    it('keys the cache per symbol', async () => {
        await getYahooFundamentals('005930.KS');
        await getYahooFundamentals('247540.KQ');

        expect(quoteSummary).toHaveBeenCalledTimes(2);
    });

    it('normalizes symbol case so the cache is not bypassed', async () => {
        await getYahooFundamentals('005930.ks');
        await getYahooFundamentals('005930.KS');

        expect(quoteSummary).toHaveBeenCalledTimes(1);
    });

    it('degrades to an empty bundle instead of throwing when quoteSummary fails', async () => {
        // 펀더멘털은 부분 결측이 정상이므로 호출부가 예외를 받으면 안 된다.
        quoteSummary.mockRejectedValue(new Error('yahoo down'));

        await expect(getYahooFundamentals('005930.KS')).resolves.toMatchObject({
            summary: null,
        });
    });

    it('shares the statements cache with getYahooStatements', async () => {
        // fundamental 탭과 financials 탭을 함께 열면 같은 재무제표를 두 번 가져오던
        // 문제를 막는 지점 — 두 소스가 한 캐시를 공유해야 한다.
        // fundamental은 연간(성장률용) + 분기(PBR·부채비율 분모용)를 모두 쓰므로
        // 양쪽을 미리 채워 두면 추가 호출이 0이어야 한다.
        await getYahooStatements('005930.KS', 'annual');
        await getYahooStatements('005930.KS', 'quarter');
        const callsAfterStatements = fundamentalsTimeSeries.mock.calls.length;

        await getYahooFundamentals('005930.KS');

        expect(fundamentalsTimeSeries.mock.calls.length).toBe(
            callsAfterStatements
        );
    });

    it('fetches only the quarterly balance sheet, not all three statements', async () => {
        // PBR·부채비율 분모만 필요한데 전체 제표를 받으면 손익·현금흐름 2개 모듈이
        // 그대로 버려진다. fundamental 탭만 여는 가장 흔한 경로에서 매번 낭비된다.
        await getYahooFundamentals('005930.KS');

        const quarterCalls = fundamentalsTimeSeries.mock.calls.filter(
            c => (c[1] as { type?: string })?.type === 'quarterly'
        );
        expect(quarterCalls).toHaveLength(1);
        expect(quarterCalls[0]![1]).toMatchObject({ module: 'balance-sheet' });
    });

    it('fetches quarterly balance so PBR uses the latest reported equity', async () => {
        // 연간 자본만 쓰면 결산 이후 분기가 빠져 PBR이 과대해진다(SK하이닉스 실측 +36%).
        const result = await getYahooFundamentals('005930.KS');

        expect(result.quarterlyBalance).toBeDefined();
        expect(fundamentalsTimeSeries).toHaveBeenCalledWith(
            '005930.KS',
            expect.objectContaining({ type: 'quarterly' }),
            expect.anything()
        );
    });

    it('keeps other statements when one module fails', async () => {
        fundamentalsTimeSeries
            .mockRejectedValueOnce(new Error('income down'))
            .mockResolvedValue([{ totalAssets: 1 }]);

        const result = await getYahooFundamentals('005930.KS');

        expect(result.income).toEqual([]);
        expect(result.summary).not.toBeNull();
    });
});

describe('getYahooStatements dedup', () => {
    it('collapses concurrent calls for the same symbol and period', async () => {
        await Promise.all([
            getYahooStatements('005930.KS', 'annual'),
            getYahooStatements('005930.KS', 'annual'),
        ]);

        // income / balance-sheet / cash-flow 각 1회 = 3회. dedup 없으면 6회.
        expect(fundamentalsTimeSeries).toHaveBeenCalledTimes(3);
    });

    it('keys the cache per period so annual and quarter do not collide', async () => {
        await getYahooStatements('005930.KS', 'annual');
        await getYahooStatements('005930.KS', 'quarter');

        expect(fundamentalsTimeSeries).toHaveBeenCalledTimes(6);
    });

    it('translates the domain period to the yahoo type', async () => {
        await getYahooStatements('005930.KS', 'quarter');

        expect(fundamentalsTimeSeries).toHaveBeenCalledWith(
            '005930.KS',
            expect.objectContaining({ type: 'quarterly' }),
            // 스키마 검증 우회 옵션이 3번째 인자로 붙는다.
            expect.objectContaining({ validateResult: false })
        );
    });

    it('skips library schema validation so one missing field cannot drop the statement', async () => {
        // 실측: NAVER는 미확정 분기의 epsActual 결측만으로 응답 전체가 throw됐다.
        await getYahooStatements('005930.KS', 'annual');

        expect(fundamentalsTimeSeries).toHaveBeenCalledWith(
            '005930.KS',
            expect.anything(),
            expect.objectContaining({ validateResult: false })
        );
    });

    it('reverses yahoo order so callers get newest first', async () => {
        // yahoo는 오래된 기간부터 준다. 뒤집지 않으면 성장률이 부호까지 반대로 계산된다.
        fundamentalsTimeSeries.mockResolvedValue([
            { date: new Date('2024-12-31') },
            { date: new Date('2025-12-31') },
        ]);

        const { income } = await getYahooStatements('005930.KS', 'annual');

        expect(income[0]!.date).toEqual(new Date('2025-12-31'));
    });

    it('degrades a failing module to an empty array', async () => {
        fundamentalsTimeSeries.mockRejectedValue(new Error('down'));

        await expect(
            getYahooStatements('005930.KS', 'annual')
        ).resolves.toEqual({
            income: [],
            balance: [],
            cashFlow: [],
        });
    });
});
