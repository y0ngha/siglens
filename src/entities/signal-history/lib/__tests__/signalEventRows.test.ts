import {
    US_EQUITY_SESSION,
    type SectorSignalsResult,
    type Signal,
} from '@y0ngha/siglens-core';
import { KR_EQUITY_SESSION } from '@/shared/api/market/sessionSpecFor';
import {
    continuationFloor,
    planSignalEpisodes,
    recordableSessionDate,
    SIGNAL_SETTLE_MINUTES,
} from '../signalEventRows';

const SETTLE = 15;

describe('recordableSessionDate — 미국(ET)', () => {
    // 2026-11-13(금)은 표준시라 마감 16:00 ET = 21:00 UTC.
    it('마감 + 정착 시간 뒤, 같은 ET 날짜면 그 세션을 낸다', () => {
        expect(
            recordableSessionDate(
                US_EQUITY_SESSION,
                new Date('2026-11-13T21:20:00Z'),
                SETTLE
            )
        ).toBe('2026-11-13');
    });

    it('장중(프리웜 첫 창 20:30 UTC = 15:30 ET)은 받지 않는다', () => {
        expect(
            recordableSessionDate(
                US_EQUITY_SESSION,
                new Date('2026-11-13T20:30:00Z'),
                SETTLE
            )
        ).toBeNull();
    });

    it('마감 직후 정착 시간 안은 받지 않는다', () => {
        expect(
            recordableSessionDate(
                US_EQUITY_SESSION,
                new Date('2026-11-13T21:05:00Z'),
                SETTLE
            )
        ).toBeNull();
    });

    it('ET 자정을 넘긴 시각(다음 날)은 받지 않는다', () => {
        expect(
            recordableSessionDate(
                US_EQUITY_SESSION,
                new Date('2026-11-14T05:10:00Z'),
                SETTLE
            )
        ).toBeNull();
    });

    it('주말에는 받지 않는다(마지막 세션은 금요일이다)', () => {
        expect(
            recordableSessionDate(
                US_EQUITY_SESSION,
                new Date('2026-11-14T22:00:00Z'),
                SETTLE
            )
        ).toBeNull();
    });
});

describe('recordableSessionDate — 한국(KST)', () => {
    // KRX 마감 15:30 KST = 06:30 UTC. 시세 지연 20분 + 정착 15분 = 35분.
    it('마감 + 35분 뒤면 그날 세션이다', () => {
        expect(
            recordableSessionDate(
                KR_EQUITY_SESSION,
                new Date('2026-11-13T07:10:00Z'),
                35
            )
        ).toBe('2026-11-13');
    });

    it('마감 + 35분 전(지연 시세가 마감가를 아직 못 실었을 수 있다)은 받지 않는다', () => {
        expect(
            recordableSessionDate(
                KR_EQUITY_SESSION,
                new Date('2026-11-13T06:55:00Z'),
                35
            )
        ).toBeNull();
    });

    it('정규장 중(05:00 UTC = 14:00 KST)은 받지 않는다', () => {
        expect(
            recordableSessionDate(
                KR_EQUITY_SESSION,
                new Date('2026-11-13T05:00:00Z'),
                35
            )
        ).toBeNull();
    });
});

describe('recordableSessionDate — 24시간 시장', () => {
    it('always-open은 마감이 없어 받지 않는다', () => {
        expect(
            recordableSessionDate(
                { kind: 'always-open' },
                new Date('2026-11-13T21:20:00Z'),
                SETTLE
            )
        ).toBeNull();
    });
});

describe('continuationFloor', () => {
    it('직전 거래 세션이다 — 월요일의 직전은 금요일', () => {
        expect(continuationFloor(US_EQUITY_SESSION, '2026-11-16')).toBe(
            '2026-11-13'
        );
    });
});

function signal(
    type: Signal['type'],
    phase: Signal['phase'] = 'confirmed',
    direction: Signal['direction'] = 'bullish'
): Signal {
    return { type, phase, direction, detectedAt: 0 };
}

const RESULT: SectorSignalsResult = {
    computedAt: '2026-11-13T21:20:00.000Z',
    stocks: [
        {
            symbol: 'NVDA',
            koreanName: '엔비디아',
            sectorSymbol: 'XLK',
            price: 100,
            changePercent: 2.5,
            trend: 'uptrend',
            signals: [
                signal('golden_cross'),
                signal('bollinger_squeeze_bullish', 'expected'),
                signal('rsi_overbought', 'confirmed', 'bearish'),
            ],
        },
        {
            symbol: 'AAPL',
            koreanName: '',
            sectorSymbol: 'XLK',
            price: 200,
            changePercent: -1,
            trend: 'sideways',
            signals: [signal('golden_cross')],
        },
    ],
};

