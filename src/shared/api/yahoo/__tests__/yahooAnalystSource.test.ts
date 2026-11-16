import { beforeEach, describe, expect, it, vi } from 'vitest';

const { quoteSummary, getOrSetCache, isE2E } = vi.hoisted(() => ({
    quoteSummary: vi.fn(),
    getOrSetCache: vi.fn(),
    isE2E: vi.fn(),
}));
vi.mock('@/shared/api/yahoo/createYahooClient', () => ({
    getYahooClient: () => ({ quoteSummary }),
}));
vi.mock('@/shared/cache/getOrSetCache', () => ({ getOrSetCache }));
vi.mock('@/shared/api/e2eEnv', () => ({
    isE2EFakeMode: () => isE2E() && process.env.AGENT_REAL_PROVIDER !== '1',
}));

import {
    getYahooAnalystSummary,
    mapAnalystSummary,
    trimActionsForCache,
} from '@/shared/api/yahoo/yahooAnalystSource';
import { SECONDS_PER_HOUR } from '@/shared/config/time';

type Fetcher = () => Promise<unknown>;

const NOW = new Date('2026-11-15T12:00:00Z');

/** 2026-11-15에 받은 NVDA 응답 형태(Date 객체, 목표가 없음은 0, 지난 실적일, 지난 분기 콜 날짜). */
const RAW = {
    financialData: {
        targetMeanPrice: 276.56,
        targetMedianPrice: 280,
        targetHighPrice: 400,
        targetLowPrice: 150,
        numberOfAnalystOpinions: 53,
        currentPrice: 190.1,
    },
    recommendationTrend: {
        trend: [
            {
                period: '0m',
                strongBuy: 10,
                buy: 37,
                hold: 14,
                sell: 0,
                strongSell: 0,
            },
            {
                period: '-1m',
                strongBuy: 9,
                buy: 36,
                hold: 15,
                sell: 1,
                strongSell: 0,
            },
        ],
    },
    upgradeDowngradeHistory: {
        history: [
            {
                epochGradeDate: new Date('2026-11-13T21:32:15Z'),
                firm: 'Rosenblatt',
                toGrade: 'Buy',
                fromGrade: 'Buy',
                action: 'main',
                priceTargetAction: 'Lowers',
                currentPriceTarget: 300,
                priorPriceTarget: 390,
            },
            {
                epochGradeDate: new Date('2026-11-13T12:00:00Z'),
                firm: 'Craig-Hallum',
                toGrade: '',
                fromGrade: '',
                action: 'down',
                priceTargetAction: 'Announces',
                currentPriceTarget: 180,
                priorPriceTarget: 0,
            },
        ],
    },
    calendarEvents: {
        earnings: {
            earningsDate: [new Date('2026-11-17T21:00:00Z')],
            earningsCallDate: [new Date('2026-08-27T22:00:00Z')],
            isEarningsDateEstimate: false,
        },
    },
};

