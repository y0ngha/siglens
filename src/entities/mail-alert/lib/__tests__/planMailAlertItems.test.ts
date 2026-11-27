import type { SignalType } from '@y0ngha/siglens-core';
import type { SignalHistoryMarket } from '@/entities/signal-history/types';
import type {
    MailAlertChange,
    MailAlertFearGreedMarket,
    MailAlertPriceAlertItem,
    MailAlertTopic,
    MailAlertVoidedPriceAlertItem,
} from '../../model';
import {
    MAIL_ALERT_MAX_HUB_ROWS,
    MAIL_ALERT_MAX_SIGNAL_ITEMS,
} from '../mailAlertConstants';
import {
    planMailAlertItems,
    keepFiredPriceAlerts,
    priceAlertItemKey,
    voidedPriceAlertItemKey,
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
        changes: new Map<string, readonly MailAlertChange[]>(),
        fearGreed: new Map<MailAlertFearGreedMarket, MailAlertFearGreedEntry>(),
        suppressed: new Set<string>(),
        priceAlerts: [],
        voidedPriceAlerts: [],
        ...overrides,
    };
}

function priceAlert(
    alertId: string,
    overrides: Partial<MailAlertPriceAlertItem> = {}
): MailAlertPriceAlertItem {
    return {
        kind: 'price_alert',
        alertId,
        symbol: 'AAPL',
        market: 'us',
        condition: { kind: 'close_below', level: 180 },
        basis: 'price_level',
        analysisAt: null,
        referenceClose: 190,
        createdAt: new Date('2026-11-20T03:00:00Z'),
        firedSession: '2026-11-24',
        firedClose: 179.5,
        zonePosition: null,
        ...overrides,
    };
}

