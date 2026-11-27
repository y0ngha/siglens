vi.mock('server-only', () => ({}));

import {
    detectNewConfirmedSignals,
    type Bar,
    type FearGreedReading,
} from '@y0ngha/siglens-core';
import { MAIL_ALERT_CHANGE_SIGNAL_TYPES } from '@/entities/mail-alert/lib/mailAlertConstants';
import {
    checkSignalReadiness,
    COMPUTE_CONCURRENCY,
    expectedSessions,
    loadComputedSources,
    loadEpisodes,
    loadFearGreedSources,
    type AlertSourceDeps,
    type ExpectedSessions,
} from '../collectAlertSources';

const SECONDS_PER_DAY = 86_400;

function isoOf(index: number): string {
    return new Date(Date.UTC(2026, 0, 1) + index * SECONDS_PER_DAY * 1000)
        .toISOString()
        .slice(0, 10);
}

/** 평평한 일봉 `count`개 — 날짜는 2026-01-01부터 하루씩. */
function flatBars(count: number, close = 100): Bar[] {
    return Array.from({ length: count }, (_, i) => ({
        time: Date.UTC(2026, 0, 1) / 1000 + i * SECONDS_PER_DAY,
        open: close,
        high: close,
        low: close,
        close,
        volume: 1000,
    }));
}

/** 마지막 봉이 장기 횡보를 뚫고 올라 52주 신고가를 새로 여는 봉 열. */
function breakoutBars(count: number): Bar[] {
    const flat = flatBars(count - 1);
    const last = flat.at(-1);
    return [
        ...flat,
        {
            time: (last?.time ?? 0) + SECONDS_PER_DAY,
            open: 100,
            high: 130,
            low: 100,
            close: 130,
            volume: 5000,
        },
    ];
}

const EXPECTED: ExpectedSessions = {
    signals: { us: '2026-11-24', kr: '2026-11-25' },
    fearGreed: { us: '2026-11-23', kr: '2026-11-25', crypto: '2026-11-24' },
};

function deps(overrides: Partial<AlertSourceDeps> = {}): AlertSourceDeps {
    return {
        signalHistory: {
            latestRecordedSession: vi.fn().mockResolvedValue(null),
            findEpisodesStartedOn: vi.fn().mockResolvedValue([]),
        },
        loadFearGreedHistory: vi.fn().mockResolvedValue([]),
        loadDailyBars: vi.fn().mockResolvedValue([]),
        ...overrides,
    };
}

describe('expectedSessions', () => {
    it('미국 신호는 마감 + 정착 15분, 한국은 35분 뒤부터 그날 세션이다', () => {
        // 월요일 16:00 ET = 21:00Z 마감. 정착 15분이 지난 21:20Z부터 그날 세션이다.
        const afterSettle = expectedSessions(new Date('2026-11-23T21:20:00Z'));
        const beforeSettle = expectedSessions(new Date('2026-11-23T21:10:00Z'));

        expect(afterSettle.signals.us).toBe('2026-11-23');
        expect(beforeSettle.signals.us).toBe('2026-11-20');
    });

    it('한국 신호·공포탐욕은 마감 15:30 KST + 35분 뒤에 그날 세션이다', () => {
        // 2026-11-24 화 16:10 KST = 07:10Z
        expect(
            expectedSessions(new Date('2026-11-24T07:10:00Z')).signals.kr
        ).toBe('2026-11-24');
        expect(
            expectedSessions(new Date('2026-11-24T06:50:00Z')).signals.kr
        ).toBe('2026-11-23');
        expect(
            expectedSessions(new Date('2026-11-24T07:10:00Z')).fearGreed.kr
        ).toBe('2026-11-24');
    });

    it('미국 공포탐욕은 발행 버퍼(4시간)를 따라 신호보다 한 세션 늦다', () => {
        // 화 07:05 KST(= 월 22:05Z): 신호는 월요일 세션, 공포탐욕 판독은 아직 직전 금요일까지
        const now = new Date('2026-11-23T22:05:00Z');
        const sessions = expectedSessions(now);

        expect(sessions.signals.us).toBe('2026-11-23');
        expect(sessions.fearGreed.us).toBe('2026-11-20');
    });

    it('크립토 공포탐욕은 어제(UTC)다', () => {
        expect(
            expectedSessions(new Date('2026-11-24T22:05:00Z')).fearGreed.crypto
        ).toBe('2026-11-23');
    });
});