describe('mapAnalystSummary', () => {
    it('실제 응답 형태를 JSON 직렬화 가능한 DTO로 옮긴다(Date → ISO)', () => {
        const dto = mapAnalystSummary(RAW, true, NOW);
        expect(dto.targets).toEqual({
            mean: 276.56,
            median: 280,
            low: 150,
            high: 400,
            analysts: 53,
        });
        expect(dto.trend).toEqual({
            strongBuy: 10,
            buy: 37,
            hold: 14,
            sell: 0,
            strongSell: 0,
        });
        expect(dto.actions?.[0]).toEqual({
            dateIso: '2026-11-13T21:32:15.000Z',
            firm: 'Rosenblatt',
            fromGrade: 'Buy',
            toGrade: 'Buy',
            action: 'main',
            priceTargetAction: 'Lowers',
            priorPriceTarget: 390,
            currentPriceTarget: 300,
        });
        expect(dto.earnings).toEqual({
            dateIso: '2026-11-17T21:00:00.000Z',
            callDateIso: '2026-08-27T22:00:00.000Z',
            isEstimate: false,
        });
        expect(JSON.parse(JSON.stringify(dto))).toEqual(dto);
    });

    it('목표가 "없음"의 0은 변환하지 않고 그대로 둔다(해석은 엔티티 몫)', () => {
        expect(mapAnalystSummary(RAW, true, NOW).actions?.[1]).toMatchObject({
            priorPriceTarget: 0,
            fromGrade: '',
        });
    });

    it('includeActions=false면 actions는 null(요청하지 않음)이고 빈 이력은 []이다', () => {
        expect(mapAnalystSummary(RAW, false, NOW).actions).toBeNull();
        expect(
            mapAnalystSummary(
                { upgradeDowngradeHistory: { history: [] } },
                true,
                NOW
            ).actions
        ).toEqual([]);
    });

    it('trend는 period 0m 행만 쓴다(없으면 null)', () => {
        expect(
            mapAnalystSummary(
                {
                    recommendationTrend: {
                        trend: [{ period: '-1m', strongBuy: 1, buy: 1 }],
                    },
                },
                false,
                NOW
            ).trend
        ).toBeNull();
    });

    it('유한하지 않은 숫자·문자열 숫자·빈 배열·잘못된 타입은 null로 좁힌다', () => {
        const dto = mapAnalystSummary(
            {
                financialData: {
                    targetMeanPrice: NaN,
                    targetMedianPrice: '280',
                    targetHighPrice: Infinity,
                    numberOfAnalystOpinions: null,
                },
                calendarEvents: {
                    earnings: {
                        earningsDate: [],
                        earningsCallDate: 'x',
                        isEarningsDateEstimate: 'yes',
                    },
                },
            },
            true,
            NOW
        );
        expect(dto.targets).toEqual({
            mean: null,
            median: null,
            low: null,
            high: null,
            analysts: null,
        });
        expect(dto.earnings).toEqual({
            dateIso: null,
            callDateIso: null,
            isEstimate: null,
        });
    });

    it('응답이 비어도 던지지 않는다', () => {
        expect(mapAnalystSummary(undefined, true, NOW)).toEqual({
            targets: {
                mean: null,
                median: null,
                low: null,
                high: null,
                analysts: null,
            },
            trend: null,
            actions: [],
            earnings: null,
            estimates: [],
        });
    });
});