describe('planMailAlertItems', () => {
    it('항목이 하나도 없으면 빈 계획이다', () => {
        const plan = planMailAlertItems(
            input({ topics: [symbolTopic('AAPL')] })
        );

        expect(plan.itemKeys).toEqual([]);
        expect(plan.sections).toEqual({
            priceAlerts: [],
            voidedPriceAlerts: [],
            fearGreed: [],
            mine: [],
            hubs: [],
        });
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
            plan.sections.mine.flatMap(item =>
                item.kind === 'signal'
                    ? [
                          [
                              item.symbol,
                              item.signalType,
                              item.sessionDate,
                              item.changePercent,
                          ],
                      ]
                    : []
            )
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
    describe('가격대 알림', () => {
        it('keepFiredPriceAlerts: 선점이 fired로 바꾸지 못한 알림의 줄과 키만 뺀다', () => {
            const plan = planMailAlertItems(
                input({
                    topics: [fgTopic('kr')],
                    fearGreed: new Map([
                        [
                            'kr',
                            {
                                zone: 'EXTREME_FEAR',
                                date: '2026-11-25',
                                score: 20,
                            },
                        ],
                    ]),
                    priceAlerts: [priceAlert('a-1'), priceAlert('a-2')],
                })
            );

            const kept = keepFiredPriceAlerts(plan, ['a-2']);

            expect(kept.sections.priceAlerts.map(item => item.alertId)).toEqual(
                ['a-2']
            );
            expect(kept.itemKeys).toEqual(['p:a-2', 'f:kr:EXTREME_FEAR']);
            expect(kept.sections.fearGreed).toEqual(plan.sections.fearGreed);
            expect(keepFiredPriceAlerts(plan, ['a-1', 'a-2'])).toBe(plan);
        });

        it('알림 하나가 줄 하나이고 키는 p:<알림 id>다', () => {
            const plan = planMailAlertItems(
                input({
                    priceAlerts: [priceAlert('a-1'), priceAlert('a-2')],
                })
            );

            expect(plan.sections.priceAlerts.map(item => item.alertId)).toEqual(
                ['a-1', 'a-2']
            );
            expect(plan.itemKeys).toEqual(['p:a-1', 'p:a-2']);
            expect(priceAlertItemKey(priceAlert('a-9'))).toBe('p:a-9');
        });

        it('알림 키는 다른 섹션의 키보다 앞에 오고 신호 키의 순서는 그대로다', () => {
            const plan = planMailAlertItems(
                input({
                    topics: [symbolTopic('AAPL'), fgTopic('kr')],
                    marketOf: new Map([['AAPL', 'us']]),
                    computed: new Map([['AAPL', judged(['rsi_oversold'])]]),
                    fearGreed: new Map([
                        [
                            'kr',
                            {
                                zone: 'EXTREME_FEAR',
                                date: '2026-11-25',
                                score: 20,
                            },
                        ],
                    ]),
                    priceAlerts: [priceAlert('a-1')],
                })
            );

            expect(plan.itemKeys).toEqual([
                'p:a-1',
                'f:kr:EXTREME_FEAR',
                's:us:AAPL:rsi_oversold',
            ]);
        });

        it('알림만 있어도 계획은 비어 있지 않다(알림만 가진 구독자도 메일을 받는다)', () => {
            const plan = planMailAlertItems(
                input({ priceAlerts: [priceAlert('a-1')] })
            );

            expect(plan.itemKeys).toHaveLength(1);
            expect(plan.overflowKeys).toEqual([]);
            expect(plan.suppressedCount).toBe(0);
        });

        it('끝낸 알림 안내도 줄 하나이고 키는 v:<알림 id>이며 충족한 알림 키 뒤, 다른 섹션 키 앞에 온다', () => {
            const voided: MailAlertVoidedPriceAlertItem = {
                kind: 'price_alert_voided',
                alertId: 'v-1',
                symbol: 'AAPL',
            };
            const plan = planMailAlertItems(
                input({
                    topics: [fgTopic('kr')],
                    fearGreed: new Map([
                        [
                            'kr',
                            {
                                zone: 'EXTREME_FEAR',
                                date: '2026-11-25',
                                score: 20,
                            },
                        ],
                    ]),
                    priceAlerts: [priceAlert('a-1')],
                    voidedPriceAlerts: [voided],
                })
            );

            expect(plan.sections.voidedPriceAlerts).toEqual([voided]);
            expect(voidedPriceAlertItemKey(voided)).toBe('v:v-1');
            expect(plan.itemKeys).toEqual([
                'p:a-1',
                'v:v-1',
                'f:kr:EXTREME_FEAR',
            ]);
        });

        it('끝낸 알림 안내만 있어도 계획은 비어 있지 않다(받을 것이 그것뿐인 구독자도 안내를 받는다)', () => {
            const plan = planMailAlertItems(
                input({
                    voidedPriceAlerts: [
                        {
                            kind: 'price_alert_voided',
                            alertId: 'v-1',
                            symbol: 'AAPL',
                        },
                    ],
                })
            );

            expect(plan.itemKeys).toEqual(['v:v-1']);
        });

        it('반복 방지 창에 같은 이름의 키가 있어도 알림은 걸러지지 않는다(상태가 한 번만 알린다)', () => {
            const plan = planMailAlertItems(
                input({
                    priceAlerts: [priceAlert('a-1')],
                    suppressed: new Set(['p:a-1']),
                })
            );

            expect(plan.sections.priceAlerts).toHaveLength(1);
            expect(plan.suppressedCount).toBe(0);
        });
    });
    describe('달라진 점', () => {
        const ANALYZED = '2026-11-20T01:00:00.000Z';
        const trend: MailAlertChange = {
            kind: 'trend',
            from: 'neutral',
            to: 'bullish',
        };
        const level: MailAlertChange = {
            kind: 'level',
            side: 'support',
            direction: 'down',
            price: 180,
            close: 178,
            analyzedAt: ANALYZED,
        };
        const zone: MailAlertChange = {
            kind: 'plan_zone',
            position: 'in_zone',
            low: 170,
            high: 175,
            close: 172,
            analyzedAt: ANALYZED,
        };
        const stopped: MailAlertChange = {
            kind: 'plan_stopped',
            stop: 165,
            close: 164,
            analyzedAt: ANALYZED,
        };
        const aapl = (changes: readonly MailAlertChange[]) =>
            input({
                topics: [symbolTopic('AAPL')],
                marketOf: new Map([['AAPL', 'us']]),
                computed: new Map([['AAPL', judged([])]]),
                changes: new Map([['AAPL', changes]]),
            });

        it('담은 종목의 달라진 점은 그 종목의 일봉 판정 세션 날짜로, 신호 앞에 실린다', () => {
            const plan = planMailAlertItems({
                ...aapl([level, trend]),
                computed: new Map([['AAPL', judged(['golden_cross'])]]),
            });

            expect(plan.sections.mine.map(item => item.kind)).toEqual([
                'change',
                'change',
                'signal',
            ]);
            expect(plan.sections.mine[0]).toMatchObject({
                kind: 'change',
                section: 'mine',
                market: 'us',
                symbol: 'AAPL',
                sessionDate: '2026-11-24',
                change: level,
            });
        });

        it('일봉 판정이 있어야 달라진 점을 싣고(세션 날짜의 출처), 없으면 줄이 없다', () => {
            const base = input({
                topics: [symbolTopic('PLTR')],
                marketOf: new Map([['PLTR', 'us']]),
                changes: new Map([['PLTR', [trend]]]),
            });
            const withComputed = planMailAlertItems({
                ...base,
                computed: new Map([
                    [
                        'PLTR',
                        {
                            sessionDate: '2026-11-24',
                            changePercent: 1,
                            signalTypes: [],
                        },
                    ],
                ]),
            });

            expect(withComputed.sections.mine).toHaveLength(1);
            expect(planMailAlertItems(base).sections.mine).toEqual([]);
        });

        it('반복 방지 키: 추세는 종목당 하나, 가격대와 진입 구간은 분석 시각과 선·위치로 정한다', () => {
            const plan = planMailAlertItems(
                aapl([zone, level, trend, stopped])
            );

            expect(plan.itemKeys).toEqual([
                `pp:us:AAPL:${ANALYZED}:in_zone`,
                `l:us:AAPL:${ANALYZED}:support:180`,
                't:us:AAPL',
            ]);
        });

        it('같은 종목의 추세 키는 바뀐 방향과 무관하다(종목당 7일에 한 줄)', () => {
            const plan = planMailAlertItems({
                ...aapl([{ kind: 'trend', from: 'bullish', to: 'neutral' }]),
                suppressed: new Set(['t:us:AAPL']),
            });

            expect(plan.sections.mine).toEqual([]);
            expect(plan.itemKeys).toEqual([]);
            expect(plan.suppressedCount).toBe(1);
        });

        it('새 분석이 나오면 같은 선도 새 키다', () => {
            const plan = planMailAlertItems({
                ...aapl([{ ...level, analyzedAt: '2026-11-25T01:00:00.000Z' }]),
                suppressed: new Set([`l:us:AAPL:${ANALYZED}:support:180`]),
            });

            expect(plan.sections.mine).toHaveLength(1);
        });

        it('한 종목은 세 줄까지만 싣고 넘친 줄의 키는 남긴다', () => {
            const plan = planMailAlertItems({
                ...aapl([zone, level, trend]),
                computed: new Map([['AAPL', judged(['golden_cross'])]]),
            });

            expect(plan.sections.mine).toHaveLength(3);
            expect(plan.itemKeys).toEqual([
                `pp:us:AAPL:${ANALYZED}:in_zone`,
                `l:us:AAPL:${ANALYZED}:support:180`,
                't:us:AAPL',
            ]);
            expect(plan.overflowKeys).toEqual(['s:us:AAPL:golden_cross']);
        });

        it('섹션 상한은 신호와 달라진 점을 함께 센다', () => {
            const symbols = Array.from(
                { length: MAIL_ALERT_MAX_SIGNAL_ITEMS + 2 },
                (_, i) => `S${i}`
            );
            const plan = planMailAlertItems(
                input({
                    topics: symbols.map(symbolTopic),
                    marketOf: new Map(symbols.map(symbol => [symbol, 'us'])),
                    computed: new Map(
                        symbols.map(symbol => [symbol, judged([])])
                    ),
                    changes: new Map(symbols.map(symbol => [symbol, [trend]])),
                })
            );

            expect(plan.sections.mine).toHaveLength(
                MAIL_ALERT_MAX_SIGNAL_ITEMS
            );
            expect(plan.overflowKeys).toEqual([
                `t:us:${symbols.at(-2)}`,
                `t:us:${symbols.at(-1)}`,
            ]);
        });

        it('MACD 교차는 담은 종목 섹션에서 빼고, 허브 구독자는 그대로 받는다', () => {
            const plan = planMailAlertItems(
                input({
                    topics: [
                        symbolTopic('AAPL'),
                        signalTopic('macd_bullish_cross'),
                    ],
                    marketOf: new Map([['AAPL', 'us']]),
                    computed: new Map([
                        ['AAPL', judged(['macd_bullish_cross'])],
                    ]),
                    episodes: {
                        us: [row('AAPL', 'macd_bullish_cross', 2)],
                        kr: [],
                    },
                })
            );

            expect(plan.sections.mine).toEqual([]);
            expect(plan.sections.hubs[0]?.items.map(i => i.symbol)).toEqual([
                'AAPL',
            ]);
        });

        it('추세 줄만 실린 종목은 허브에서 빼지 않고, 신호가 실린 종목은 뺀다', () => {
            const hubInput = (signalType: SignalType) =>
                input({
                    topics: [symbolTopic('AAPL'), signalTopic(signalType)],
                    marketOf: new Map([['AAPL', 'us']]),
                    computed: new Map([['AAPL', judged([signalType])]]),
                    changes: new Map([['AAPL', [trend]]]),
                    episodes: {
                        us: [row('AAPL', signalType, 2)],
                        kr: [],
                    },
                });

            // 골든크로스는 담은 종목 섹션에 실리므로 허브에서 빠진다.
            const signalInMine = planMailAlertItems(hubInput('golden_cross'));
            // MACD 교차는 담은 종목 섹션에 실리지 않으므로 추세 줄만 있는 종목도 허브에 남는다.
            const trendOnly = planMailAlertItems(
                hubInput('macd_bullish_cross')
            );

            expect(signalInMine.sections.hubs).toEqual([]);
            expect(trendOnly.sections.mine.map(item => item.kind)).toEqual([
                'change',
            ]);
            expect(trendOnly.sections.hubs[0]?.items).toHaveLength(1);
        });

        it('허브는 같은 키(시장, 종목, 유형)만 뺀다: 담은 종목에 골든크로스가 실린 종목도 MACD 허브에는 남는다', () => {
            const plan = planMailAlertItems(
                input({
                    topics: [
                        symbolTopic('AAPL'),
                        signalTopic('macd_bullish_cross'),
                        signalTopic('golden_cross'),
                    ],
                    marketOf: new Map([['AAPL', 'us']]),
                    computed: new Map([
                        [
                            'AAPL',
                            judged(['golden_cross', 'macd_bullish_cross']),
                        ],
                    ]),
                    episodes: {
                        us: [
                            row('AAPL', 'golden_cross', 2),
                            row('AAPL', 'macd_bullish_cross', 2),
                        ],
                        kr: [],
                    },
                })
            );

            expect(
                plan.sections.mine.map(item =>
                    item.kind === 'signal' ? item.signalType : item.kind
                )
            ).toEqual(['golden_cross']);
            expect(plan.sections.hubs.map(hub => hub.signalType)).toEqual([
                'macd_bullish_cross',
            ]);
        });

        it('이 구독자의 가격대 알림이 그 종목으로 울린 실행에서는 가격 판정, 진입 구간, 무효화 기준 줄을 뺀다(추세는 남는다)', () => {
            const plan = planMailAlertItems({
                ...aapl([zone, stopped, level, trend]),
                priceAlerts: [priceAlert('a-1')],
            });

            expect(plan.sections.mine.map(item => item.kind)).toEqual([
                'change',
            ]);
            expect(plan.itemKeys).toContain('t:us:AAPL');
            // 싣지 않은 줄의 키는 남긴다(알림은 한 번 알리면 끝나서 다음 실행에는 알림 줄이 없다).
            expect(plan.itemKeys.filter(key => key.startsWith('l:'))).toEqual(
                []
            );
            expect(plan.itemKeys.filter(key => key.startsWith('pp:'))).toEqual(
                []
            );
            expect(plan.overflowKeys.toSorted()).toEqual(
                [
                    `pp:us:AAPL:${ANALYZED}:in_zone`,
                    `pp:us:AAPL:${ANALYZED}:stopped`,
                    `l:us:AAPL:${ANALYZED}:support:180`,
                ].toSorted()
            );
            expect(plan.suppressedCount).toBe(0);
        });

        it('알림이 울린 실행의 키를 반복 방지 창에 넣으면, 알림 줄이 없는 다음 실행도 같은 가격 사실을 싣지 않는다', () => {
            const changes = [zone, stopped, level, trend];
            const first = planMailAlertItems({
                ...aapl(changes),
                priceAlerts: [priceAlert('a-1')],
            });
            const second = planMailAlertItems({
                ...aapl(changes),
                priceAlerts: [],
                suppressed: new Set([...first.itemKeys, ...first.overflowKeys]),
            });

            expect(second.sections.mine).toEqual([]);
            expect(second.itemKeys).toEqual([]);
            // 키가 기록되지 않았다면 같은 줄이 다시 올라온다.
            const unrecorded = planMailAlertItems({
                ...aapl(changes),
                priceAlerts: [],
                suppressed: new Set(first.itemKeys),
            });
            expect(unrecorded.sections.mine.map(item => item.kind)).toEqual([
                'change',
                'change',
                'change',
            ]);
        });

        it('다른 종목이나 다른 시장의 가격대 알림은 줄을 빼지 않는다', () => {
            const plan = planMailAlertItems({
                ...aapl([level]),
                priceAlerts: [
                    priceAlert('a-1', { symbol: 'MSFT' }),
                    priceAlert('a-2', { market: 'kr' }),
                ],
            });

            expect(plan.sections.mine).toHaveLength(1);
        });

        it('달라진 점이 없고 신호도 없으면 비어 있다', () => {
            expect(planMailAlertItems(aapl([])).itemKeys).toEqual([]);
        });
    });
});
