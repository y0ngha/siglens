import type { SignalDirection, SignalType } from '@y0ngha/siglens-core';
import { addUtcIsoDays } from '@/shared/lib/isoDate';
import type { OpenEpisode, SymbolScanWrite } from '../../types';
import {
    planSymbolScan,
    type PlanSymbolScanInput,
    type ScanDay,
} from '../planSymbolScan';

const START = '2026-03-02';
const COMPUTED_AT = '2026-11-20T21:20:00.000Z';
const CUTOVER = '2026-12-01T00:00:00.000Z';

const dateAt = (offset: number): string => addUtcIsoDays(START, offset);

interface DaySpec {
    readonly types?: readonly SignalType[] | null;
    readonly close?: number;
    readonly changePercent?: number | null;
}

function day(offset: number, spec: DaySpec = {}): ScanDay {
    const types = spec.types === undefined ? [] : spec.types;
    return {
        sessionDate: dateAt(offset),
        close: spec.close ?? 100,
        changePercent:
            spec.changePercent === undefined ? 1.5 : spec.changePercent,
        signals:
            types === null
                ? null
                : types.map(type => ({
                      type,
                      direction: 'bullish' as SignalDirection,
                  })),
    };
}

function plan(
    days: readonly ScanDay[],
    overrides: Partial<PlanSymbolScanInput> = {}
): SymbolScanWrite {
    return planSymbolScan({
        market: 'us',
        symbol: 'NVDA',
        koreanName: '엔비디아',
        days,
        open: [],
        rebuildFrom: null,
        relabelCutover: null,
        computedAt: COMPUTED_AT,
        ...overrides,
    });
}

function openRow(
    signalType: string,
    startOffset: number,
    lastSeenOffset: number
): OpenEpisode {
    return {
        signalType,
        sessionDate: dateAt(startOffset),
        lastSeenSession: dateAt(lastSeenOffset),
    };
}