describe('getYahooAnalystSummary', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        isE2E.mockReturnValue(false);
        // 기본값은 거부 — 실수로 목을 빼먹은 호출이 네트워크로 새지 않는다.
        quoteSummary.mockRejectedValue(new Error('unexpected network call'));
        getOrSetCache.mockImplementation(
            async (_k: string, _t: number, fetcher: Fetcher) => fetcher()
        );
    });

    const callFor = (modulesIncludes: string) =>
        quoteSummary.mock.calls.find(([, opts]) =>
            (opts as { modules: string[] }).modules.includes(modulesIncludes)
        );

    it('E2E에서는 네트워크도 캐시도 건드리지 않고 null이다', async () => {
        isE2E.mockReturnValue(true);
        expect(
            await getYahooAnalystSummary('AAPL', { includeActions: true })
        ).toBeNull();
        expect(quoteSummary).not.toHaveBeenCalled();
        expect(getOrSetCache).not.toHaveBeenCalled();
    });

    it('E2E여도 AGENT_REAL_PROVIDER=1인 로컬 서버는 실제로 부른다', async () => {
        isE2E.mockReturnValue(true);
        vi.stubEnv('AGENT_REAL_PROVIDER', '1');
        quoteSummary.mockResolvedValue(RAW);
        expect(
            (await getYahooAnalystSummary('AAPL', { includeActions: true }))
                ?.targets.mean
        ).toBe(276.56);
        vi.unstubAllEnvs();
    });

    it('includeActions=true: 4개 모듈, Yahoo 심볼 변환, 1시간 캐시, a 키', async () => {
        quoteSummary.mockResolvedValue(RAW);
        const r = await getYahooAnalystSummary('brk.b', {
            includeActions: true,
        });
        expect(r?.targets.mean).toBe(276.56);
        const call = callFor('upgradeDowngradeHistory');
        expect(call?.[0]).toBe('BRK-B');
        expect((call?.[1] as { modules: string[] }).modules).toEqual([
            'financialData',
            'recommendationTrend',
            'calendarEvents',
            'upgradeDowngradeHistory',
        ]);
        expect(call?.[2]).toEqual({ validateResult: false });
        expect(getOrSetCache).toHaveBeenCalledWith(
            'yahoo:analyst-summary:v2:BRK.B:a',
            SECONDS_PER_HOUR,
            expect.any(Function)
        );
    });

    it('includeEstimates=true: earningsTrend 모듈을 더하고, 기존 키와 겹치지 않는 v3 …e 키를 쓴다', async () => {
        quoteSummary.mockResolvedValue(RAW);
        await getYahooAnalystSummary('NVDA', {
            includeActions: true,
            includeEstimates: true,
        });
        const call = callFor('earningsTrend');
        expect((call?.[1] as { modules: string[] }).modules).toContain(
            'earningsTrend'
        );
        expect(getOrSetCache).toHaveBeenCalledWith(
            'yahoo:analyst-summary:v3:NVDA:ae',
            SECONDS_PER_HOUR,
            expect.any(Function)
        );
    });

    it('includeActions=false: 변경 이력 모듈을 요청하지 않고 n 키를 쓴다', async () => {
        quoteSummary.mockResolvedValue(RAW);
        const r = await getYahooAnalystSummary('005930.KS', {
            includeActions: false,
        });
        expect(r?.actions).toBeNull();
        expect(callFor('upgradeDowngradeHistory')).toBeUndefined();
        expect(callFor('financialData')?.[0]).toBe('005930.KS');
        expect(getOrSetCache).toHaveBeenCalledWith(
            'yahoo:analyst-summary:v2:005930.KS:n',
            expect.anything(),
            expect.any(Function)
        );
    });

    it('"No fundamentals data found"(ETF)는 빈 요약으로 정상 캐시된다(null·실패 아님)', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        let cachedValue: unknown;
        getOrSetCache.mockImplementation(
            async (_k: string, _t: number, fetcher: Fetcher) => {
                cachedValue = await fetcher();
                return cachedValue;
            }
        );
        quoteSummary.mockRejectedValue(
            new Error('No fundamentals data found for symbol: SPY')
        );
        const r = await getYahooAnalystSummary('SPY', { includeActions: true });
        expect(r).toEqual({
            targets: {
                mean: null,
                median: null,
                low: null,
                high: null,
                analysts: null,
            },
            trend: null,
            actions: [],
            earnings: null,
            estimates: [],
        });
        expect(cachedValue).toEqual(r);
        expect(warn).not.toHaveBeenCalled();
        warn.mockRestore();
    });

    it.each([
        ['Quote not found for ticker symbol: ZZZZ', undefined],
        ['Quote not found for symbol: ZZZZ', undefined],
        ['No data found, symbol may be delisted', undefined],
        ['Not Found', 404],
    ])(
        '심볼을 서비스할 수 없다는 영구 응답(%s, code %s)은 빈 요약으로 캐시된다',
        async (message, code) => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            getOrSetCache.mockImplementation(
                async (_k: string, _t: number, fetcher: Fetcher) => fetcher()
            );
            const error = Object.assign(
                new Error(message),
                code === undefined ? {} : { code, name: 'HTTPError' }
            );
            quoteSummary.mockRejectedValue(error);
            const r = await getYahooAnalystSummary('ZZZZ', {
                includeActions: false,
            });
            expect(r).not.toBeNull();
            expect(r?.trend).toBeNull();
            expect(warn).not.toHaveBeenCalled();
            warn.mockRestore();
        }
    );

    it.each([
        [
            'HTTP 429',
            Object.assign(new Error('Too Many Requests'), {
                name: 'HTTPError',
                code: 429,
            }),
        ],
        [
            'HTTP 500',
            Object.assign(new Error('boom'), { name: 'HTTPError', code: 500 }),
        ],
        ['timeout', new Error('fetch failed')],
    ])('%s는 여전히 실패(null)다', async (_label, error) => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        getOrSetCache.mockImplementation(
            async (_k: string, _t: number, fetcher: Fetcher) => fetcher()
        );
        quoteSummary.mockRejectedValue(error);
        await expect(
            getYahooAnalystSummary('AAPL', { includeActions: false })
        ).resolves.toBeNull();
        warn.mockRestore();
    });

    it('빈 요약은 includeActions=false면 actions가 null이다', async () => {
        quoteSummary.mockRejectedValue(
            new Error('No fundamentals data found for symbol: SPY')
        );
        expect(
            (await getYahooAnalystSummary('SPY', { includeActions: false }))
                ?.actions
        ).toBeNull();
    });

    it('다른 오류(429 등)는 여전히 실패(null)이고 캐시되지 않는다', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        let threw = false;
        getOrSetCache.mockImplementation(
            async (_k: string, _t: number, fetcher: Fetcher) => {
                try {
                    return await fetcher();
                } catch (error) {
                    threw = true;
                    throw error;
                }
            }
        );
        quoteSummary.mockRejectedValue(new Error('Too Many Requests'));
        expect(
            await getYahooAnalystSummary('SPY', { includeActions: true })
        ).toBeNull();
        expect(threw).toBe(true);
        warn.mockRestore();
    });

    it('캐시 전에 변경 이력을 줄인다(오래된 행은 최신 15건까지만)', async () => {
        quoteSummary.mockResolvedValue({
            ...RAW,
            upgradeDowngradeHistory: { history: historyRows(980) },
        });
        const r = await getYahooAnalystSummary('NVDA', {
            includeActions: true,
        });
        expect(r!.actions!.length).toBeLessThan(980);
        expect(r!.actions![0]!.dateIso).toBe('2026-11-13T21:32:15.000Z');
    });

    it('실패는 캐시되지 않고(fetcher가 던진다) 경고 로그 후 null이다', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        let fetcherThrew = false;
        getOrSetCache.mockImplementation(
            async (_k: string, _t: number, fetcher: Fetcher) => {
                try {
                    return await fetcher();
                } catch (error) {
                    fetcherThrew = true;
                    throw error;
                }
            }
        );
        quoteSummary.mockRejectedValue(new Error('429'));
        expect(
            await getYahooAnalystSummary('AAPL', { includeActions: true })
        ).toBeNull();
        expect(fetcherThrew).toBe(true);
        expect(warn).toHaveBeenCalledWith(
            '[yahooAnalyst] summary failed',
            'AAPL',
            expect.any(Error)
        );
        warn.mockRestore();
    });
});