describe('공포탐욕 진입일과 발송일의 간격', () => {
    /**
     * 항목이 처음 "기대 세션"이 되는 07:05 KST 알림 날짜(KST 날짜)를 찾는다. 진입일은 그 시장의 세션 날짜다.
     * 카드의 안내 문구("점수가 확정된 뒤 한국 시간 아침")가 이 간격에 기대므로 값을 고정한다.
     */
    function firstSendDate(
        market: 'us' | 'kr' | 'crypto',
        entryDate: string
    ): string | null {
        const base = Date.parse(`${entryDate}T00:00:00Z`);
        const days = Array.from({ length: 6 }, (_, i) => i);
        // 07:05 KST = 전날 22:05Z
        const found = days
            .map(
                i =>
                    new Date(
                        base + i * 86_400_000 + 22 * 3_600_000 + 5 * 60_000
                    )
            )
            .find(now => expectedSessions(now).fearGreed[market] === entryDate);
        return found === undefined
            ? null
            : new Date(found.getTime() + 9 * 3_600_000)
                  .toISOString()
                  .slice(0, 10);
    }

    it('미국은 진입일 + 2일, 한국은 + 1일, 크립토는 + 2일 아침(평일)이다', () => {
        // 화요일 세션 기준
        expect(firstSendDate('us', '2026-11-24')).toBe('2026-11-26');
        expect(firstSendDate('kr', '2026-11-24')).toBe('2026-11-25');
        expect(firstSendDate('crypto', '2026-11-24')).toBe('2026-11-26');
    });
});

describe('checkSignalReadiness', () => {
    it('기록기가 기대 세션 이상까지 남긴 시장만 준비됐다', async () => {
        const latest = vi.fn(async (market: 'us' | 'kr') =>
            market === 'us' ? '2026-11-24' : '2026-11-24'
        );
        const result = await checkSignalReadiness(
            deps({
                signalHistory: {
                    latestRecordedSession: latest,
                    findEpisodesStartedOn: vi.fn(),
                },
            }),
            EXPECTED
        );

        expect(result).toEqual({ us: true, kr: false });
    });

    it('기록이 전혀 없으면(null) 준비되지 않았다', async () => {
        await expect(checkSignalReadiness(deps(), EXPECTED)).resolves.toEqual({
            us: false,
            kr: false,
        });
    });

    it('기대 세션보다 앞선 기록도 준비로 본다(이어진 에피소드가 올린 마지막 포착일)', async () => {
        const result = await checkSignalReadiness(
            deps({
                signalHistory: {
                    latestRecordedSession: vi
                        .fn()
                        .mockResolvedValue('2026-12-01'),
                    findEpisodesStartedOn: vi.fn(),
                },
            }),
            EXPECTED
        );

        expect(result).toEqual({ us: true, kr: true });
    });
});

describe('loadEpisodes', () => {
    it('알림 유형만 남기고 이름·변동률을 옮긴다', async () => {
        const findEpisodesStartedOn = vi.fn().mockResolvedValue([
            {
                symbol: 'AAPL',
                signalType: 'golden_cross',
                changePercent: 2,
                koreanName: null,
            },
            {
                symbol: 'XYZ',
                signalType: 'cci_oversold',
                changePercent: 1,
                koreanName: null,
            },
            {
                symbol: '005930.KS',
                signalType: 'new_52w_high',
                changePercent: -1,
                koreanName: '삼성전자',
            },
        ]);

        const rows = await loadEpisodes(
            deps({
                signalHistory: {
                    latestRecordedSession: vi.fn(),
                    findEpisodesStartedOn,
                },
            }),
            'kr',
            '2026-11-25'
        );

        expect(rows).toEqual([
            {
                symbol: 'AAPL',
                signalType: 'golden_cross',
                changePercent: 2,
                name: null,
            },
            {
                symbol: '005930.KS',
                signalType: 'new_52w_high',
                changePercent: -1,
                name: '삼성전자',
            },
        ]);
        expect(findEpisodesStartedOn).toHaveBeenCalledWith(
            'kr',
            '2026-11-25',
            expect.arrayContaining(['golden_cross', 'new_52w_high'])
        );
    });
});

