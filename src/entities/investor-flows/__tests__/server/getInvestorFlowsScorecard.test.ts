import { beforeEach, describe, expect, it, vi } from 'vitest';
import { evaluateInvestorFlows } from '@y0ngha/siglens-core';
import { getInvestorFlowsScorecard } from '../../server/getInvestorFlowsScorecard';
import { getOverallInvestorFlowsScorecard } from '../../server/getOverallInvestorFlowsScorecard';

vi.mock('server-only', () => ({}));

const { mockResilient, mockOptions, mockReadiness, mockKrCorp } = vi.hoisted(
    () => ({
        mockResilient: vi.fn(),
        mockOptions: vi.fn(),
        mockReadiness: vi.fn(),
        mockKrCorp: vi.fn(),
    })
);
vi.mock('../../server/getKrDartCorp', () => ({
    getKrDartCorp: mockKrCorp,
}));
vi.mock('../../server/getInvestorFlowsPipelineReadiness', () => ({
    getInvestorFlowsPipelineReadiness: mockReadiness,
}));
vi.mock('../../server/getInvestorFlowsResilient', () => ({
    getInvestorFlowsResilient: mockResilient,
}));
vi.mock('../../server/getInvestorFlowsEvaluationOptions', () => ({
    getInvestorFlowsEvaluationOptions: mockOptions,
}));

const READY = {
    institutional: 'ready',
    short: 'ready',
    failsToDeliver: 'ready',
    filings: 'ready',
    thresholdList: 'ready',
    dart: 'ready',
} as const;
const COLLECTING = {
    institutional: 'collecting',
    short: 'collecting',
    failsToDeliver: 'collecting',
    filings: 'collecting',
    thresholdList: 'collecting',
    dart: 'collecting',
} as const;
const UNKNOWN = {
    institutional: 'unknown',
    short: 'unknown',
    failsToDeliver: 'unknown',
    filings: 'unknown',
    thresholdList: 'unknown',
    dart: 'unknown',
} as const;
const OPTIONS_ON = {
    market: 'us',
    includeFinraData: true,
    includeExchangeLists: true,
} as const;
const KR_OPTIONS = {
    market: 'kr',
    includeFinraData: false,
    includeExchangeLists: false,
} as const;

/** 수급 신호가 나는 한국 스냅샷 — 5%를 새로 넘은 보고자 하나. */
const KR_SNAPSHOT = {
    asOf: '2026-10-16',
    market: 'kr',
    sharesOutstanding: null,
    floatShares: null,
    institutional: { quarters: [], topHolders: [], topHoldersPeriod: null },
    insider: { transactions: [] },
    largeHolders: null,
    shortInterest: null,
    shortVolume: null,
    failsToDeliver: null,
    thresholdList: null,
    kr: {
        majorHolders: [
            {
                receiptDate: '2026-10-14',
                reporter: '픽스처운용',
                reportForm: 'abbreviated',
                shares: 3e8,
                sharesChange: 3e8,
                ratioPct: 5.05,
                ratioChangePct: 5.05,
                reason: '신규',
                url: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261014000124',
            },
        ],
        insiders: [],
        tradingPlans: [],
    },
};

/** 기준일 전 30세션(주말 제외) — 최근 20세션 주가가 오른다. */
function squeezeContext() {
    const dates: string[] = [];
    let cursor = new Date('2026-10-16T00:00:00Z');
    while (dates.length < 30) {
        cursor = new Date(cursor.getTime() - 86_400_000);
        if (cursor.getUTCDay() % 6 !== 0)
            dates.unshift(cursor.toISOString().slice(0, 10));
    }
    return {
        dailyBars: dates.map((date, i) => ({
            date,
            close: 100 + i * 2,
            volume: 1e6,
        })),
    };
}

const SNAPSHOT = {
    asOf: '2026-10-16T00:00:00.000Z',
    sharesOutstanding: 1e9,
    floatShares: 9e8,
    institutional: { quarters: [], topHolders: [], topHoldersPeriod: null },
    insider: { transactions: [] },
    largeHolders: [],
    shortInterest: [
        {
            settlementDate: '2026-09-15',
            shortQty: 4e7,
            avgDailyVolume: 1e6,
            daysToCover: 40,
        },
    ],
    shortVolume: [],
};

