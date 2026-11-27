import type { SignalType } from '@y0ngha/siglens-core';
import type { SignalHistoryMarket } from '@/entities/signal-history/types';
import type { MailAlertFearGreedMarket, MailAlertTopic } from '../../model';
import {
    MAIL_ALERT_MAX_HUB_ROWS,
    MAIL_ALERT_MAX_SIGNAL_ITEMS,
} from '../mailAlertConstants';
import {
    planMailAlertItems,
    type MailAlertComputedSymbol,
    type MailAlertEpisodeRow,
    type MailAlertFearGreedEntry,
    type PlanMailAlertInput,
} from '../planMailAlertItems';

const SESSIONS = { us: '2026-11-24', kr: '2026-11-25' } as const;

function row(
    symbol: string,
    signalType: SignalType,
    changePercent: number | null = 1,
    name: string | null = null
): MailAlertEpisodeRow {
    return { symbol, signalType, changePercent, name };
}

/** 담은 종목 하나의 일봉 판정 결과. */
function judged(
    signalTypes: readonly SignalType[],
    overrides: Partial<MailAlertComputedSymbol> = {}
): MailAlertComputedSymbol {
    return {
        sessionDate: SESSIONS.us,
        changePercent: 1,
        signalTypes,
        ...overrides,
    };
}

const symbolTopic = (symbol: string): MailAlertTopic => ({
    kind: 'symbol',
    symbol,
});
const signalTopic = (signalType: SignalType): MailAlertTopic => ({
    kind: 'signal',
    signalType,
});
const fgTopic = (market: MailAlertFearGreedMarket): MailAlertTopic => ({
    kind: 'fear_greed',
    market,
});

function input(
    overrides: Partial<PlanMailAlertInput> = {}
): PlanMailAlertInput {
    return {
        topics: [],
        portfolioSymbols: [],
        marketOf: new Map<string, SignalHistoryMarket | null>(),
        episodes: { us: [], kr: [] },
        episodeSessions: SESSIONS,
        computed: new Map<string, MailAlertComputedSymbol>(),
        fearGreed: new Map<MailAlertFearGreedMarket, MailAlertFearGreedEntry>(),
        suppressed: new Set<string>(),
        ...overrides,
    };
}

