import type { Bar } from '@y0ngha/siglens-core';
import { PRICE_ALERT_SCALE_GUARD } from '@/entities/mail-alert/lib/priceAlertConstants';
import type { PriceAlertRecord } from '@/shared/db/types';
import type { ExpectedSessions } from '../collectAlertSources';
import {
    evaluatePriceAlerts,
    type PriceAlertEvaluationDeps,
} from '../evaluatePriceAlerts';

/** 미국·한국 모두 2026-11-24(화)까지 마감된 날이다. */
const EXPECTED: ExpectedSessions = {
    signals: { us: '2026-11-24', kr: '2026-11-24' },
    fearGreed: { us: '2026-11-24', kr: '2026-11-24', crypto: '2026-11-24' },
};

const bar = (session: string, close: number): Bar => ({
    time: Date.parse(`${session}T00:00:00Z`) / 1000,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1000,
});

function alert(overrides: Partial<PriceAlertRecord> = {}): PriceAlertRecord {
    return {
        id: 'alert-1',
        subscriberId: 'sub-1',
        proposalId: 'proposal-1',
        symbol: 'AAPL',
        market: 'us',
        condition: { kind: 'close_below', level: 180 },
        basis: 'price_level',
        analysisAt: null,
        referenceClose: 190,
        startsAfterSession: '2026-11-20',
        expiresOn: '2026-12-20',
        status: 'active',
        firedSession: null,
        firedClose: null,
        firedAt: null,
        createdAt: new Date('2026-11-20T03:00:00Z'),
        ...overrides,
    };
}

function harness(barsBySymbol: Record<string, Bar[] | Error>) {
    const loadDailyBars = vi.fn(async (symbol: string) => {
        const bars = barsBySymbol[symbol];
        if (bars instanceof Error) throw bars;
        return bars ?? [];
    });
    const deps: PriceAlertEvaluationDeps = { loadDailyBars };
    return { deps, loadDailyBars };
}

const bySubscriber = (...alerts: PriceAlertRecord[]) =>
    alerts.reduce(
        (map, item) =>
            map.set(item.subscriberId, [
                ...(map.get(item.subscriberId) ?? []),
                item,
            ]),
        new Map<string, PriceAlertRecord[]>()
    );