describe('loadFearGreedSources', () => {
    /** 40세션 중립 뒤 마지막 세션이 극단적 공포로 들어서는 기록. */
    function historyEnteringFear(lastDate: string): FearGreedReading[] {
        const neutral = Array.from(
            { length: 40 },
            (_, i): FearGreedReading => ({
                date: isoOf(i),
                score: 50,
                label: 'NEUTRAL',
            })
        );
        return [
            ...neutral,
            { date: lastDate, score: 18, label: 'EXTREME_FEAR' },
        ];
    }

    it('기대 세션에 극단 구간 진입이 있으면 항목으로 돌려준다(코어 판정 그대로)', async () => {
        const history = historyEnteringFear('2026-11-24');
        const result = await loadFearGreedSources(
            deps({ loadFearGreedHistory: vi.fn().mockResolvedValue(history) }),
            ['crypto'],
            EXPECTED
        );

        expect(result.notReady).toEqual([]);
        expect(result.entries.get('crypto')).toEqual({
            zone: 'EXTREME_FEAR',
            date: '2026-11-24',
            score: 18,
        });
    });

    it('진입이 없는 날은 준비됐지만 항목이 없다', async () => {
        const history = historyEnteringFear('2026-11-24').slice(0, -1);
        const withDate = [
            ...history,
            { date: '2026-11-24', score: 50, label: 'NEUTRAL' as const },
        ];
        const result = await loadFearGreedSources(
            deps({ loadFearGreedHistory: vi.fn().mockResolvedValue(withDate) }),
            ['crypto'],
            EXPECTED
        );

        expect(result.notReady).toEqual([]);
        expect(result.entries.size).toBe(0);
    });

    it('판독의 마지막 날짜가 기대 세션보다 앞서면 준비되지 않았다', async () => {
        const result = await loadFearGreedSources(
            deps({
                loadFearGreedHistory: vi
                    .fn()
                    .mockResolvedValue(historyEnteringFear('2026-11-23')),
            }),
            ['crypto'],
            EXPECTED
        );

        expect(result.notReady).toEqual(['fg:crypto']);
        expect(result.entries.size).toBe(0);
    });

    it('빈 기록(판독 없음)은 준비되지 않았다', async () => {
        const result = await loadFearGreedSources(deps(), ['kr'], EXPECTED);

        expect(result.notReady).toEqual(['fg:kr']);
    });

    it('판독을 못 읽은 시장만 준비 안 됨으로 두고 나머지는 계속한다', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const loadFearGreedHistory = vi.fn(async (market: string) => {
            if (market === 'us') throw new Error('provider down');
            return historyEnteringFear('2026-11-24');
        });

        const result = await loadFearGreedSources(
            deps({ loadFearGreedHistory }),
            ['us', 'crypto'],
            EXPECTED
        );

        expect(result.notReady).toEqual(['fg:us']);
        expect(result.entries.get('crypto')?.zone).toBe('EXTREME_FEAR');
    });

    it('구독자가 없는 시장은 읽지 않는다', async () => {
        const loadFearGreedHistory = vi.fn().mockResolvedValue([]);

        const result = await loadFearGreedSources(
            deps({ loadFearGreedHistory }),
            [],
            EXPECTED
        );

        expect(loadFearGreedHistory).not.toHaveBeenCalled();
        expect(result).toEqual({ entries: new Map(), notReady: [] });
    });
});