/** 실측 형태의 변경 이력 행(Date → 매핑 후 ISO)을 `n`개 만든다. 하루에 한 건씩 과거로 간다. */
function historyRows(n: number, endIso = '2026-11-13') {
    const end = Date.parse(`${endIso}T21:32:15Z`);
    return Array.from({ length: n }, (_, i) => ({
        epochGradeDate: new Date(end - i * 86_400_000),
        firm: `Firm ${i % 40} Securities`,
        toGrade: 'Sector Outperform',
        fromGrade: 'Equal-Weight',
        action: 'main',
        priceTargetAction: 'Lowers',
        currentPriceTarget: 174,
        priorPriceTarget: 346,
    }));
}

describe('trimActionsForCache', () => {
    const row = (dateIso: string | null) => ({
        dateIso,
        firm: 'X',
        fromGrade: null,
        toGrade: null,
        action: 'main',
        priceTargetAction: null,
        priorPriceTarget: null,
        currentPriceTarget: null,
    });
    const iso = (daysBeforeNow: number) =>
        new Date(NOW.getTime() - daysBeforeNow * 86_400_000).toISOString();

    it('최근 90일은 전부, 그보다 오래된 행은 최신 15건까지만 남긴다(최신순)', () => {
        const rows = Array.from({ length: 200 }, (_, i) => row(iso(i)));
        const kept = trimActionsForCache(rows, NOW);
        // 오늘(0)부터 90일 전(90)까지 91행이 90일 창, 15건 하한은 그 안에 든다.
        expect(kept).toHaveLength(91);
        expect(kept[0]!.dateIso).toBe(iso(0));
        expect(kept.at(-1)!.dateIso).toBe(iso(90));
    });

    it('90일 창이 15건보다 적으면 오래된 행으로 15건을 채운다', () => {
        const rows = [
            ...Array.from({ length: 3 }, (_, i) => row(iso(i))),
            ...Array.from({ length: 50 }, (_, i) => row(iso(200 + i))),
        ];
        const kept = trimActionsForCache(rows, NOW);
        expect(kept).toHaveLength(15);
        expect(kept.slice(0, 3).map(r => r.dateIso)).toEqual([
            iso(0),
            iso(1),
            iso(2),
        ]);
    });

    it('입력이 뒤섞여 있어도 최신순으로 자르고, 날짜 없는 행은 버린다', () => {
        const rows = [row(iso(300)), row(null), row(iso(1)), row(iso(0))];
        expect(trimActionsForCache(rows, NOW).map(r => r.dateIso)).toEqual([
            iso(0),
            iso(1),
            iso(300),
        ]);
    });

    it('90일 경계일(UTC 날짜 기준)은 포함하고 하루 더 오래된 행은 15건 밖이면 제외한다', () => {
        const rows = [
            ...Array.from({ length: 15 }, (_, i) => row(iso(i))),
            row('2026-08-17T00:00:00.000Z'), // 2026-11-15 − 90일 = 2026-08-17 → 포함
            row('2026-08-16T23:59:59.000Z'), // 하루 전 → 제외
        ];
        const kept = trimActionsForCache(rows, NOW).map(r => r.dateIso);
        expect(kept).toContain('2026-08-17T00:00:00.000Z');
        expect(kept).not.toContain('2026-08-16T23:59:59.000Z');
    });

    it('~980행 이력은 캐시 전에 줄어든다(JSON 크기 실측)', () => {
        const raw = {
            upgradeDowngradeHistory: { history: historyRows(980) },
        };
        const untrimmed = mapAnalystSummary(raw, true, new Date('2000-01-01'));
        const trimmed = mapAnalystSummary(raw, true, NOW);
        const before = JSON.stringify(untrimmed).length;
        const after = JSON.stringify(trimmed).length;
        // 하루 한 건이라 90일 창 = 91행. 실제 이력은 훨씬 성기지만 상한이 줄어듦을 보인다.
        expect(trimmed.actions!.length).toBeLessThan(untrimmed.actions!.length);
        expect(after).toBeLessThan(before / 5);
        // 2026-11-15 실측(이 픽스처): 212,529자 -> 19,403자.
    });
});