describe('evaluatePriceAlerts', () => {
    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('만든 세션 다음 세션부터 조건을 처음 충족한 종가의 세션과 종가를 돌려준다', async () => {
        const { deps } = harness({
            AAPL: [
                bar('2026-11-20', 170),
                bar('2026-11-23', 185),
                bar('2026-11-24', 179.5),
            ],
        });

        const result = await evaluatePriceAlerts(
            deps,
            bySubscriber(alert()),
            EXPECTED
        );

        expect(result.fires.get('sub-1')).toEqual([
            expect.objectContaining({
                kind: 'price_alert',
                alertId: 'alert-1',
                symbol: 'AAPL',
                firedSession: '2026-11-24',
                firedClose: 179.5,
                zonePosition: null,
            }),
        ]);
        expect(result.active).toBe(1);
        expect(result.voids.size).toBe(0);
        expect(result.barErrors).toBe(0);
    });

    it('만든 날 이전·당일의 종가는 세지 않는다(startsAfterSession 이후만)', async () => {
        const { deps } = harness({
            AAPL: [
                bar('2026-11-19', 150),
                bar('2026-11-20', 150),
                bar('2026-11-23', 185),
                bar('2026-11-24', 186),
            ],
        });

        const result = await evaluatePriceAlerts(
            deps,
            bySubscriber(alert()),
            EXPECTED
        );

        expect(result.fires.size).toBe(0);
    });

    it('이번 실행이 말한 기대 세션보다 뒤의 봉은 보지 않는다', async () => {
        const { deps } = harness({
            AAPL: [bar('2026-11-24', 185), bar('2026-11-25', 100)],
        });

        const result = await evaluatePriceAlerts(
            deps,
            bySubscriber(alert()),
            EXPECTED
        );

        expect(result.fires.size).toBe(0);
    });

    it('만료일 이후의 종가는 세지 않고 만료일 당일 종가는 센다', async () => {
        const expired = harness({
            AAPL: [bar('2026-11-23', 185), bar('2026-11-24', 150)],
        });
        const onExpiry = harness({
            AAPL: [bar('2026-11-23', 185), bar('2026-11-24', 150)],
        });

        const after = await evaluatePriceAlerts(
            expired.deps,
            bySubscriber(alert({ expiresOn: '2026-11-23' })),
            EXPECTED
        );
        const same = await evaluatePriceAlerts(
            onExpiry.deps,
            bySubscriber(alert({ expiresOn: '2026-11-24' })),
            EXPECTED
        );

        expect(after.fires.size).toBe(0);
        expect(same.fires.get('sub-1')?.[0]?.firedSession).toBe('2026-11-24');
    });

    it('이전 실행이 놓친 날의 종가도 원래 세션 날짜로 다시 찾는다(상태 없는 재판정)', async () => {
        const { deps } = harness({
            AAPL: [bar('2026-11-23', 178), bar('2026-11-24', 190)],
        });

        const result = await evaluatePriceAlerts(
            deps,
            bySubscriber(alert()),
            EXPECTED
        );

        expect(result.fires.get('sub-1')?.[0]).toEqual(
            expect.objectContaining({
                firedSession: '2026-11-23',
                firedClose: 178,
            })
        );
    });

    it('구간 알림은 코어가 판정한 종가의 위치를 함께 돌려준다(구간을 건너뛴 갭도 충족)', async () => {
        const zone = {
            kind: 'enter_zone',
            low: 176,
            high: 181,
            approach: 'from_above',
        } as const;
        const inside = harness({ AAPL: [bar('2026-11-23', 179)] });
        const gap = harness({ AAPL: [bar('2026-11-23', 172)] });

        const insideResult = await evaluatePriceAlerts(
            inside.deps,
            bySubscriber(alert({ condition: zone })),
            EXPECTED
        );
        const gapResult = await evaluatePriceAlerts(
            gap.deps,
            bySubscriber(alert({ condition: zone })),
            EXPECTED
        );

        expect(insideResult.fires.get('sub-1')?.[0]?.zonePosition).toBe(
            'inside'
        );
        expect(gapResult.fires.get('sub-1')?.[0]?.zonePosition).toBe('below');
    });

    it('위로 올라가는 알림(close_above)도 판정한다', async () => {
        const { deps } = harness({ AAPL: [bar('2026-11-23', 205)] });

        const result = await evaluatePriceAlerts(
            deps,
            bySubscriber(
                alert({ condition: { kind: 'close_above', level: 200 } })
            ),
            EXPECTED
        );

        expect(result.fires.get('sub-1')?.[0]?.firedClose).toBe(205);
    });

    it('시장별 기대 세션을 쓴다: 한국 알림은 한국 기대 세션까지만 본다', async () => {
        const { deps } = harness({
            '005930.KS': [bar('2026-11-23', 71000), bar('2026-11-24', 69000)],
        });

        const result = await evaluatePriceAlerts(
            deps,
            bySubscriber(
                alert({
                    symbol: '005930.KS',
                    market: 'kr',
                    condition: { kind: 'close_below', level: 70000 },
                    referenceClose: 72000,
                })
            ),
            {
                ...EXPECTED,
                signals: { us: '2026-11-24', kr: '2026-11-23' },
            }
        );

        expect(result.fires.size).toBe(0);
    });

    describe('척도 가드', () => {
        /** 알림은 11-20(만든 세션)에 190으로 만들어졌다. */
        const REF = bar('2026-11-20', 190);

        it('2:1 분할로 만든 세션의 종가가 소급 조정돼 있으면(95) 끝낼 알림으로 돌려주고 발송에 싣지 않는다', async () => {
            const { deps } = harness({
                AAPL: [bar('2026-11-20', 95), bar('2026-11-23', 94)],
            });

            const result = await evaluatePriceAlerts(
                deps,
                bySubscriber(alert({ referenceClose: 190 })),
                EXPECTED
            );

            expect(result.voids.get('sub-1')).toEqual([
                {
                    kind: 'price_alert_voided',
                    alertId: 'alert-1',
                    symbol: 'AAPL',
                },
            ]);
            expect(result.fires.size).toBe(0);
        });

        it('분할이 없는 실제 급락(만든 세션 190, 다음 세션 100)은 끝내지 않고 조건 충족으로 센다', async () => {
            const { deps } = harness({
                AAPL: [REF, bar('2026-11-23', 100)],
            });

            const result = await evaluatePriceAlerts(
                deps,
                bySubscriber(alert({ referenceClose: 190 })),
                EXPECTED
            );

            expect(result.voids.size).toBe(0);
            expect(result.fires.get('sub-1')?.[0]).toEqual(
                expect.objectContaining({ firedClose: 100 })
            );
        });

        it('분할이 아직 새 봉에 닿기 전이어도(판정할 봉이 없다) 만든 세션 종가가 조정돼 있으면 끝낸다', async () => {
            const { deps } = harness({ AAPL: [bar('2026-11-20', 95)] });

            const result = await evaluatePriceAlerts(
                deps,
                bySubscriber(alert({ referenceClose: 190 })),
                EXPECTED
            );

            expect(result.voids.size).toBe(1);
        });

        it.each([
            {
                name: '아래 경계 바로 안쪽',
                close: 190 * PRICE_ALERT_SCALE_GUARD.min + 0.01,
                voided: false,
            },
            {
                name: '아래 경계 바로 바깥',
                close: 190 * PRICE_ALERT_SCALE_GUARD.min - 0.01,
                voided: true,
            },
            {
                name: '위 경계 바로 안쪽',
                close: 190 * PRICE_ALERT_SCALE_GUARD.max - 0.01,
                voided: false,
            },
            {
                name: '위 경계 바로 바깥',
                close: 190 * PRICE_ALERT_SCALE_GUARD.max + 0.01,
                voided: true,
            },
        ])('$name에서 voided=$voided', async ({ close, voided }) => {
            const { deps } = harness({
                AAPL: [bar('2026-11-20', close), bar('2026-11-23', close)],
            });

            const result = await evaluatePriceAlerts(
                deps,
                bySubscriber(alert({ referenceClose: 190 })),
                EXPECTED
            );

            expect(result.voids.size).toBe(voided ? 1 : 0);
        });

        it('만든 세션의 봉이 시리즈에 없으면 비교할 근거가 없어 끝내지 않는다', async () => {
            const { deps } = harness({
                AAPL: [bar('2026-11-19', 95), bar('2026-11-23', 94)],
            });

            const result = await evaluatePriceAlerts(
                deps,
                bySubscriber(alert({ referenceClose: 190 })),
                EXPECTED
            );

            expect(result.voids.size).toBe(0);
        });

        it('끝낼 알림이 있어도 같은 구독자의 다른 종목 알림 판정은 계속된다', async () => {
            const { deps } = harness({
                AAPL: [bar('2026-11-20', 95), bar('2026-11-23', 94)],
                MSFT: [bar('2026-11-23', 400)],
            });

            const result = await evaluatePriceAlerts(
                deps,
                bySubscriber(
                    alert(),
                    alert({
                        id: 'alert-2',
                        symbol: 'MSFT',
                        referenceClose: 410,
                        condition: { kind: 'close_below', level: 405 },
                    })
                ),
                EXPECTED
            );

            expect(
                result.voids.get('sub-1')?.map(item => item.alertId)
            ).toEqual(['alert-1']);
            expect(
                result.fires.get('sub-1')?.map(item => item.alertId)
            ).toEqual(['alert-2']);
        });
    });

    it('종가가 유한한 양수가 아닌 봉은 건너뛴다(손상된 봉이 알림을 켜거나 가리지 않는다)', async () => {
        const { deps } = harness({
            AAPL: [bar('2026-11-23', Number.NaN), bar('2026-11-24', 0)],
        });

        const result = await evaluatePriceAlerts(
            deps,
            bySubscriber(alert()),
            EXPECTED
        );

        expect(result.fires.size).toBe(0);
        expect(result.voids.size).toBe(0);
    });

    it('같은 종목의 알림이 여럿이어도 일봉은 한 번만 읽는다', async () => {
        const { deps, loadDailyBars } = harness({
            AAPL: [bar('2026-11-23', 170)],
        });

        const result = await evaluatePriceAlerts(
            deps,
            bySubscriber(
                alert(),
                alert({
                    id: 'alert-2',
                    condition: { kind: 'close_below', level: 175 },
                }),
                alert({
                    id: 'alert-3',
                    subscriberId: 'sub-2',
                    condition: { kind: 'close_below', level: 100 },
                })
            ),
            EXPECTED
        );

        expect(loadDailyBars).toHaveBeenCalledTimes(1);
        expect(result.active).toBe(3);
        expect(result.fires.get('sub-1')?.map(item => item.alertId)).toEqual([
            'alert-1',
            'alert-2',
        ]);
        expect(result.fires.has('sub-2')).toBe(false);
    });

    it('한 종목의 일봉 읽기가 실패해도 그 종목만 건너뛰고 나머지를 판정한다', async () => {
        const { deps } = harness({
            AAPL: new Error('bars down'),
            MSFT: [bar('2026-11-23', 400)],
        });

        const result = await evaluatePriceAlerts(
            deps,
            bySubscriber(
                alert(),
                alert({
                    id: 'alert-2',
                    symbol: 'MSFT',
                    referenceClose: 410,
                    condition: { kind: 'close_below', level: 405 },
                })
            ),
            EXPECTED
        );

        expect(result.barErrors).toBe(1);
        expect(result.fires.get('sub-1')?.map(item => item.alertId)).toEqual([
            'alert-2',
        ]);
    });

    it('진행 중인 알림이 없으면 아무것도 읽지 않는다', async () => {
        const { deps, loadDailyBars } = harness({});

        const result = await evaluatePriceAlerts(deps, new Map(), EXPECTED);

        expect(loadDailyBars).not.toHaveBeenCalled();
        expect(result).toEqual({
            fires: new Map(),
            active: 0,
            voids: new Map(),
            barErrors: 0,
            notReady: new Map(),
        });
    });

    describe('준비 여부(notReady)', () => {
        it('기대 세션의 봉이 있으면 준비된 것이다', async () => {
            const { deps } = harness({
                AAPL: [bar('2026-11-23', 185), bar('2026-11-24', 186)],
            });

            const result = await evaluatePriceAlerts(
                deps,
                bySubscriber(alert()),
                EXPECTED
            );

            expect(result.notReady.size).toBe(0);
        });

        it('기대 세션의 봉이 아직 없으면 그 구독자의 그 종목이 준비되지 않은 것이다(판정은 받은 봉까지 한다)', async () => {
            const { deps } = harness({
                AAPL: [bar('2026-11-21', 185), bar('2026-11-23', 179)],
            });

            const result = await evaluatePriceAlerts(
                deps,
                bySubscriber(alert()),
                EXPECTED
            );

            expect(result.notReady).toEqual(
                new Map([['sub-1', new Set(['AAPL'])]])
            );
            expect(result.fires.get('sub-1')?.[0]?.firedSession).toBe(
                '2026-11-23'
            );
        });

        it('일봉을 못 읽은 종목도 준비되지 않은 것이다', async () => {
            const { deps } = harness({ AAPL: new Error('boom') });

            const result = await evaluatePriceAlerts(
                deps,
                bySubscriber(
                    alert(),
                    alert({ id: 'b', subscriberId: 'sub-2' })
                ),
                EXPECTED
            );

            expect(result.notReady).toEqual(
                new Map([
                    ['sub-1', new Set(['AAPL'])],
                    ['sub-2', new Set(['AAPL'])],
                ])
            );
        });

        it('기대 세션 전에 끝난 알림은 만료일의 봉까지만 있으면 된다', async () => {
            const { deps } = harness({
                AAPL: [bar('2026-11-21', 185), bar('2026-11-23', 185)],
            });

            const result = await evaluatePriceAlerts(
                deps,
                bySubscriber(alert({ expiresOn: '2026-11-23' })),
                EXPECTED
            );

            expect(result.notReady.size).toBe(0);
        });
    });
});