describe('loadComputedSources', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('마지막 봉이 기대 세션이면 코어가 판정한 새 신호를 알림 유형만 돌려준다', async () => {
        const bars = breakoutBars(300);
        const lastDate = new Date((bars.at(-1)?.time ?? 0) * 1000)
            .toISOString()
            .slice(0, 10);

        const result = await loadComputedSources(
            deps({ loadDailyBars: vi.fn().mockResolvedValue(bars) }),
            [{ symbol: 'PLTR', market: 'us', sessionDate: lastDate }]
        );

        expect(result.noFreshBar).toBe(0);
        expect(result.computeErrors).toBe(0);
        expect(result.computedSymbols).toBe(1);
        const computed = result.computed.get('PLTR');
        const rawTypes = detectNewConfirmedSignals(bars).map(
            signal => signal.type
        );
        expect(computed?.sessionDate).toBe(lastDate);
        expect(computed?.changePercent).toBeCloseTo(30, 5);
        // 같은 봉에서 코어가 내는 새 신호 중 알림 유형만 남는다(허브 밖 유형은 걸러진다).
        expect(computed?.signalTypes).toEqual(
            rawTypes.filter(type =>
                MAIL_ALERT_CHANGE_SIGNAL_TYPES.some(allowed => allowed === type)
            )
        );
        expect(computed?.signalTypes.length).toBeGreaterThan(0);
        expect(rawTypes.length).toBeGreaterThan(
            computed?.signalTypes.length ?? 0
        );
    });

    it('신호가 없는 날도 판정은 했으므로 빈 목록으로 돌려준다', async () => {
        const bars = flatBars(300);
        const lastDate = new Date((bars.at(-1)?.time ?? 0) * 1000)
            .toISOString()
            .slice(0, 10);

        const result = await loadComputedSources(
            deps({ loadDailyBars: vi.fn().mockResolvedValue(bars) }),
            [{ symbol: 'FLAT', market: 'us', sessionDate: lastDate }]
        );

        expect(result.computed.get('FLAT')?.signalTypes).toEqual([]);
    });

    it('마지막 봉이 기대 세션이 아니면 판정하지 않고 센다', async () => {
        const result = await loadComputedSources(
            deps({
                loadDailyBars: vi.fn().mockResolvedValue(breakoutBars(300)),
            }),
            [{ symbol: 'STALE', market: 'us', sessionDate: '2099-01-01' }]
        );

        expect(result.computed.size).toBe(0);
        expect(result.noFreshBar).toBe(1);
        expect([...result.notReadySymbols]).toEqual(['STALE']);
    });

    it('기대 세션보다 뒤의 봉은 잘라 내고 그 세션의 마지막 봉으로 판정한다', async () => {
        const bars = breakoutBars(300);
        const session = new Date((bars.at(-2)?.time ?? 0) * 1000)
            .toISOString()
            .slice(0, 10);

        const result = await loadComputedSources(
            deps({ loadDailyBars: vi.fn().mockResolvedValue(bars) }),
            [{ symbol: 'LATE', market: 'us', sessionDate: session }]
        );

        // 돌파 봉은 잘려 나가 신호가 없다.
        expect(result.computed.get('LATE')?.signalTypes).toEqual([]);
        expect(result.noFreshBar).toBe(0);
    });

    it('봉이 비었으면 신선한 봉이 없는 것으로 센다', async () => {
        const result = await loadComputedSources(deps(), [
            { symbol: 'EMPTY', market: 'us', sessionDate: '2026-11-24' },
        ]);

        expect(result.noFreshBar).toBe(1);
    });

    it('한 종목의 일봉 실패는 그 종목만 오류로 세고 나머지는 계속한다', async () => {
        const loadDailyBars = vi.fn(async (symbol: string) => {
            if (symbol === 'BAD') throw new Error('fmp 429');
            return flatBars(300);
        });
        const session = isoOf(299);

        const result = await loadComputedSources(deps({ loadDailyBars }), [
            { symbol: 'BAD', market: 'us', sessionDate: session },
            { symbol: 'GOOD', market: 'us', sessionDate: session },
        ]);

        expect(result.computeErrors).toBe(1);
        expect(result.barLoadErrors).toBe(1);
        expect(result.computed.has('GOOD')).toBe(true);
        expect(result.computed.has('BAD')).toBe(false);
        expect(result.computedSymbols).toBe(2);
        expect([...result.notReadySymbols]).toEqual(['BAD']);
    });

    it('일봉을 동시에 받는 수는 상한을 넘지 않는다', async () => {
        const state = { running: 0, peak: 0 };
        const loadDailyBars = async (): Promise<Bar[]> => {
            state.running += 1;
            state.peak = Math.max(state.peak, state.running);
            await new Promise<void>(resolve => setTimeout(resolve, 1));
            state.running -= 1;
            return [];
        };
        const targets = Array.from(
            { length: COMPUTE_CONCURRENCY * 3 },
            (_, i) => ({
                symbol: `S${i}`,
                market: 'us' as const,
                sessionDate: '2026-11-24',
            })
        );

        await loadComputedSources(deps({ loadDailyBars }), targets);

        expect(state.peak).toBe(COMPUTE_CONCURRENCY);
    });
});