describe('mapAnalystSummary — earningsTrend', () => {
    /** 2026-11-16 NVDA 응답 모양(값 일부). `downLast7Days`만 대문자 D인 Yahoo 원문 키를 그대로 둔다. */
    const raw = {
        earningsTrend: {
            trend: [
                {
                    period: '0q',
                    endDate: new Date('2026-10-31T00:00:00Z'),
                    earningsEstimate: { avg: 2.47121, numberOfAnalysts: 43 },
                    revenueEstimate: {
                        avg: 108731903900,
                        numberOfAnalysts: 45,
                        growth: 0.90739995,
                    },
                    epsTrend: {
                        current: 2.47121,
                        '7daysAgo': 2.47325,
                        '30daysAgo': 2.47325,
                        '60daysAgo': 2.47269,
                        '90daysAgo': 2.35237,
                    },
                    epsRevisions: {
                        upLast7days: 0,
                        downLast7Days: 1,
                        upLast30days: 0,
                        downLast30days: 1,
                    },
                },
                { period: '-1q', earningsEstimate: { avg: 1 } },
                { period: '+1y', endDate: 'not-a-date' },
            ],
        },
    };

    it('이번·다음 분기·회계연도만 싣고 원문 키를 매핑한다', () => {
        const { estimates } = mapAnalystSummary(raw, false, NOW);
        expect(estimates.map(e => e.period)).toEqual(['0q', '+1y']);
        expect(estimates[0]).toEqual({
            period: '0q',
            endDate: '2026-10-31',
            epsAvg: 2.47121,
            epsAnalysts: 43,
            eps7dAgo: 2.47325,
            eps30dAgo: 2.47325,
            eps60dAgo: 2.47269,
            eps90dAgo: 2.35237,
            up7d: 0,
            down7d: 1,
            up30d: 0,
            down30d: 1,
            revenueAvg: 108731903900,
            revenueAnalysts: 45,
            revenueGrowth: 0.90739995,
        });
        expect(estimates[1]).toMatchObject({ endDate: null, epsAvg: null });
    });

    it('earningsTrend가 없으면 빈 배열', () => {
        expect(mapAnalystSummary({}, false, NOW).estimates).toEqual([]);
    });
});