describe('getInvestorFlowsScorecard', () => {
    beforeEach(() => {
        mockResilient.mockReset();
        mockReadiness.mockReset();
        mockReadiness.mockResolvedValue(READY);
        mockOptions.mockReset();
        mockOptions.mockResolvedValue(OPTIONS_ON);
        mockKrCorp.mockReset();
    });

    it('미국 종목은 market us이고 DART 회사 조회를 하지 않는다(krCompany null)', async () => {
        mockResilient.mockResolvedValue({
            snapshot: SNAPSHOT,
            degraded: false,
        });
        const result = await getInvestorFlowsScorecard('AAPL');
        expect(result.market).toBe('us');
        expect(result.krCompany).toBeNull();
        expect(mockKrCorp).not.toHaveBeenCalled();
    });

    it('한국 종목은 market kr, DART 점수표와 우선주 안내용 회사 정보를 싣는다', async () => {
        mockResilient.mockResolvedValue({
            snapshot: KR_SNAPSHOT,
            degraded: false,
        });
        mockOptions.mockResolvedValue(KR_OPTIONS);
        mockKrCorp.mockResolvedValue({
            corpCode: '00126380',
            corpName: '삼성전자',
            matchedStockCode: '005930',
            viaCommonShare: true,
        });
        const result = await getInvestorFlowsScorecard('005935.KS');
        expect(result.market).toBe('kr');
        expect(result.krCompany).toEqual({
            corpName: '삼성전자',
            viaCommonShare: true,
        });
        expect(mockKrCorp).toHaveBeenCalledWith('005935.KS');
        expect(result.scorecard?.market).toBe('kr');
        expect(result.scorecard?.largeHolders.signals[0]?.id).toBe(
            'kr_major_holder_new'
        );
        expect(result.finraEnabled).toBe(false);
    });

    it('한국 종목의 DART 매핑이 없으면 krCompany는 null이다', async () => {
        mockResilient.mockResolvedValue({ snapshot: null, degraded: false });
        mockOptions.mockResolvedValue(KR_OPTIONS);
        mockKrCorp.mockResolvedValue(null);
        const result = await getInvestorFlowsScorecard('999990.KS');
        expect(result.krCompany).toBeNull();
        expect(result.scorecard).toBeNull();
    });

    it('스냅샷이 있으면 core evaluateInvestorFlows 결과를 그대로 돌려준다', async () => {
        mockResilient.mockResolvedValue({
            snapshot: SNAPSHOT,
            degraded: false,
        });
        const result = await getInvestorFlowsScorecard('AAPL');
        expect(result.scorecard).toEqual(
            evaluateInvestorFlows(SNAPSHOT as never, OPTIONS_ON)
        );
        expect(result).toMatchObject({
            degraded: false,
            finraEnabled: true,
            regShoEnabled: true,
        });
        expect(mockOptions).toHaveBeenCalledWith('AAPL');
    });

    it('평가 옵션의 숏스퀴즈 일봉을 넘겨 점수표에 숏스퀴즈 점수가 실린다', async () => {
        mockResilient.mockResolvedValue({
            snapshot: SNAPSHOT,
            degraded: false,
        });
        const options = { ...OPTIONS_ON, squeezeContext: squeezeContext() };
        mockOptions.mockResolvedValue(options);
        const result = await getInvestorFlowsScorecard('AAPL');
        expect(result.scorecard?.squeezeRisk).not.toBeNull();
        expect(result.scorecard).toEqual(
            evaluateInvestorFlows(SNAPSHOT as never, options)
        );
    });

    it('Reg SHO 플래그가 꺼지면 regShoEnabled: false이고 includeExchangeLists: false로 점수를 낸다', async () => {
        mockResilient.mockResolvedValue({
            snapshot: {
                ...SNAPSHOT,
                thresholdList: {
                    listed: true,
                    consecutiveDays: 20,
                    firstListedDate: '2026-09-15',
                    markets: ['Nasdaq'],
                    asOf: '2026-10-15',
                },
            },
            degraded: false,
        });
        mockOptions.mockResolvedValue({
            market: 'us',
            includeFinraData: true,
            includeExchangeLists: false,
        });
        const result = await getInvestorFlowsScorecard('AAPL');
        expect(result.regShoEnabled).toBe(false);
        expect(result.scorecard?.short.metrics.thresholdListed).toBeNull();
    });

    it('FINRA 플래그가 꺼져 있으면 includeFinraData: false로 점수를 낸다(옛 캐시 스냅샷이 섞이지 않는다)', async () => {
        mockOptions.mockResolvedValue({
            market: 'us',
            includeFinraData: false,
            includeExchangeLists: true,
        });
        mockResilient.mockResolvedValue({
            snapshot: SNAPSHOT,
            degraded: false,
        });
        const result = await getInvestorFlowsScorecard('AAPL');
        expect(result.finraEnabled).toBe(false);
        expect(result.scorecard?.short.sufficiency).toBe('insufficient');
    });

    it('데이터 없음(null)은 scorecard도 null, degraded는 false다', async () => {
        mockResilient.mockResolvedValue({ snapshot: null, degraded: false });
        expect(await getInvestorFlowsScorecard('ZZZZ')).toMatchObject({
            snapshot: null,
            scorecard: null,
            degraded: false,
        });
    });

    it('인프라 장애는 degraded: true로 전달한다', async () => {
        mockResilient.mockResolvedValue({ snapshot: null, degraded: true });
        expect(await getInvestorFlowsScorecard('AAPL')).toMatchObject({
            scorecard: null,
            degraded: true,
        });
    });

    it('파이프라인 준비 상태를 그대로 실어 보낸다(데이터가 있는 구간은 수집 중이어도 점수표·스냅샷이 그대로)', async () => {
        mockResilient.mockResolvedValue({
            snapshot: SNAPSHOT,
            degraded: false,
        });
        mockReadiness.mockResolvedValue({ ...READY, short: 'collecting' });
        const result = await getInvestorFlowsScorecard('AAPL');
        expect(result.readiness).toEqual({ ...READY, short: 'collecting' });
        expect(result.snapshot).toBe(SNAPSHOT);
        expect(result.scorecard).toEqual(
            evaluateInvestorFlows(SNAPSHOT as never, OPTIONS_ON)
        );
    });

    it('수집 중인 빈 구간은 AI 경로와 같이 가려 채점한다(원본 스냅샷은 그대로 돌려준다)', async () => {
        const empty = { ...SNAPSHOT, shortInterest: [], failsToDeliver: [] };
        mockResilient.mockResolvedValue({ snapshot: empty, degraded: false });
        mockReadiness.mockResolvedValue(COLLECTING);
        const result = await getInvestorFlowsScorecard('AAPL');
        expect(result.snapshot).toBe(empty);
        expect(result.scorecard).toEqual(
            evaluateInvestorFlows(
                {
                    ...empty,
                    shortInterest: null,
                    shortVolume: null,
                    failsToDeliver: null,
                } as never,
                OPTIONS_ON
            )
        );
    });
});