const BASE = {
    result: RESULT,
    market: 'us',
    sessionDate: '2026-11-13',
} as const;

describe('planSignalEpisodes', () => {
    it('이어진 에피소드가 없으면 확정 신호마다 새 에피소드를 연다', () => {
        const plan = planSignalEpisodes({ ...BASE, openKeys: [] });

        expect(plan.extends).toEqual([]);
        expect(plan.inserts).toEqual([
            {
                market: 'us',
                sessionDate: '2026-11-13',
                symbol: 'NVDA',
                signalType: 'golden_cross',
                direction: 'bullish',
                changePercent: 2.5,
                priceAtDetection: 100,
                koreanName: '엔비디아',
                computedAt: '2026-11-13T21:20:00.000Z',
            },
            expect.objectContaining({
                symbol: 'NVDA',
                signalType: 'rsi_overbought',
                direction: 'bearish',
            }),
            expect.objectContaining({
                symbol: 'AAPL',
                signalType: 'golden_cross',
                koreanName: null,
            }),
        ]);
    });

    it('예상 단계 신호는 기록하지 않는다', () => {
        const plan = planSignalEpisodes({ ...BASE, openKeys: [] });

        expect(
            plan.inserts.some(
                row => row.signalType === 'bollinger_squeeze_bullish'
            )
        ).toBe(false);
    });

    it('직전 세션까지 이어진 (종목, 신호)는 새로 열지 않고 마지막 포착일만 늘린다 — 며칠째 과매수여도 한 행', () => {
        const plan = planSignalEpisodes({
            ...BASE,
            openKeys: [{ symbol: 'NVDA', signalType: 'rsi_overbought' }],
        });

        expect(plan.extends).toEqual([
            { symbol: 'NVDA', signalType: 'rsi_overbought' },
        ]);
        expect(
            plan.inserts.map(row => `${row.symbol}:${row.signalType}`)
        ).toEqual(['NVDA:golden_cross', 'AAPL:golden_cross']);
    });

    it('스캐너가 같은 종목을 두 섹터에 실어도 (종목, 신호)당 한 번이다', () => {
        const aapl = RESULT.stocks[1]!;
        const plan = planSignalEpisodes({
            ...BASE,
            result: { ...RESULT, stocks: [aapl, aapl] },
            openKeys: [],
        });

        expect(plan.inserts).toHaveLength(1);
    });

    it('스캐너가 보고한 가격을 첫 포착 가격으로 복사한다', () => {
        const plan = planSignalEpisodes({ ...BASE, openKeys: [] });

        expect(
            plan.inserts.map(row => `${row.symbol}:${row.priceAtDetection}`)
        ).toEqual(['NVDA:100', 'NVDA:100', 'AAPL:200']);
    });

    it.each([
        ['NaN', Number.NaN],
        ['Infinity', Number.POSITIVE_INFINITY],
        ['0', 0],
        ['음수', -5],
    ])('가격이 %s면 null로 남긴다', (_label, price) => {
        const plan = planSignalEpisodes({
            ...BASE,
            result: {
                ...RESULT,
                stocks: [
                    {
                        symbol: 'AAPL',
                        koreanName: '',
                        sectorSymbol: 'XLK',
                        price,
                        changePercent: -1,
                        trend: 'sideways',
                        signals: [signal('golden_cross')],
                    },
                ],
            },
            openKeys: [],
        });

        expect(plan.inserts).toHaveLength(1);
        expect(plan.inserts[0]?.priceAtDetection).toBeNull();
    });

    it('이어진 에피소드의 plan에는 가격이 없다 — 첫 포착 가격을 덮어쓰지 않는다', () => {
        const plan = planSignalEpisodes({
            ...BASE,
            openKeys: [{ symbol: 'AAPL', signalType: 'golden_cross' }],
        });

        expect(plan.extends).toEqual([
            { symbol: 'AAPL', signalType: 'golden_cross' },
        ]);
        expect(plan.extends[0]).not.toHaveProperty('priceAtDetection');
    });
});

describe('SIGNAL_SETTLE_MINUTES', () => {
    it('미국은 15분, 한국은 시세 지연을 더해 35분이다', () => {
        expect(SIGNAL_SETTLE_MINUTES).toEqual({ us: 15, kr: 35 });
    });
});
