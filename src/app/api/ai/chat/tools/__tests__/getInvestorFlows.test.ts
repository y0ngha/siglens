import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { isTabAllowed, loadScorecard } = vi.hoisted(() => ({
    isTabAllowed: vi.fn(),
    loadScorecard: vi.fn(),
}));
vi.mock('@/entities/ticker/api', () => ({
    isTabAllowedForSymbol: isTabAllowed,
}));
vi.mock('@/entities/investor-flows/server/getInvestorFlowsScorecard', () => ({
    getInvestorFlowsScorecard: loadScorecard,
}));

import { getInvestorFlowsTool } from '@/app/api/ai/chat/tools/getInvestorFlows';
import { AGGREGATE_RESULT_MAX_CHARS } from '@/app/api/ai/chat/tools/truncate';
import {
    SUMMARY_MAX_INSIDER_TRANSACTIONS,
    SUMMARY_MAX_LARGE_HOLDERS,
    SUMMARY_MAX_SIGNALS,
    SUMMARY_MAX_TOP_HOLDERS,
    type InvestorFlowsSummary,
} from '@/entities/investor-flows/lib/summarizeInvestorFlows';
import {
    evaluate,
    makeHolder,
    makeLargeHolder,
    makeSnapshot,
    makeTransaction,
} from '@/widgets/investor-flows/__tests__/fixtures/flowsFixtures';

const ctx = {
    userId: 'u',
    tier: 'member' as const,
    locale: 'ko' as const,
    signal: new AbortController().signal,
};
const rt = {
    analysisModel: 'deepseek-v4.1-flash' as const,
    ensureSymbolData: async (): Promise<void> => {},
};

type ToolOutput = InvestorFlowsSummary & {
    asOf: string;
    source: string;
    symbol: string;
    available: true;
    noData: false;
};

const READY = { institutional: 'ready', short: 'ready' } as const;

function arrange(
    snapshot: ReturnType<typeof makeSnapshot>,
    finra = true,
    readiness: {
        institutional: 'ready' | 'collecting' | 'unknown';
        short: 'ready' | 'collecting' | 'unknown';
    } = READY
) {
    loadScorecard.mockResolvedValue({
        snapshot,
        scorecard: evaluate(snapshot, finra),
        degraded: false,
        finraEnabled: finra,
        readiness,
    });
}