describe('getOverallInvestorFlowsScorecard', () => {
    beforeEach(() => {
        mockResilient.mockReset();
        mockReadiness.mockReset();
        mockReadiness.mockResolvedValue(READY);
        mockOptions.mockReset();
        mockOptions.mockResolvedValue(OPTIONS_ON);
    });

    it('크립토는 조회도 하지 않고 undefined다(종합에 넣지 않음 — 캐시 키 불변)', async () => {
        expect(
            await getOverallInvestorFlowsScorecard('BTCUSD', 'crypto')
        ).toBeUndefined();
        expect(mockResilient).not.toHaveBeenCalled();
    });

    it('한국 주식도 DART 점수표를 종합에 넣는다', async () => {
        mockResilient.mockResolvedValue({
            snapshot: KR_SNAPSHOT,
            degraded: false,
        });
        mockOptions.mockResolvedValue(KR_OPTIONS);
        mockKrCorp.mockResolvedValue(null);
        const result = await getOverallInvestorFlowsScorecard(
            '005930.KS',
            'kr-equity'
        );
        expect(result?.market).toBe('kr');
    });

    it('한국 주식은 DART 백필 중일 때만 스냅샷 없음을 undefined로 돌린다(13F 수집 중은 영향 없음)', async () => {
        mockResilient.mockResolvedValue({ snapshot: null, degraded: false });
        mockOptions.mockResolvedValue(KR_OPTIONS);
        mockKrCorp.mockResolvedValue(null);
        mockReadiness.mockResolvedValue({ ...COLLECTING, dart: 'ready' });
        expect(
            await getOverallInvestorFlowsScorecard('005930.KS', 'kr-equity')
        ).toBeNull();
        mockReadiness.mockResolvedValue({ ...READY, dart: 'collecting' });
        expect(
            await getOverallInvestorFlowsScorecard('005930.KS', 'kr-equity')
        ).toBeUndefined();
    });

    it('미국 주식은 DART 백필 중이어도 데이터 없음을 null로 둔다', async () => {
        mockResilient.mockResolvedValue({ snapshot: null, degraded: false });
        mockReadiness.mockResolvedValue({ ...READY, dart: 'collecting' });
        expect(
            await getOverallInvestorFlowsScorecard('ZZZZ', 'us-equity')
        ).toBeNull();
    });

    it('미국 주식 + 점수표는 그대로 돌려준다', async () => {
        mockResilient.mockResolvedValue({
            snapshot: SNAPSHOT,
            degraded: false,
        });
        const result = await getOverallInvestorFlowsScorecard(
            'AAPL',
            'us-equity'
        );
        expect(result?.composite).toBeDefined();
    });

    it('미국 주식 + 데이터 없음은 null이다(프롬프트가 "데이터 없음"을 명시)', async () => {
        mockResilient.mockResolvedValue({ snapshot: null, degraded: false });
        expect(
            await getOverallInvestorFlowsScorecard('ZZZZ', 'us-equity')
        ).toBeNull();
    });

    it('인프라 장애는 undefined다(장애가 "데이터 없음"으로 캐시에 굳지 않는다)', async () => {
        mockResilient.mockResolvedValue({ snapshot: null, degraded: true });
        expect(
            await getOverallInvestorFlowsScorecard('AAPL', 'us-equity')
        ).toBeUndefined();
    });

    it('13F 수집 중에는 스냅샷이 없어도 null이 아니라 undefined다("아직 못 모음"이 "데이터 없음"으로 캐시에 굳지 않는다)', async () => {
        mockResilient.mockResolvedValue({ snapshot: null, degraded: false });
        mockReadiness.mockResolvedValue(COLLECTING);
        expect(
            await getOverallInvestorFlowsScorecard('ZZZZ', 'us-equity')
        ).toBeUndefined();
    });

    it('준비 상태를 못 읽거나(unknown) 공매도만 수집 중이면 예전처럼 null이다', async () => {
        mockResilient.mockResolvedValue({ snapshot: null, degraded: false });
        mockReadiness.mockResolvedValue(UNKNOWN);
        expect(
            await getOverallInvestorFlowsScorecard('ZZZZ', 'us-equity')
        ).toBeNull();
        mockReadiness.mockResolvedValue({ ...READY, short: 'collecting' });
        expect(
            await getOverallInvestorFlowsScorecard('ZZZZ', 'us-equity')
        ).toBeNull();
    });

    it('13F 수집 중이어도 스냅샷이 있으면 점수표를 그대로 돌려준다', async () => {
        mockResilient.mockResolvedValue({
            snapshot: SNAPSHOT,
            degraded: false,
        });
        mockReadiness.mockResolvedValue(COLLECTING);
        const result = await getOverallInvestorFlowsScorecard(
            'AAPL',
            'us-equity'
        );
        expect(result?.composite).toBeDefined();
    });

    it('예외가 나도 던지지 않고 undefined다', async () => {
        const warn = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => undefined);
        mockResilient.mockRejectedValue(new Error('boom'));
        expect(
            await getOverallInvestorFlowsScorecard('AAPL', 'us-equity')
        ).toBeUndefined();
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });
});
