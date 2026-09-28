import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * [회귀] 이 클래스에는 테스트 파일이 아예 없었다 — `toFmpShape`의 `rawPayload`와
 * `getEarningsReport`의 2필드 투영에서 `symbol`과 `earningsDate`를 맞바꿔도
 * yahoo + fmp 스위트 458건이 전부 통과했다(감사 라운드 12).
 *
 * 두 값이 가는 곳이 다르다: `getEarningsReport`는 core의 `runFundamentalAnalysis`가
 * 그대로 받아 펀더멘털 AI 프롬프트에 싣고, `rawPayload`는 `earnings_reports`의
 * NOT NULL jsonb 컬럼으로 영속화된다.
 */
const { getYahooFundamentals } = vi.hoisted(() => ({
    getYahooFundamentals: vi.fn(),
}));
vi.mock('../yahooFundamentalSource', () => ({ getYahooFundamentals }));

const { YahooFundamentalProvider } =
    await import('../YahooFundamentalProvider');

const SYMBOL = '005930.KS';

/** 예정 실적 1건만 담은 최소 yahoo 응답. */
function fundamentalsWithUpcoming(options: { estimated: boolean }) {
    return {
        summary: {
            calendarEvents: {
                earnings: {
                    earningsDate: [new Date('2026-10-08T00:00:00Z')],
                    earningsAverage: 1234,
                    revenueAverage: 5678,
                    isEarningsDateEstimate: options.estimated,
                },
            },
        },
    };
}

/** 값이 하나도 없는 최소 yahoo 응답 — 각 map* 함수가 null/[]로 degrade하는지 확인용. */
const EMPTY_FUNDAMENTALS = {
    summary: undefined,
    income: [],
    balance: [],
    quarterlyBalance: [],
    cashFlow: [],
};

/** 실제 필드가 채워진 yahoo 응답 — 위임 경로가 값을 그대로 실어 나르는지 확인용. */
const FULL_FUNDAMENTALS = {
    summary: {
        price: { longName: 'Samsung Electronics Co Ltd' },
        assetProfile: { sector: 'Technology', industry: 'Semiconductors' },
        summaryDetail: { marketCap: 400_000_000_000 },
        financialData: {
            returnOnEquity: 0.12,
            targetHighPrice: 100,
            targetLowPrice: 50,
            targetMedianPrice: 75,
            targetMeanPrice: 76,
        },
        earningsTrend: {
            trend: [
                {
                    period: '0q',
                    earningsEstimate: { avg: 1.2 },
                    revenueEstimate: { avg: 3.4 },
                },
            ],
        },
    },
    income: [
        { totalRevenue: 200, basicEPS: 2 },
        { totalRevenue: 100, basicEPS: 1 },
    ],
    balance: [],
    quarterlyBalance: [],
    cashFlow: [{ operatingCashFlow: 500 }],
};