describe('getInvestorFlowsTool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        isTabAllowed.mockResolvedValue(true);
    });

    it('수급 탭이 없는 심볼(KR·크립토)은 조회 없이 available:false', async () => {
        isTabAllowed.mockResolvedValue(false);
        expect(
            await getInvestorFlowsTool({ symbol: '005930.KS' }, ctx, rt)
        ).toEqual({
            symbol: '005930.KS',
            available: false,
            reason: 'tab_not_available',
        });
        expect(isTabAllowed).toHaveBeenCalledWith('005930.KS', 'flows');
        expect(loadScorecard).not.toHaveBeenCalled();
    });

    it('인프라 장애는 provider_failed로 알린다(데이터 없음과 구분)', async () => {
        loadScorecard.mockResolvedValue({
            snapshot: null,
            scorecard: null,
            degraded: true,
            finraEnabled: true,
            readiness: READY,
        });
        expect(await getInvestorFlowsTool({ symbol: 'aapl' }, ctx, rt)).toEqual(
            { symbol: 'AAPL', available: false, reason: 'provider_failed' }
        );
    });

    it('정상적인 데이터 없음은 available:true + noData:true이고 점수표 필드는 없다', async () => {
        loadScorecard.mockResolvedValue({
            snapshot: null,
            scorecard: null,
            degraded: false,
            finraEnabled: true,
            readiness: READY,
        });
        const result = (await getInvestorFlowsTool(
            { symbol: 'ZZZZ' },
            ctx,
            rt
        )) as Record<string, unknown>;
        expect(result).toMatchObject({
            symbol: 'ZZZZ',
            available: true,
            noData: true,
        });
        expect(Object.keys(result).toSorted()).toEqual([
            'asOf',
            'available',
            'noData',
            'source',
            'symbol',
        ]);
    });

    it('픽스처 스냅샷의 정확한 값을 요약한다', async () => {
        const snapshot = makeSnapshot();
        arrange(snapshot);
        const result = (await getInvestorFlowsTool(
            { symbol: 'AAPL' },
            ctx,
            rt
        )) as ToolOutput;

        expect(result.symbol).toBe('AAPL');
        expect(result.asOf).toBe(snapshot.asOf);
        expect(result.freshness.institutionalPeriod).toBe('2026-06-30');
        expect(result.freshness.latestInstitutionalPeriodComplete).toBe(false);
        expect(
            result.institutional.quarters.map(q => [q.period, q.netFlow])
        ).toEqual([
            ['2026-09-30', 'IN'],
            ['2026-06-30', 'IN'],
        ]);
        expect(result.institutional.topHolders.map(h => h.change)).toEqual([
            'increased',
            'decreased',
            'new',
            'exited',
        ]);
        expect(result.institutional.topHolders[0]).toEqual({
            name: 'Fixture Index Advisors',
            shares: 1_300_000_000,
            changePct: 1.6,
            change: 'increased',
        });
        expect(result.insider.recentTransactions).toHaveLength(6);
        expect(result.insider.recentTransactions[0]).toEqual({
            date: '2026-10-10',
            name: 'Fixture Director A',
            role: 'director',
            type: 'buy',
            valueUsd: 840_000,
        });
        expect(result.largeHolders).toEqual([
            {
                filingDate: '2026-09-01',
                filer: 'Fixture Activist Partners',
                form: 'SC 13D/A',
                percentOfClass: 5.4,
            },
        ]);
        const scorecard = evaluate(snapshot);
        expect(result.composite).toEqual(scorecard.composite);
        expect(result.short?.interest).toEqual({
            settlementDate: '2026-09-15',
            shortQty: 128_000_000,
            pctOfFloat: scorecard.short.metrics.shortInterestPctFloat,
            daysToCover: scorecard.short.metrics.daysToCover,
            changeVsPrevious: {
                previousDate: '2026-08-15',
                sharesChange: 6_000_000,
                pct: (6_000_000 / 122_000_000) * 100,
            },
            recentChangePct: scorecard.short.metrics.shortInterestChangePct,
            trend: scorecard.short.metrics.shortInterestTrend,
        });
        expect(result.short?.offExchangeVolume?.shortRatio).toBe(
            scorecard.short.metrics.shortVolumeRatio
        );
    });

    it('FINRA 켜짐이면 출처에 FINRA를 밝힌다', async () => {
        arrange(makeSnapshot());
        const result = (await getInvestorFlowsTool(
            { symbol: 'AAPL' },
            ctx,
            rt
        )) as ToolOutput;
        expect(result.source).toContain('FINRA');
    });

    it('FINRA 꺼짐이면 short가 null, 공매도 축은 insufficient, 출처에서 FINRA를 뺀다', async () => {
        arrange(
            makeSnapshot({ shortInterest: null, shortVolume: null }),
            false
        );
        const result = (await getInvestorFlowsTool(
            { symbol: 'AAPL' },
            ctx,
            rt
        )) as ToolOutput;
        expect(result.short).toBeNull();
        expect(result.axes.short.sufficiency).toBe('insufficient');
        expect(result.source).not.toContain('FINRA');
        expect(result.source).toContain('13F');
    });

    describe('크기 예산', () => {
        /** 실제 Fake(보유 기관 6·내부자 7·13D/G 2)보다 무거운 최악 입력: 상한을 넘는 개수, 긴 이름·직무, 전 축 신호. */
        function heavySnapshot() {
            const base = makeSnapshot();
            return makeSnapshot({
                institutional: {
                    quarters: base.institutional.quarters,
                    topHolders: Array.from({ length: 30 }, (_, i) =>
                        makeHolder({
                            cik: String(i),
                            filerName:
                                'Very Long Institutional Filer Name '.repeat(4),
                            shares: 1_234_567_890 + i,
                            prevShares: 1_000_000_000 + i,
                        })
                    ),
                    topHoldersPeriod: '2026-06-30',
                },
                insider: {
                    transactions: Array.from({ length: 40 }, (_, i) =>
                        makeTransaction({
                            date: `2026-09-${String((i % 28) + 1).padStart(2, '0')}`,
                            name: 'Insider With A Very Long Legal Name Indeed',
                            role: 'officer: Chief Executive Officer and Chairman',
                            type: i % 3 === 0 ? 'sell' : 'buy',
                            value: 152_000_000_000 + i,
                        })
                    ),
                },
                largeHolders: Array.from({ length: 10 }, (_, i) =>
                    makeLargeHolder({
                        filingDate: `2026-0${(i % 9) + 1}-01`,
                        filer: 'Large Holder Filer With A Very Long Name '.repeat(
                            2
                        ),
                        form: 'SC 13D/A',
                        percentOfClass: 5.5 + i,
                    })
                ),
                shortInterest: [0, 1, 2, 3, 4, 5].map(i => ({
                    settlementDate: `2026-0${4 + i}-15`,
                    shortQty: 2_100_000_000 + 160_000_000 * i,
                    avgDailyVolume: 380_000_000,
                    daysToCover: 5.5 + i * 0.3,
                })),
            });
        }

        it('상한만큼만 싣는다', async () => {
            arrange(heavySnapshot());
            const result = (await getInvestorFlowsTool(
                { symbol: 'AAPL' },
                ctx,
                rt
            )) as ToolOutput;
            expect(result.institutional.topHolders).toHaveLength(
                SUMMARY_MAX_TOP_HOLDERS
            );
            expect(result.insider.recentTransactions).toHaveLength(
                SUMMARY_MAX_INSIDER_TRANSACTIONS
            );
            expect(result.largeHolders).toHaveLength(SUMMARY_MAX_LARGE_HOLDERS);
            expect(result.signals).toHaveLength(SUMMARY_MAX_SIGNALS);
        });

        it('봉투를 포함한 도구 출력 전체가 6,000자 상한 안에 여유(600자 이상)를 두고 들어간다', async () => {
            arrange(heavySnapshot());
            const result = await getInvestorFlowsTool(
                { symbol: 'AAPL' },
                ctx,
                rt
            );
            const length = JSON.stringify(result).length;
            expect(length).toBeLessThanOrEqual(
                AGGREGATE_RESULT_MAX_CHARS - 600
            );
        });

        it('수집 중 경로(dataStatus+안내 문구 포함)도 같은 600자 여유를 지킨다 — 비어 있는 갈래가 늘어난 만큼 본문이 줄어도 안내가 예산을 먹지 않는다', async () => {
            const heavy = heavySnapshot();
            arrange(
                {
                    ...heavy,
                    institutional: {
                        quarters: [],
                        topHolders: [],
                        topHoldersPeriod: null,
                    },
                    shortInterest: [],
                    shortVolume: [],
                },
                true,
                { institutional: 'collecting', short: 'collecting' }
            );
            const result = (await getInvestorFlowsTool(
                { symbol: 'AAPL' },
                ctx,
                rt
            )) as { dataStatus?: unknown };
            expect(result.dataStatus).toBeDefined();
            expect(JSON.stringify(result).length).toBeLessThanOrEqual(
                AGGREGATE_RESULT_MAX_CHARS - 600
            );
        });
    });

    describe('수집 파이프라인 상태(dataStatus)', () => {
        it('수집이 끝난 정상 상태에서는 dataStatus 키가 없다(응답 크기·예전 응답 불변)', async () => {
            arrange(makeSnapshot());
            const result = (await getInvestorFlowsTool(
                { symbol: 'AAPL' },
                ctx,
                rt
            )) as Record<string, unknown>;
            expect('dataStatus' in result).toBe(false);
        });

        it('수집 중이면 collecting과 "못 모은 것이지 활동 없음이 아니다"는 안내를 붙인다', async () => {
            const snapshot = makeSnapshot({
                institutional: {
                    quarters: [],
                    topHolders: [],
                    topHoldersPeriod: null,
                },
                shortInterest: [],
                shortVolume: [],
            });
            arrange(snapshot, true, {
                institutional: 'collecting',
                short: 'collecting',
            });
            const result = (await getInvestorFlowsTool(
                { symbol: 'AAPL' },
                ctx,
                rt
            )) as ToolOutput & {
                dataStatus: {
                    institutional: string;
                    short: string;
                    note: string;
                };
            };
            expect(result.dataStatus).toMatchObject({
                institutional: 'collecting',
                short: 'collecting',
            });
            expect(result.dataStatus.note).toMatch(/not collected yet/);
            expect(result.axes.institutional.sufficiency).toBe('insufficient');
        });

        it('공매도 수집 중이면 빈 배열이 아니라 short:null("조회 불가")로 요약한다', async () => {
            arrange(
                makeSnapshot({ shortInterest: [], shortVolume: [] }),
                true,
                {
                    institutional: 'ready',
                    short: 'collecting',
                }
            );
            const result = (await getInvestorFlowsTool(
                { symbol: 'AAPL' },
                ctx,
                rt
            )) as ToolOutput;
            expect(result.short).toBeNull();
        });

        it('공매도 데이터가 이미 있으면 수집 중 표시여도 가리지 않는다', async () => {
            arrange(makeSnapshot(), true, {
                institutional: 'ready',
                short: 'collecting',
            });
            const result = (await getInvestorFlowsTool(
                { symbol: 'AAPL' },
                ctx,
                rt
            )) as ToolOutput;
            expect(result.short?.interest).not.toBeNull();
            // the tool agrees with the UI: a populated arm is never labelled collecting
            expect('dataStatus' in result).toBe(false);
        });

        it('비어 있는 갈래만 알린다: 13F는 데이터가 있고 공매도만 비었으면 short만 collecting이다(unknown 13F도 생략)', async () => {
            arrange(
                makeSnapshot({ shortInterest: [], shortVolume: [] }),
                true,
                {
                    institutional: 'collecting',
                    short: 'collecting',
                }
            );
            const result = (await getInvestorFlowsTool(
                { symbol: 'AAPL' },
                ctx,
                rt
            )) as ToolOutput & { dataStatus: Record<string, string> };
            expect(Object.keys(result.dataStatus).toSorted()).toEqual([
                'note',
                'short',
            ]);
            expect(result.dataStatus.short).toBe('collecting');
        });

        it('상태를 전혀 못 읽었으면(unknown 둘) 예전 응답과 같다', async () => {
            arrange(makeSnapshot(), true, {
                institutional: 'unknown',
                short: 'unknown',
            });
            const result = (await getInvestorFlowsTool(
                { symbol: 'AAPL' },
                ctx,
                rt
            )) as Record<string, unknown>;
            expect('dataStatus' in result).toBe(false);
        });

        it('데이터 없음 응답에도 dataStatus가 실린다(수집 중이면 "없음"이 아니라 "수집 중"임을 알 수 있다)', async () => {
            loadScorecard.mockResolvedValue({
                snapshot: null,
                scorecard: null,
                degraded: false,
                finraEnabled: true,
                readiness: { institutional: 'collecting', short: 'collecting' },
            });
            const result = (await getInvestorFlowsTool(
                { symbol: 'ZZZZ' },
                ctx,
                rt
            )) as { noData: boolean; dataStatus: { institutional: string } };
            expect(result.noData).toBe(true);
            expect(result.dataStatus.institutional).toBe('collecting');
        });
    });
});