describe('planSymbolScan', () => {
    it('날이 없으면 세션을 정할 수 없어 던진다', () => {
        expect(() => plan([])).toThrow('at least one day');
    });

    it('이어진 에피소드가 없으면 확정 신호마다 새 에피소드를 열고 그날 값을 담는다', () => {
        const write = plan([
            day(0, {
                types: ['golden_cross', 'rsi_overbought'],
                close: 123.4,
                changePercent: 2.5,
            }),
        ]);

        expect(write.session).toBe(dateAt(0));
        expect(write.lastSeenUpdates).toEqual([]);
        expect(write.inserts).toEqual([
            {
                market: 'us',
                sessionDate: dateAt(0),
                lastSeenSession: dateAt(0),
                symbol: 'NVDA',
                signalType: 'golden_cross',
                direction: 'bullish',
                changePercent: 2.5,
                priceAtDetection: 123.4,
                koreanName: '엔비디아',
                computedAt: COMPUTED_AT,
            },
            expect.objectContaining({ signalType: 'rsi_overbought' }),
        ]);
    });

    it('등락률을 알 수 없으면 0, 종가가 양수가 아니면 가격은 null이다', () => {
        const write = plan([
            day(0, { types: ['golden_cross'], close: 0, changePercent: null }),
            day(1, { types: [], close: Number.NaN }),
        ]);

        expect(write.inserts).toEqual([
            expect.objectContaining({
                changePercent: 0,
                priceAtDetection: null,
            }),
        ]);
    });

    it('직전 세션까지 이어진 에피소드는 새로 열지 않고 마지막 포착 세션만 늘린다', () => {
        const write = plan([day(5, { types: ['golden_cross'] })], {
            open: [openRow('golden_cross', 2, 4)],
        });

        expect(write.inserts).toEqual([]);
        expect(write.lastSeenUpdates).toEqual([
            {
                signalType: 'golden_cross',
                sessionDate: dateAt(2),
                lastSeenSession: dateAt(5),
            },
        ]);
    });

    it('이어지던 신호가 첫날 없으면 끝난 것이다 — 갱신도 새 행도 없다', () => {
        const write = plan([day(5, { types: ['rsi_overbought'] })], {
            open: [openRow('golden_cross', 2, 4)],
        });

        expect(write.lastSeenUpdates).toEqual([]);
        expect(write.inserts.map(row => row.signalType)).toEqual([
            'rsi_overbought',
        ]);
    });

    it('중간에 끝난 에피소드는 끝난 날까지의 마지막 포착 세션으로 남고, 다시 잡히면 새 에피소드다', () => {
        const write = plan([
            day(0, { types: ['golden_cross'] }),
            day(1, { types: ['golden_cross'] }),
            day(2, { types: [] }),
            day(3, { types: ['golden_cross'] }),
        ]);

        expect(
            write.inserts.map(row => [row.sessionDate, row.lastSeenSession])
        ).toEqual([
            [dateAt(0), dateAt(1)],
            [dateAt(3), dateAt(3)],
        ]);
    });

    it('판정할 수 없는 날은 신호 없음이 아니다 — 이어지던 에피소드를 끊지 않고 그날까지 늘린다', () => {
        const write = plan(
            [
                day(5, { types: null }),
                day(6, { types: ['golden_cross', 'rsi_oversold'] }),
            ],
            { open: [openRow('golden_cross', 2, 4)] }
        );

        expect(write.lastSeenUpdates).toEqual([
            {
                signalType: 'golden_cross',
                sessionDate: dateAt(2),
                lastSeenSession: dateAt(6),
            },
        ]);
        expect(write.inserts.map(row => row.signalType)).toEqual([
            'rsi_oversold',
        ]);
    });

    it('판정할 수 없는 날에 이어지던 것이 없으면 아무것도 만들지 않는다', () => {
        const write = plan([day(0, { types: null })]);

        expect(write.inserts).toEqual([]);
        expect(write.lastSeenUpdates).toEqual([]);
        expect(write.session).toBe(dateAt(0));
    });

    it('오늘 하루가 판정 불가여도 이어지던 에피소드는 열린 채로 둔다(새 행으로 다시 열리지 않게)', () => {
        const unknownToday = plan([day(5, { types: null })], {
            open: [openRow('rsi_overbought', 1, 4)],
        });

        expect(unknownToday.lastSeenUpdates).toEqual([
            {
                signalType: 'rsi_overbought',
                sessionDate: dateAt(1),
                lastSeenSession: dateAt(5),
            },
        ]);
    });

    it('같은 날 같은 신호가 둘이어도 한 에피소드다', () => {
        const write = plan([
            {
                ...day(0),
                signals: [
                    { type: 'golden_cross', direction: 'bullish' },
                    { type: 'golden_cross', direction: 'bullish' },
                ],
            },
        ]);

        expect(write.inserts).toHaveLength(1);
    });

    it('같은 신호의 열린 행이 둘이면 더 최근에 시작한 행을 이어 간다', () => {
        const write = plan([day(6, { types: ['golden_cross'] })], {
            open: [
                openRow('golden_cross', 4, 5),
                openRow('golden_cross', 1, 5),
            ],
        });

        expect(write.lastSeenUpdates).toEqual([
            {
                signalType: 'golden_cross',
                sessionDate: dateAt(4),
                lastSeenSession: dateAt(6),
            },
        ]);
    });

    it('재계산 구간 이후에 시작한 기존 행은 이어 가지 않는다(지우고 다시 만든다) — 그 이전에 시작한 행만 이어 간다', () => {
        const write = plan(
            [
                day(10, { types: ['golden_cross', 'rsi_oversold'] }),
                day(11, { types: ['golden_cross', 'rsi_oversold'] }),
            ],
            {
                rebuildFrom: dateAt(10),
                relabelCutover: CUTOVER,
                open: [
                    openRow('golden_cross', 3, 9),
                    openRow('rsi_oversold', 10, 9),
                ],
            }
        );

        expect(write.rebuildFrom).toBe(dateAt(10));
        expect(write.relabelCutover).toBe(CUTOVER);
        expect(write.lastSeenUpdates).toEqual([
            {
                signalType: 'golden_cross',
                sessionDate: dateAt(3),
                lastSeenSession: dateAt(11),
            },
        ]);
        expect(
            write.inserts.map(row => [row.signalType, row.sessionDate])
        ).toEqual([['rsi_oversold', dateAt(10)]]);
    });

    it('이름 바꾸기 이후의 이름으로 열린 행을 이어 간다(단기 이평 교차)', () => {
        const write = plan([day(10, { types: ['short_ma_bullish_cross'] })], {
            rebuildFrom: dateAt(10),
            relabelCutover: CUTOVER,
            open: [openRow('short_ma_bullish_cross', 4, 9)],
        });

        expect(write.inserts).toEqual([]);
        expect(write.lastSeenUpdates).toEqual([
            {
                signalType: 'short_ma_bullish_cross',
                sessionDate: dateAt(4),
                lastSeenSession: dateAt(10),
            },
        ]);
    });
});