describe('planMailAlertItems', () => {
    it('항목이 하나도 없으면 빈 계획이다', () => {
        const plan = planMailAlertItems(
            input({ topics: [symbolTopic('AAPL')] })
        );

        expect(plan.itemKeys).toEqual([]);
        expect(plan.sections).toEqual({ fearGreed: [], mine: [], hubs: [] });
        expect(plan.suppressedCount).toBe(0);
    });

    it('담은 종목은 스캐너 대상이어도 신호 기록이 아니라 그 종목의 일봉 판정을 읽는다', () => {
        const plan = planMailAlertItems(
            input({
                topics: [symbolTopic('AAPL'), symbolTopic('PLTR')],
                marketOf: new Map([
                    ['AAPL', 'us'],
                    ['PLTR', 'us'],
                ]),
                // 신호 기록에는 AAPL 골든크로스가 있지만 담은 종목 섹션은 일봉 판정(RSI 과매도)만 쓴다.
                episodes: {
                    us: [
                        row('AAPL', 'golden_cross', 2.5),
                        row('MSFT', 'golden_cross'),
                    ],
                    kr: [],
                },
                computed: new Map([
                    ['AAPL', judged(['rsi_oversold'], { changePercent: 2 })],
                    ['PLTR', judged(['rsi_oversold'], { changePercent: -3 })],
                ]),
            })
        );

        expect(
            plan.sections.mine.map(item => [
                item.symbol,
                item.signalType,
                item.sessionDate,
                item.changePercent,
            ])
        ).toEqual([
            ['AAPL', 'rsi_oversold', '2026-11-24', 2],
            ['PLTR', 'rsi_oversold', '2026-11-24', -3],
        ]);
        expect(plan.itemKeys).toEqual([
            's:us:AAPL:rsi_oversold',
            's:us:PLTR:rsi_oversold',
        ]);
    });

    it('일봉 판정이 없는 담은 종목은 신호 기록에 새 에피소드가 있어도 싣지 않는다', () => {
        const plan = planMailAlertItems(
            input({
                topics: [symbolTopic('AAPL')],
                marketOf: new Map([['AAPL', 'us']]),
                episodes: { us: [row('AAPL', 'golden_cross')], kr: [] },
            })
        );

        expect(plan.sections.mine).toEqual([]);
    });

    it('시장을 모르는 종목(주식이 아님)은 건너뛴다', () => {
        const plan = planMailAlertItems(
            input({
                topics: [symbolTopic('BTCUSD'), symbolTopic('ZZZ')],
                marketOf: new Map<string, SignalHistoryMarket | null>([
                    ['BTCUSD', null],
                ]),
                computed: new Map([['BTCUSD', judged(['golden_cross'])]]),
            })
        );

        expect(plan.sections.mine).toEqual([]);
    });

    it('주제 종목 뒤에 보유·관심종목이 오고 같은 종목은 한 번만 센다', () => {
        const plan = planMailAlertItems(
            input({
                topics: [symbolTopic('MSFT')],
                portfolioSymbols: ['AAPL', 'MSFT'],
                marketOf: new Map([
                    ['MSFT', 'us'],
                    ['AAPL', 'us'],
                ]),
                computed: new Map([
                    ['AAPL', judged(['golden_cross'])],
                    ['MSFT', judged(['golden_cross'])],
                ]),
            })
        );

        expect(plan.sections.mine.map(item => item.symbol)).toEqual([
            'MSFT',
            'AAPL',
        ]);
    });

    it('한국 종목은 한국 세션 날짜를 싣고 이름은 비워 둔다(메일을 만들 때 고른다)', () => {
        const plan = planMailAlertItems(
            input({
                topics: [symbolTopic('005930.KS')],
                marketOf: new Map([['005930.KS', 'kr']]),
                computed: new Map([
                    [
                        '005930.KS',
                        judged(['new_52w_high'], {
                            sessionDate: SESSIONS.kr,
                            changePercent: 1.2,
                        }),
                    ],
                ]),
            })
        );

        expect(plan.sections.mine).toEqual([
            {
                kind: 'signal',
                section: 'mine',
                market: 'kr',
                symbol: '005930.KS',
                name: null,
                signalType: 'new_52w_high',
                sessionDate: SESSIONS.kr,
                changePercent: 1.2,
            },
        ]);
    });

    it('담은 종목 섹션은 상한까지만 싣고 싣지 못한 항목은 키에 넣지 않는다', () => {
        const symbols = Array.from(
            { length: MAIL_ALERT_MAX_SIGNAL_ITEMS + 3 },
            (_, i) => `S${String(i).padStart(2, '0')}`
        );
        const plan = planMailAlertItems(
            input({
                topics: symbols.map(symbolTopic),
                marketOf: new Map(symbols.map(symbol => [symbol, 'us'])),
                computed: new Map(
                    symbols.map(symbol => [symbol, judged(['rsi_oversold'])])
                ),
            })
        );

        expect(plan.sections.mine).toHaveLength(MAIL_ALERT_MAX_SIGNAL_ITEMS);
        expect(plan.itemKeys).toHaveLength(MAIL_ALERT_MAX_SIGNAL_ITEMS);
        expect(plan.itemKeys).not.toContain(
            `s:us:${symbols.at(-1)}:rsi_oversold`
        );
    });

    it('신호 주제는 두 시장의 새 에피소드를 변동률 절댓값 순으로 싣는다', () => {
        const plan = planMailAlertItems(
            input({
                topics: [signalTopic('golden_cross')],
                episodes: {
                    us: [
                        row('AAA', 'golden_cross', 1),
                        row('BBB', 'golden_cross', -4),
                        row('CCC', 'death_cross', 9),
                    ],
                    kr: [row('005930.KS', 'golden_cross', 2.5, '삼성전자')],
                },
            })
        );

        expect(plan.sections.hubs).toHaveLength(1);
        expect(plan.sections.hubs[0]?.signalType).toBe('golden_cross');
        expect(plan.sections.hubs[0]?.items.map(item => item.symbol)).toEqual([
            'BBB',
            '005930.KS',
            'AAA',
        ]);
        expect(
            plan.sections.hubs[0]?.items.every(item => item.section === 'hub')
        ).toBe(true);
    });

    it('신호 주제가 아닌 유형의 에피소드는 싣지 않는다', () => {
        const plan = planMailAlertItems(
            input({
                topics: [signalTopic('golden_cross')],
                episodes: { us: [row('CCC', 'death_cross')], kr: [] },
            })
        );

        expect(plan.sections.hubs).toEqual([]);
    });

    it('신호별 섹션은 줄 수 상한까지만 싣고 나머지 수를 알린다', () => {
        const rows = Array.from(
            { length: MAIL_ALERT_MAX_HUB_ROWS + 4 },
            (_, i) =>
                row(`H${String(i).padStart(2, '0')}`, 'golden_cross', i + 1)
        );
        const plan = planMailAlertItems(
            input({
                topics: [signalTopic('golden_cross')],
                episodes: { us: rows, kr: [] },
            })
        );

        const hub = plan.sections.hubs[0];
        expect(hub?.items).toHaveLength(MAIL_ALERT_MAX_HUB_ROWS);
        expect(hub?.moreCount).toBe(4);
        expect(plan.itemKeys).toHaveLength(MAIL_ALERT_MAX_HUB_ROWS);
        expect(plan.overflowKeys).toHaveLength(4);
        expect(plan.overflowKeys.some(key => plan.itemKeys.includes(key))).toBe(
            false
        );
    });

    it('이미 보냈다는 이유로 뺀 항목은 넘친 키에 넣지 않는다', () => {
        const plan = planMailAlertItems(
            input({
                topics: [signalTopic('golden_cross')],
                episodes: {
                    us: [
                        row('AAA', 'golden_cross'),
                        row('BBB', 'golden_cross'),
                    ],
                    kr: [],
                },
                suppressed: new Set(['s:us:AAA:golden_cross']),
            })
        );

        expect(plan.overflowKeys).toEqual([]);
    });

    it('담은 종목 섹션에 실린 종목은 신호별 섹션에서 다시 싣지 않는다', () => {
        const plan = planMailAlertItems(
            input({
                topics: [symbolTopic('AAPL'), signalTopic('golden_cross')],
                marketOf: new Map([['AAPL', 'us']]),
                computed: new Map([['AAPL', judged(['golden_cross'])]]),
                episodes: {
                    us: [
                        row('AAPL', 'golden_cross', 5),
                        row('MSFT', 'golden_cross', 1),
                    ],
                    kr: [],
                },
            })
        );

        expect(plan.sections.mine.map(item => item.symbol)).toEqual(['AAPL']);
        expect(plan.sections.hubs[0]?.items.map(item => item.symbol)).toEqual([
            'MSFT',
        ]);
    });

    it('신호별 섹션이 비면 섹션 자체를 싣지 않는다', () => {
        const plan = planMailAlertItems(
            input({
                topics: [symbolTopic('AAPL'), signalTopic('golden_cross')],
                marketOf: new Map([['AAPL', 'us']]),
                computed: new Map([['AAPL', judged(['golden_cross'])]]),
                episodes: { us: [row('AAPL', 'golden_cross')], kr: [] },
            })
        );

        expect(plan.sections.hubs).toEqual([]);
    });

    it('같은 신호 주제는 한 섹션만 만든다', () => {
        const plan = planMailAlertItems(
            input({
                topics: [
                    signalTopic('golden_cross'),
                    signalTopic('golden_cross'),
                ],
                episodes: { us: [row('AAA', 'golden_cross')], kr: [] },
            })
        );

        expect(plan.sections.hubs).toHaveLength(1);
    });

    it('공포·탐욕은 구독한 시장의 진입만 싣는다', () => {
        const plan = planMailAlertItems(
            input({
                topics: [fgTopic('us'), fgTopic('crypto')],
                fearGreed: new Map<
                    MailAlertFearGreedMarket,
                    MailAlertFearGreedEntry
                >([
                    [
                        'us',
                        { zone: 'EXTREME_FEAR', date: '2026-11-24', score: 21 },
                    ],
                    [
                        'kr',
                        {
                            zone: 'EXTREME_GREED',
                            date: '2026-11-25',
                            score: 80,
                        },
                    ],
                ]),
            })
        );

        expect(plan.sections.fearGreed).toEqual([
            {
                kind: 'fear_greed',
                market: 'us',
                zone: 'EXTREME_FEAR',
                date: '2026-11-24',
                score: 21,
            },
        ]);
        expect(plan.itemKeys).toEqual(['f:us:EXTREME_FEAR']);
    });

    it('최근에 보낸 신호·공포탐욕 항목은 모든 섹션에서 빼고 센다', () => {
        const plan = planMailAlertItems(
            input({
                topics: [
                    symbolTopic('AAPL'),
                    signalTopic('golden_cross'),
                    fgTopic('us'),
                ],
                marketOf: new Map([['AAPL', 'us']]),
                computed: new Map([['AAPL', judged(['golden_cross'])]]),
                episodes: {
                    us: [
                        row('AAPL', 'golden_cross'),
                        row('MSFT', 'golden_cross'),
                        row('NVDA', 'golden_cross'),
                    ],
                    kr: [],
                },
                fearGreed: new Map([
                    [
                        'us',
                        {
                            zone: 'EXTREME_GREED',
                            date: '2026-11-24',
                            score: 80,
                        },
                    ],
                ]),
                suppressed: new Set([
                    's:us:AAPL:golden_cross',
                    's:us:MSFT:golden_cross',
                    'f:us:EXTREME_GREED',
                ]),
            })
        );

        expect(plan.sections.mine).toEqual([]);
        expect(plan.sections.fearGreed).toEqual([]);
        expect(plan.sections.hubs[0]?.items.map(item => item.symbol)).toEqual([
            'NVDA',
        ]);
        expect(plan.suppressedCount).toBe(3);
        expect(plan.itemKeys).toEqual(['s:us:NVDA:golden_cross']);
    });

    it('담은 종목에서 이미 빠진 항목을 신호별 섹션이 다시 세지 않는다', () => {
        const plan = planMailAlertItems(
            input({
                topics: [symbolTopic('AAPL'), signalTopic('golden_cross')],
                marketOf: new Map([['AAPL', 'us']]),
                computed: new Map([['AAPL', judged(['golden_cross'])]]),
                episodes: { us: [row('AAPL', 'golden_cross')], kr: [] },
                suppressed: new Set(['s:us:AAPL:golden_cross']),
            })
        );

        expect(plan.suppressedCount).toBe(1);
        expect(plan.itemKeys).toEqual([]);
    });

    it('변동률이 없는 행은 0으로 정렬한다', () => {
        const plan = planMailAlertItems(
            input({
                topics: [signalTopic('golden_cross')],
                episodes: {
                    us: [
                        row('NULLCHG', 'golden_cross', null),
                        row('SMALL', 'golden_cross', 0.5),
                    ],
                    kr: [],
                },
            })
        );

        expect(plan.sections.hubs[0]?.items.map(item => item.symbol)).toEqual([
            'SMALL',
            'NULLCHG',
        ]);
    });

    it('키는 담은 항목 순서(공포탐욕, 담은 종목, 신호별)로 실린 것만 담는다', () => {
        const plan = planMailAlertItems(
            input({
                topics: [
                    signalTopic('golden_cross'),
                    symbolTopic('AAPL'),
                    fgTopic('kr'),
                ],
                marketOf: new Map([['AAPL', 'us']]),
                computed: new Map([['AAPL', judged(['rsi_oversold'])]]),
                episodes: { us: [row('MSFT', 'golden_cross')], kr: [] },
                fearGreed: new Map([
                    [
                        'kr',
                        { zone: 'EXTREME_FEAR', date: '2026-11-25', score: 20 },
                    ],
                ]),
            })
        );

        expect(plan.itemKeys).toEqual([
            'f:kr:EXTREME_FEAR',
            's:us:AAPL:rsi_oversold',
            's:us:MSFT:golden_cross',
        ]);
    });
});