describe('YahooFundamentalProvider — 위임 및 결측 degrade', () => {
    beforeEach(() => {
        getYahooFundamentals.mockReset();
    });

    it('getProfile — summary가 없으면 null로 degrade한다', async () => {
        getYahooFundamentals.mockResolvedValue(EMPTY_FUNDAMENTALS);
        const result = await new YahooFundamentalProvider().getProfile(SYMBOL);
        expect(result).toBeNull();
    });

    it('getProfile — yahoo 응답을 FundamentalProfile로 위임 매핑한다', async () => {
        getYahooFundamentals.mockResolvedValue(FULL_FUNDAMENTALS);
        const result = await new YahooFundamentalProvider().getProfile(SYMBOL);
        expect(result).toMatchObject({
            symbol: SYMBOL,
            companyName: 'Samsung Electronics Co Ltd',
            sector: 'Technology',
        });
    });

    it('getKeyMetricsTtm — summary가 없으면 null', async () => {
        getYahooFundamentals.mockResolvedValue(EMPTY_FUNDAMENTALS);
        const result = await new YahooFundamentalProvider().getKeyMetricsTtm(
            SYMBOL
        );
        expect(result).toBeNull();
    });

    it('getRatiosTtm — financialData가 없으면 null', async () => {
        getYahooFundamentals.mockResolvedValue(EMPTY_FUNDAMENTALS);
        const result = await new YahooFundamentalProvider().getRatiosTtm(
            SYMBOL
        );
        expect(result).toBeNull();
    });

    it('getRatiosTtm — financialData가 있으면 ROE 등을 위임 매핑한다', async () => {
        getYahooFundamentals.mockResolvedValue(FULL_FUNDAMENTALS);
        const result = await new YahooFundamentalProvider().getRatiosTtm(
            SYMBOL
        );
        expect(result?.returnOnEquityTTM).toBe(0.12);
    });

    it('getCashFlowStatement — cashFlow 행이 없으면 null', async () => {
        getYahooFundamentals.mockResolvedValue(EMPTY_FUNDAMENTALS);
        const result =
            await new YahooFundamentalProvider().getCashFlowStatement(SYMBOL);
        expect(result).toBeNull();
    });

    it('getCashFlowStatement — 최신 행의 operatingCashFlow를 위임 매핑한다', async () => {
        getYahooFundamentals.mockResolvedValue(FULL_FUNDAMENTALS);
        const result =
            await new YahooFundamentalProvider().getCashFlowStatement(SYMBOL);
        expect(result?.operatingCashFlow).toBe(500);
    });

    it('getIncomeStatementGrowth — 회계연도 행이 2개 미만이면 null', async () => {
        getYahooFundamentals.mockResolvedValue(EMPTY_FUNDAMENTALS);
        const result =
            await new YahooFundamentalProvider().getIncomeStatementGrowth(
                SYMBOL
            );
        expect(result).toBeNull();
    });

    it('getIncomeStatementGrowth — 최근 2개 연도로 성장률을 위임 계산한다', async () => {
        getYahooFundamentals.mockResolvedValue(FULL_FUNDAMENTALS);
        const result =
            await new YahooFundamentalProvider().getIncomeStatementGrowth(
                SYMBOL
            );
        expect(result?.growthRevenue).toBe(1); // (200-100)/100
    });

    it('getGradesConsensus — summary가 없으면 null', async () => {
        getYahooFundamentals.mockResolvedValue(EMPTY_FUNDAMENTALS);
        const result = await new YahooFundamentalProvider().getGradesConsensus(
            SYMBOL
        );
        expect(result).toBeNull();
    });

    it('getPriceTargetConsensus — 커버리지가 없으면(네 값 모두 null) null', async () => {
        getYahooFundamentals.mockResolvedValue(EMPTY_FUNDAMENTALS);
        const result =
            await new YahooFundamentalProvider().getPriceTargetConsensus(
                SYMBOL
            );
        expect(result).toBeNull();
    });

    it('getPriceTargetConsensus — 목표주가 컨센서스를 위임 매핑한다', async () => {
        getYahooFundamentals.mockResolvedValue(FULL_FUNDAMENTALS);
        const result =
            await new YahooFundamentalProvider().getPriceTargetConsensus(
                SYMBOL
            );
        expect(result).toEqual({
            targetHigh: 100,
            targetLow: 50,
            targetMedian: 75,
            targetConsensus: 76,
        });
    });

    it('getAnalystEstimates — earningsTrend가 없으면 null', async () => {
        getYahooFundamentals.mockResolvedValue(EMPTY_FUNDAMENTALS);
        const result = await new YahooFundamentalProvider().getAnalystEstimates(
            SYMBOL
        );
        expect(result).toBeNull();
    });

    it('getAnalystEstimates — 당분기(0q) 추정치를 위임 매핑한다', async () => {
        getYahooFundamentals.mockResolvedValue(FULL_FUNDAMENTALS);
        const result = await new YahooFundamentalProvider().getAnalystEstimates(
            SYMBOL
        );
        expect(result).toEqual({
            estimatedEpsAvg: 1.2,
            estimatedRevenueAvg: 3.4,
        });
    });

    /**
     * yahoo가 아예 제공하지 않는 항목들 — 클래스 JSDoc에 이유가 적혀 있다
     * (재무 건전성 점수는 분석 도메인 영역, peers/등급 변경 이벤트/섹터 퍼포먼스/
     * 롤링 목표주가는 yahoo 대응 엔드포인트가 없거나 시점이 안 맞음).
     * 항상 빈 값을 반환해 상위가 FMP와 동일한 "데이터 없음" 분기를 타게 한다.
     */
    it('제공하지 않는 항목은 항상 빈 값으로 degrade한다', async () => {
        const provider = new YahooFundamentalProvider();
        await expect(provider.getPriceTargetSummary()).resolves.toBeNull();
        await expect(provider.getFinancialScores()).resolves.toBeNull();
        await expect(provider.getStockPeers()).resolves.toEqual([]);
        await expect(provider.getStockPeersRaw()).resolves.toEqual([]);
        await expect(provider.getGrades()).resolves.toEqual([]);
        await expect(provider.getSectorPerformanceSnapshot()).resolves.toEqual(
            []
        );
        await expect(
            provider.getHistoricalSectorPerformance()
        ).resolves.toEqual([]);
    });

    it('getEarningsReport — 예정 실적이 없으면 null', async () => {
        getYahooFundamentals.mockResolvedValue({});
        const result = await new YahooFundamentalProvider().getEarningsReport(
            SYMBOL
        );
        expect(result).toBeNull();
    });
});

describe('YahooFundamentalProvider — 실적 일정', () => {
    beforeEach(() => {
        getYahooFundamentals.mockReset();
    });

    it('getEarningsReport는 symbol과 earningsDate를 각자 자리에 넣는다', async () => {
        getYahooFundamentals.mockResolvedValue(
            fundamentalsWithUpcoming({ estimated: false })
        );

        const report = await new YahooFundamentalProvider().getEarningsReport(
            SYMBOL
        );

        expect(report).toEqual({
            symbol: SYMBOL,
            earningsDate: '2026-10-08',
        });
    });

    it('rawPayload에 symbol·earningsDate를 싣고, 추정일이면 isEstimate를 붙인다', async () => {
        getYahooFundamentals.mockResolvedValue(
            fundamentalsWithUpcoming({ estimated: true })
        );

        const [item] = await new YahooFundamentalProvider().getEarningsReports(
            SYMBOL
        );

        expect(item!.rawPayload).toEqual({
            symbol: SYMBOL,
            earningsDate: '2026-10-08',
            isEstimate: true,
        });
    });

    it('확정 공시일이면 isEstimate를 붙이지 않는다', async () => {
        // 추정일을 확정처럼 렌더하면 안 된다 — 상위가 이 필드로 구분한다.
        getYahooFundamentals.mockResolvedValue(
            fundamentalsWithUpcoming({ estimated: false })
        );

        const [item] = await new YahooFundamentalProvider().getEarningsReports(
            SYMBOL
        );

        expect(item!.rawPayload).not.toHaveProperty('isEstimate');
    });
});