describe('loadComputedSources: 달라진 점', () => {
    const BAR_DAY = 86_400;
    const T0 = 1_700_000_000;
    /** 60봉 횡보 뒤 계단식 상승. 64봉에서 어제(109)와 오늘(112) 사이에 추세 판정이 중립에서 강세로 바뀐다. */
    const CLOSES = [
        ...Array.from({ length: 60 }, (_, i) => 100 + (i % 2 ? 0.5 : -0.5)),
        ...Array.from({ length: 25 }, (_, i) => 100 + (i + 1) * 3),
    ];
    const mkBars = (closes: readonly number[]): Bar[] =>
        closes.map((close, i) => ({
            time: T0 + i * BAR_DAY,
            open: close,
            high: close + 1,
            low: close - 1,
            close,
            volume: 1000,
        }));
    const BARS = mkBars(CLOSES.slice(0, 64));
    const ANALYZED_AT = new Date((BARS[60]?.time ?? 0) * 1000).toISOString();
    const GENERATED_AT = new Date(ANALYZED_AT);

    /** `analysis_history.result` 모양: 지지선 110(어제 109 → 오늘 112로 위로 건넘), 진입 구간 111~113. */
    function storedResult(scale = 1): unknown {
        return {
            keyLevels: {
                support: [{ price: 110 * scale }],
                resistance: [{ price: 140 * scale }],
            },
            actionRecommendation: {
                entryPrices: [111 * scale, 113 * scale],
                stopLoss: 100 * scale,
                takeProfitPrices: [140 * scale],
            },
        };
    }

    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    function run(
        references?: Parameters<typeof loadComputedSources>[2],
        bars: readonly Bar[] = BARS
    ) {
        return loadComputedSources(
            deps({ loadDailyBars: vi.fn().mockResolvedValue(bars) }),
            [
                {
                    symbol: 'AAPL',
                    market: 'us',
                    sessionDate: new Date((bars.at(-1)?.time ?? 0) * 1000)
                        .toISOString()
                        .slice(0, 10),
                },
            ],
            references
        );
    }

    it('분석이 없어도 어제와 오늘 종가 사이의 추세 변화를 읽는다', async () => {
        const result = await run();

        expect(result.readings.get('AAPL')).toEqual({
            trend: [{ kind: 'trend', from: 'neutral', to: 'bullish' }],
            byTier: new Map(),
        });
        expect(result.referencesUsed).toBe(0);
    });

    it('추세가 그대로인 날은 달라진 점이 없다', async () => {
        const result = await run(undefined, mkBars(CLOSES.slice(0, 60)));

        expect(result.readings.get('AAPL')?.trend).toEqual([]);
    });

    it('가격대를 보는 등급은 그 분석의 가격 판정과 진입 구간 변화를 가격대 순으로 받는다', async () => {
        const result = await run({
            rows: new Map([
                ['AAPL', { generatedAt: GENERATED_AT, result: storedResult() }],
            ]),
            tiers: ['member'],
        });

        expect(result.referencesUsed).toBe(1);
        const lines = result.readings.get('AAPL')?.byTier.get('member');
        expect(lines?.map(line => line.kind)).toEqual(['plan_zone', 'level']);
        expect(lines?.[0]).toMatchObject({
            kind: 'plan_zone',
            position: 'in_zone',
            low: 111,
            high: 113,
            close: 112,
            analyzedAt: ANALYZED_AT,
        });
        expect(lines?.[1]).toMatchObject({
            kind: 'level',
            side: 'support',
            direction: 'up',
            price: 110,
            close: 112,
        });
        // 줄에는 추세가 섞이지 않는다(추세는 모두에게 같은 줄이라 따로 둔다).
        expect(lines?.some(line => line.kind === 'trend')).toBe(false);
    });

    it('가격대를 보지 못하는 등급(free)은 분석이 있어도 가격대·구간 줄이 없다', async () => {
        const result = await run({
            rows: new Map([
                ['AAPL', { generatedAt: GENERATED_AT, result: storedResult() }],
            ]),
            tiers: ['free'],
        });

        expect(result.readings.get('AAPL')?.byTier.size).toBe(0);
        expect(result.referencesUsed).toBe(0);
    });

    it('읽을 수 없는 분석이나 분석이 없는 종목은 가격대 줄이 없다', async () => {
        const unreadable = await run({
            rows: new Map([
                ['AAPL', { generatedAt: GENERATED_AT, result: 'broken' }],
            ]),
            tiers: ['member'],
        });
        const missing = await run({ rows: new Map(), tiers: ['member'] });

        expect(unreadable.readings.get('AAPL')?.byTier.size).toBe(0);
        expect(missing.readings.get('AAPL')?.byTier.size).toBe(0);
    });

    it('분할로 가격 척도가 달라진 분석(가격대가 지금 봉의 3배)은 쓰지 않는다', async () => {
        const result = await run({
            rows: new Map([
                [
                    'AAPL',
                    {
                        generatedAt: GENERATED_AT,
                        result: storedResult(3),
                    },
                ],
            ]),
            tiers: ['member'],
        });

        expect(result.readings.get('AAPL')?.byTier.size).toBe(0);
        expect(result.referencesUsed).toBe(0);
        // 추세는 분석과 무관하게 읽는다.
        expect(result.readings.get('AAPL')?.trend).toHaveLength(1);
    });

    it('척도는 분석 시각에 이미 마감돼 있던 봉과 견준다(장 시작 전 분석이 아직 열리지 않은 그날 봉에 붙지 않는다)', async () => {
        // UTC 자정 일봉. 2026-11-18(수) 봉만 종가가 두 배다. 그날 03:00Z(한국 낮, 미국 개장 전) 분석의 마지막 마감
        // 세션은 11-17이므로 기준 종가는 100이다. 분석 시각 이전 봉(11-18, 종가 200)으로 견주면 중앙값이 가드 밖이다.
        const DAY_MS = 86_400_000;
        const start = Date.parse('2026-09-01T00:00:00Z');
        const days = Math.round(
            (Date.parse('2026-11-19T00:00:00Z') - start) / DAY_MS
        );
        const bars: Bar[] = Array.from({ length: days + 1 }, (_, i) => {
            const time = (start + i * DAY_MS) / 1000;
            const close =
                new Date(time * 1000).toISOString().slice(0, 10) >= '2026-11-18'
                    ? 200
                    : 100;
            return {
                time,
                open: close,
                high: close + 1,
                low: close - 1,
                close,
                volume: 1000,
            };
        });
        const reference = {
            generatedAt: new Date('2026-11-18T03:00:00Z'),
            result: storedResult(),
        };

        const result = await run(
            { rows: new Map([['AAPL', reference]]), tiers: ['member'] },
            bars
        );

        expect(result.computed.has('AAPL')).toBe(true);
        expect(result.referencesUsed).toBe(1);
        expect(result.readings.get('AAPL')?.byTier.has('member')).toBe(true);
    });

    it('분석 시점의 봉을 찾지 못하면(봉보다 이른 분석) 쓰지 않는다', async () => {
        const result = await run({
            rows: new Map([
                [
                    'AAPL',
                    {
                        generatedAt: new Date('2000-01-01T00:00:00Z'),
                        result: storedResult(),
                    },
                ],
            ]),
            tiers: ['member'],
        });

        expect(result.readings.get('AAPL')?.byTier.size).toBe(0);
    });

    it('한 번의 일봉 읽기로 신호와 변화를 함께 읽고, 신호는 MACD 교차를 뺀 유형만이다', async () => {
        const loadDailyBars = vi.fn().mockResolvedValue(breakoutBars(300));
        const lastDate = new Date((breakoutBars(300).at(-1)?.time ?? 0) * 1000)
            .toISOString()
            .slice(0, 10);

        const result = await loadComputedSources(deps({ loadDailyBars }), [
            { symbol: 'PLTR', market: 'us', sessionDate: lastDate },
        ]);

        expect(loadDailyBars).toHaveBeenCalledTimes(1);
        expect(result.computed.get('PLTR')?.signalTypes).not.toContain(
            'macd_bullish_cross'
        );
        expect(result.readings.has('PLTR')).toBe(true);
    });

    it('신선한 봉이 없으면 달라진 점도 읽지 않는다', async () => {
        const result = await loadComputedSources(
            deps({ loadDailyBars: vi.fn().mockResolvedValue(BARS) }),
            [{ symbol: 'AAPL', market: 'us', sessionDate: '2099-01-01' }]
        );

        expect(result.readings.size).toBe(0);
        expect(result.noFreshBar).toBe(1);
    });
});
