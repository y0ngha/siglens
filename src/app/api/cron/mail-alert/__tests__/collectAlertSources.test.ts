vi.mock('server-only', () => ({}));

import {
    detectNewConfirmedSignals,
    type Bar,
    type FearGreedReading,
} from '@y0ngha/siglens-core';
import { MAIL_ALERT_SIGNAL_TYPES } from '@/entities/mail-alert/lib/mailAlertConstants';
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
     * 카드의 안내 문구("그날 점수가 확정된 다음 한국 시간 아침")가 이 간격에 기대므로 값을 고정한다.
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
            [{ symbol: 'PLTR', sessionDate: lastDate }]
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
            rawTypes.filter(type => MAIL_ALERT_SIGNAL_TYPES.includes(type))
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
            [{ symbol: 'FLAT', sessionDate: lastDate }]
        );

        expect(result.computed.get('FLAT')?.signalTypes).toEqual([]);
    });

    it('마지막 봉이 기대 세션이 아니면 판정하지 않고 센다', async () => {
        const result = await loadComputedSources(
            deps({
                loadDailyBars: vi.fn().mockResolvedValue(breakoutBars(300)),
            }),
            [{ symbol: 'STALE', sessionDate: '2099-01-01' }]
        );

        expect(result.computed.size).toBe(0);
        expect(result.noFreshBar).toBe(1);
    });

    it('기대 세션보다 뒤의 봉은 잘라 내고 그 세션의 마지막 봉으로 판정한다', async () => {
        const bars = breakoutBars(300);
        const session = new Date((bars.at(-2)?.time ?? 0) * 1000)
            .toISOString()
            .slice(0, 10);

        const result = await loadComputedSources(
            deps({ loadDailyBars: vi.fn().mockResolvedValue(bars) }),
            [{ symbol: 'LATE', sessionDate: session }]
        );

        // 돌파 봉은 잘려 나가 신호가 없다.
        expect(result.computed.get('LATE')?.signalTypes).toEqual([]);
        expect(result.noFreshBar).toBe(0);
    });

    it('봉이 비었으면 신선한 봉이 없는 것으로 센다', async () => {
        const result = await loadComputedSources(deps(), [
            { symbol: 'EMPTY', sessionDate: '2026-11-24' },
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
            { symbol: 'BAD', sessionDate: session },
            { symbol: 'GOOD', sessionDate: session },
        ]);

        expect(result.computeErrors).toBe(1);
        expect(result.computed.has('GOOD')).toBe(true);
        expect(result.computed.has('BAD')).toBe(false);
        expect(result.computedSymbols).toBe(2);
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
                sessionDate: '2026-11-24',
            })
        );

        await loadComputedSources(deps({ loadDailyBars }), targets);

        expect(state.peak).toBe(COMPUTE_CONCURRENCY);
    });
});