/** 재계산 = 라이브 검증용 DB 흉내 — 쓰기 묶음을 같은 규칙(삽입은 충돌 무시, 갱신은 늘리기만)으로 반영한다. */
type Table = ReadonlyMap<
    string,
    { lastSeen: string; direction: string; change: number }
>;

function applyWrite(table: Table, write: SymbolScanWrite): Table {
    const withInserts = new Map([
        ...write.inserts.map(
            row =>
                [
                    `${row.signalType}|${row.sessionDate}`,
                    {
                        lastSeen: row.lastSeenSession,
                        direction: row.direction,
                        change: row.changePercent,
                    },
                ] as const
        ),
        ...table,
    ]);
    return new Map(
        [...withInserts].map(([key, value]) => {
            const update = write.lastSeenUpdates.find(
                u => `${u.signalType}|${u.sessionDate}` === key
            );
            return [
                key,
                update !== undefined && update.lastSeenSession > value.lastSeen
                    ? { ...value, lastSeen: update.lastSeenSession }
                    : value,
            ] as const;
        })
    );
}

function openFrom(table: Table, floor: string): OpenEpisode[] {
    return [...table]
        .filter(([, value]) => value.lastSeen >= floor)
        .map(([key, value]) => {
            const [signalType = '', sessionDate = ''] = key.split('|');
            return {
                signalType,
                sessionDate,
                lastSeenSession: value.lastSeen,
            };
        });
}

/** 결정적 의사 난수(LCG) — 신호가 켜졌다 꺼졌다 하고 가끔 판정 불가인 타임라인. */
function generatedTimeline(length: number): readonly ScanDay[] {
    const types: readonly SignalType[] = [
        'golden_cross',
        'rsi_oversold',
        'rsi_overbought',
        'macd_bullish_cross',
        'new_52w_high',
        'short_ma_bullish_cross',
    ];
    const seeds = Array.from(
        { length },
        (_, i) => (i * 1_103_515_245 + 12_345) % 2_147_483_648
    );
    return seeds.map((seed, i) => {
        const roll = (seed >>> 8) % 100;
        if (roll < 6) return day(i, { types: null });
        const on = types.filter((_, t) => ((seed >>> (t + 3)) & 3) !== 0);
        return day(i, {
            types: on,
            close: 50 + (seed % 97),
            changePercent: ((seed >>> 5) % 700) / 100 - 3.5,
        });
    });
}

describe('planSymbolScan — 재계산 = 라이브(G4)', () => {
    const timeline = generatedTimeline(150);
    const warmUp = timeline.slice(0, 30);
    const span = timeline.slice(30);

    const oneDayAtATime = (from: Table): Table =>
        span.reduce((table, spanDay, i) => {
            const previous = i === 0 ? warmUp.at(-1) : span[i - 1];
            return applyWrite(
                table,
                plan([spanDay], {
                    open: openFrom(table, previous?.sessionDate ?? ''),
                })
            );
        }, from);

    const warmedUp: Table = warmUp.reduce(
        (table, warmDay, i) =>
            applyWrite(
                table,
                plan([warmDay], {
                    open: openFrom(table, warmUp[i - 1]?.sessionDate ?? ''),
                })
            ),
        new Map() as Table
    );

    it('120일을 한 번에 계획한 결과는 하루씩 120번 계획해 이어 붙인 결과와 같다', () => {
        const live = oneDayAtATime(warmedUp);
        const batch = applyWrite(
            warmedUp,
            plan(span, {
                open: openFrom(warmedUp, warmUp.at(-1)?.sessionDate ?? ''),
            })
        );

        expect([...batch].toSorted()).toEqual([...live].toSorted());
        expect(live.size).toBeGreaterThan(40);
    });

    it('한 번에 계획한 쓰기는 같은 (신호, 첫 세션)을 두 번 넣지 않는다 — 끝난 에피소드도 최종 날짜로 한 행이다', () => {
        const batch = plan(span, {
            open: openFrom(warmedUp, warmUp.at(-1)?.sessionDate ?? ''),
        });

        expect(batch.inserts.length).toBeGreaterThan(10);
        expect(
            new Set(batch.inserts.map(r => `${r.signalType}${r.sessionDate}`))
                .size
        ).toBe(batch.inserts.length);
    });
});
