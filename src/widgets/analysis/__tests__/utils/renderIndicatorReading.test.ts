import type {
    CycleReading,
    IndicatorCardKind,
    IndicatorCardStates,
    IndicatorCardValues,
    IndicatorReading,
    SignalType,
} from '@y0ngha/siglens-core';
import { CYCLE_LOOKBACK_BARS, MA_CYCLE_PERIODS } from '@y0ngha/siglens-core';
import { describe, expect, it } from 'vitest';
import { LOCALES, type Locale } from '@/shared/i18n/locales';
import { MESSAGE_CATALOGS } from '@/shared/test-utils/messageCatalogs';
import {
    CYCLE_HISTORY_KEYS,
    CYCLE_SLOPE_KEYS,
    CYCLE_STAGE_NAME_KEYS,
    CYCLE_TEXT_KEYS,
    ELDER_IMPULSE_KEYS,
    INDICATOR_TEXT_KEYS,
    formatReadingNumber,
    renderCycleReading,
    renderIndicatorReading,
} from '@/widgets/analysis/utils/renderIndicatorReading';
import { readingContextFor } from './readingContext';

/**
 * 종류마다 reading이 싣는 값 키 — core `IndicatorCardValues`에 묶여 있어, core가 키 이름을 바꾸면
 * 여기서 컴파일 에러가 난다(카탈로그 문구가 가리키는 `{이름}`이 어긋나는 걸 막는다).
 */
const VALUE_KEYS: {
    [K in IndicatorCardKind]: readonly IndicatorCardValues[K][];
} = {
    ma: ['close', 'ma5', 'ma20', 'ma60', 'ma120', 'ma200'],
    ema: ['ema9', 'ema20', 'ema21', 'ema60'],
    adx: ['adx', 'diPlus', 'diMinus'],
    atr: ['atr', 'atrPercent'],
    obv: ['obv'],
    volume_profile: ['close', 'poc', 'vah', 'val', 'bars'],
    rsi: ['rsi'],
    macd: ['macd', 'signal', 'histogram'],
    cci: ['cci'],
    cmf: ['cmf'],
    dmi: ['diPlus', 'diMinus', 'adx'],
    ichimoku: ['tenkan', 'kijun', 'senkouA', 'senkouB'],
    mfi: ['mfi'],
    parabolic_sar: ['sar'],
    squeeze_momentum: ['momentum'],
    supertrend: ['supertrend'],
    bollinger_percent_b: ['pctB'],
    stochastic: ['percentK', 'percentD'],
    stoch_rsi: ['k', 'd'],
    williams_r: ['williamsR'],
    connors_rsi: ['crsi'],
    bollinger: ['close', 'upper', 'lower', 'pctB'],
    keltner: ['close', 'upper', 'lower', 'atr'],
    donchian: ['close', 'upper', 'lower'],
    vwap: ['close', 'vwap', 'atr'],
    buy_sell_volume: ['buyRatio'],
    macd_v: ['macdV'],
    force_index: ['forceIndex'],
    elder_ray: ['bullPower', 'bearPower'],
    elder_impulse: [],
    chandelier: ['stop'],
    hurst: ['hurst'],
    variance_ratio: ['varianceRatio'],
    regression: ['r2'],
    yang_zhang: ['sigma'],
    ewma: ['sigma'],
};

const SIGNAL_KINDS = [
    'rsi',
    'macd',
    'cci',
    'cmf',
    'dmi',
    'ichimoku',
    'mfi',
    'parabolic_sar',
    'squeeze_momentum',
    'supertrend',
    'bollinger_percent_b',
] as const satisfies readonly IndicatorCardKind[];

const EVENT_SIGNAL: Record<(typeof SIGNAL_KINDS)[number], SignalType> = {
    rsi: 'rsi_oversold',
    macd: 'macd_bullish_cross',
    cci: 'cci_bullish_cross',
    cmf: 'cmf_bullish_flip',
    dmi: 'dmi_bullish_cross',
    ichimoku: 'ichimoku_cloud_breakout',
    mfi: 'mfi_oversold_bounce',
    parabolic_sar: 'parabolic_sar_flip',
    squeeze_momentum: 'squeeze_momentum_bullish',
    supertrend: 'supertrend_bullish_flip',
    bollinger_percent_b: 'bollinger_percentb_oversold',
};

/** 종류·상태 하나를 reading으로 만든다 — 값은 키마다 서로 다른 소수 하나씩. */
function readingOf<K extends IndicatorCardKind>(
    kind: K,
    state: IndicatorCardStates[K],
    values: Partial<Record<string, number | null>> = {}
): IndicatorReading {
    const base = Object.fromEntries(
        VALUE_KEYS[kind].map((key, index) => [key, 10.5 + index])
    );
    // safe: 종류별 상태·값 키는 `VALUE_KEYS`와 호출부가 맞춘다 — 유니온 전체를 한 함수로 만들려 단언한다.
    return {
        kind,
        basis: SIGNAL_KINDS.includes(kind as (typeof SIGNAL_KINDS)[number])
            ? 'event'
            : 'state',
        state,
        values: { ...base, ...values },
        signals: [],
        ...(kind === 'elder_impulse' ? { flippedFrom: null } : {}),
    } as unknown as IndicatorReading;
}

/** 표의 모든 (종류, 상태) 조합. 이벤트 종류는 상태 하나(발화한 신호). */
const ALL_READINGS: readonly IndicatorReading[] = (
    Object.keys(INDICATOR_TEXT_KEYS) as IndicatorCardKind[]
).flatMap(kind => {
    const entry: string | Readonly<Record<string, string>> =
        INDICATOR_TEXT_KEYS[kind];
    return typeof entry === 'string'
        ? [
              readingOf(
                  kind,
                  EVENT_SIGNAL[kind as keyof typeof EVENT_SIGNAL] as never
              ),
          ]
        : Object.keys(entry).map(state => readingOf(kind, state as never));
});

const flatten = (node: unknown, prefix = ''): Record<string, string> =>
    typeof node === 'object' && node !== null
        ? Object.fromEntries(
              Object.entries(node).flatMap(([key, value]) =>
                  Object.entries(
                      flatten(value, prefix === '' ? key : `${prefix}.${key}`)
                  )
              )
          )
        : { [prefix]: String(node) };

const tableKeys = (): string[] => [
    ...Object.values(INDICATOR_TEXT_KEYS).flatMap(entry =>
        typeof entry === 'string' ? [entry] : Object.values(entry)
    ),
    ...Object.values(ELDER_IMPULSE_KEYS),
    ...Object.values(CYCLE_TEXT_KEYS).flatMap(keys => Object.values(keys)),
    ...Object.values(CYCLE_STAGE_NAME_KEYS),
    ...Object.values(CYCLE_SLOPE_KEYS),
    ...Object.values(CYCLE_HISTORY_KEYS),
];

const catalogKeys = (locale: Locale): string[] =>
    Object.keys(flatten(MESSAGE_CATALOGS[locale].widgets.analysis.reading));

describe('widgets.analysis.reading 카탈로그', () => {
    it.each(LOCALES)(
        '%s: 표의 모든 키가 있고 표에 없는 고아 키가 없다',
        locale => {
            expect(new Set(catalogKeys(locale))).toEqual(new Set(tableKeys()));
        }
    );

    it('상태 키는 `종류.상태`이고 이벤트 키는 `종류.event`다 — 상태를 서로 바꿔 매단 표를 막는다', () => {
        const mismatches = Object.entries(INDICATOR_TEXT_KEYS).flatMap(
            ([kind, entry]) =>
                typeof entry === 'string'
                    ? entry === `${kind}.event`
                        ? []
                        : [`${kind}: ${entry}`]
                    : Object.entries(entry).flatMap(([state, key]) =>
                          key === `${kind}.${state}` ||
                          key === `${kind}.color.${state}`
                              ? []
                              : [`${kind}.${state}: ${key}`]
                      )
        );
        expect(mismatches).toEqual([]);
    });

    it('표의 키는 종류·상태마다 서로 다르다', () => {
        const keys = tableKeys();
        expect(new Set(keys).size).toBe(keys.length);
    });

    it('엘더 임펄스 문장은 색 이름 자리표시자만 쓴다', () => {
        const ko = flatten(MESSAGE_CATALOGS.ko.widgets.analysis.reading);
        expect(ko[ELDER_IMPULSE_KEYS.current]).toContain('{color}');
        expect(ko[ELDER_IMPULSE_KEYS.flipped]).toContain('{from}');
        expect(ko[ELDER_IMPULSE_KEYS.flipped]).toContain('{color}');
    });

    it('문구의 자리표시자는 reading이 싣는 값 이름과 신호·이전 색뿐이다', () => {
        const ko = flatten(MESSAGE_CATALOGS.ko.widgets.analysis.reading);
        const offenders = ALL_READINGS.flatMap(reading => {
            const entry: string | Readonly<Record<string, string>> =
                INDICATOR_TEXT_KEYS[reading.kind];
            const key =
                typeof entry === 'string' ? entry : entry[reading.state];
            const allowed = new Set<string>([
                ...VALUE_KEYS[reading.kind],
                'signals',
                'from',
            ]);
            const used = [
                ...(key === undefined ? '' : (ko[key] ?? '')).matchAll(
                    /\{\s*([A-Za-z0-9_]+)/g
                ),
            ].map(match => match[1]);
            return used
                .filter(name => !allowed.has(name))
                .map(name => `${reading.kind}.${reading.state}: {${name}}`);
        });
        expect(offenders).toEqual([]);
    });
});

describe('renderIndicatorReading', () => {
    it.each(LOCALES)(
        '%s: 모든 종류·상태가 빈 칸·ICU 잔여물 없이 값을 싣는다',
        locale => {
            const context = readingContextFor(locale);
            const failures = ALL_READINGS.flatMap(reading => {
                const text = renderIndicatorReading(reading, context);
                const firstValue = Object.values(reading.values)[0];
                const problems = [
                    text === null ? 'null' : '',
                    text !== null && /[{}]/.test(text) ? 'ICU 잔여물' : '',
                    text !== null &&
                    firstValue !== undefined &&
                    firstValue !== null &&
                    !text.includes(formatReadingNumber(firstValue))
                        ? '값 누락'
                        : '',
                ].filter(problem => problem !== '');
                return problems.map(
                    problem => `${reading.kind}.${reading.state}: ${problem}`
                );
            });
            expect(failures).toEqual([]);
        }
    );

    it('이벤트 카드는 발화한 신호 이름과 찍힌 값을 싣는다 (ko)', () => {
        const reading: IndicatorReading = {
            kind: 'rsi',
            basis: 'event',
            state: 'rsi_oversold',
            values: { rsi: 28.4 },
            signals: [{ type: 'rsi_oversold', phase: 'confirmed', barsAgo: 0 }],
        };
        expect(renderIndicatorReading(reading, readingContextFor('ko'))).toBe(
            'RSI 과매도 (현재 RSI 28.4)'
        );
    });

    it('한 카드에 신호가 둘이면 로케일의 목록 접속으로 잇는다', () => {
        const reading: IndicatorReading = {
            kind: 'macd',
            basis: 'event',
            state: 'macd_bullish_cross',
            values: { macd: 1.25, signal: 1.1, histogram: 0.15 },
            signals: [
                { type: 'macd_bullish_cross', phase: 'confirmed', barsAgo: 0 },
                {
                    type: 'macd_histogram_bullish_convergence',
                    phase: 'confirmed',
                    barsAgo: 1,
                },
            ],
        };
        expect(renderIndicatorReading(reading, readingContextFor('en'))).toBe(
            'MACD bullish cross and MACD histogram convergence (up) (MACD 1.25, signal line 1.1, histogram 0.15)'
        );
    });

    it('찍히지 않은 값(null)은 N/A로 쓴다', () => {
        const text = renderIndicatorReading(
            readingOf('ma', 'mixed', { ma200: null, ma5: null }),
            readingContextFor('ko')
        );
        expect(text).toContain('MA5 N/A');
        expect(text).not.toContain('null');
    });

    it('상태 종류는 같은 종류라도 상태마다 다른 문장이다', () => {
        const context = readingContextFor('ko');
        const texts = (['rising', 'falling', 'flat'] as const).map(state =>
            renderIndicatorReading(readingOf('obv', state), context)
        );
        expect(new Set(texts).size).toBe(3);
        expect(texts[0]).toContain('OBV 10.5');
    });

    it('엘더 임펄스는 색이 바뀐 경우에만 이전 색을 말한다', () => {
        const context = readingContextFor('ko');
        const flipped: IndicatorReading = {
            kind: 'elder_impulse',
            basis: 'state',
            state: 'green',
            values: {} as never,
            signals: [],
            flippedFrom: 'red',
        };
        expect(renderIndicatorReading(flipped, context)).toBe(
            '엘더 임펄스가 빨강에서 초록으로 바뀌었어요'
        );
        expect(
            renderIndicatorReading(readingOf('elder_impulse', 'green'), context)
        ).toBe('엘더 임펄스가 초록이에요');
    });

    it('표에 없는 종류나 상태는 null이라 호출부가 영어 정본으로 물러난다', () => {
        const context = readingContextFor('ko');
        expect(
            renderIndicatorReading(
                // safe: core가 새 종류를 늘렸는데 이 표가 못 따라간 상황을 흉내 낸다.
                { ...readingOf('obv', 'rising'), kind: 'future_kind' } as never,
                context
            )
        ).toBeNull();
        expect(
            renderIndicatorReading(
                // safe: 위와 같다(새 상태).
                readingOf('obv', 'sideways' as never),
                context
            )
        ).toBeNull();
    });
});

describe('formatReadingNumber', () => {
    it.each([
        [28.4, '28.4'],
        [0.0006, '0.0006'],
        [1234567, '1,234,567'],
        [-1.2, '-1.2'],
        [0, '0'],
    ])('%s → %s', (value, expected) => {
        expect(formatReadingNumber(value)).toBe(expected);
    });
});

const cycle = (over: Partial<CycleReading> = {}): CycleReading => ({
    kind: 'ma_cycle',
    stage: 4,
    previousStage: 3,
    barsInStage: 12,
    progression: 'forward',
    stageChanges: 2,
    values: { ma5: 98.5, ma20: 101.25, ma60: 105 },
    order: ['long', 'medium', 'short'],
    slopes: { ma5: 'falling', ma20: 'falling', ma60: 'flat' },
    ...over,
});

describe('renderCycleReading', () => {
    it('이동평균선 대순환: 제목, 높은 순서, 이전 단계, 지속, 변화 횟수, 선 방향 순이다 (ko)', () => {
        expect(renderCycleReading(cycle(), readingContextFor('ko'))).toEqual([
            '이동평균선 대순환 4단계 (안정 하락기)',
            '높은 순서: MA60 > MA20 > MA5 (MA5 98.5, MA20 101.25, MA60 105)',
            '3단계에서 순서대로 넘어왔어요',
            '이 단계가 12봉째 이어지고 있어요',
            `최근 ${CYCLE_LOOKBACK_BARS}봉 동안 단계가 2번 바뀌었어요`,
            '선의 방향: MA5 하락, MA20 하락, MA60 횡보',
        ]);
    });

    it('MACD 대순환은 세 차이값과 EMA 방향을 싣는다 (en)', () => {
        expect(
            renderCycleReading(
                cycle({
                    kind: 'macd_cycle',
                    stage: 1,
                    previousStage: 6,
                    progression: 'forward',
                    barsInStage: 1,
                    stageChanges: 1,
                    order: undefined,
                    values: { upper: 1.5, middle: 2.25, lower: 0.75 },
                    slopes: { ema9: 'rising', ema21: 'rising', ema60: null },
                }),
                readingContextFor('en')
            )
        ).toEqual([
            'MACD cycle, stage 1 (stable uptrend)',
            'MACD differences: EMA9-EMA21 1.5, EMA9-EMA60 2.25, EMA21-EMA60 0.75',
            'Moved forward from stage 6',
            'This stage has lasted 1 bar',
            `The stage changed 1 time in the last ${CYCLE_LOOKBACK_BARS} bars`,
            'Line direction: EMA9 rising, EMA21 rising, EMA60 unknown',
        ]);
    });

    it.each([
        ['reverse', '2단계에서 거꾸로 되돌아왔어요'],
        [null, '직전 단계는 2단계였어요'],
    ] as const)('이전 단계의 진행이 %s이면', (progression, expected) => {
        const lines = renderCycleReading(
            cycle({ previousStage: 2, progression }),
            readingContextFor('ko')
        );
        expect(lines?.[2]).toBe(expected);
    });

    it('이전 단계가 없으면 그렇게 말하고, 구간 처음부터면 지속 봉 수 대신 그렇게 말한다', () => {
        const lines = renderCycleReading(
            cycle({
                previousStage: null,
                progression: null,
                barsInStage: null,
                stageChanges: 0,
            }),
            readingContextFor('ko')
        );
        expect(lines?.[2]).toBe(
            `최근 ${CYCLE_LOOKBACK_BARS}봉 안에서는 이전 단계가 없었어요`
        );
        expect(lines?.[3]).toBe(
            `최근 ${CYCLE_LOOKBACK_BARS}봉 내내 이 단계가 이어지고 있어요`
        );
    });

    it('선 방향을 하나도 모르면 그 줄을 생략한다', () => {
        const lines = renderCycleReading(
            cycle({ slopes: { ma5: null, ma20: null, ma60: null } }),
            readingContextFor('ko')
        );
        expect(lines).toHaveLength(5);
    });

    it.each(LOCALES)(
        '%s: 여섯 단계 모두 이름이 붙고 ICU 잔여물이 없다',
        locale => {
            const context = readingContextFor(locale);
            const stages = [1, 2, 3, 4, 5, 6] as const;
            const headlines = stages.map(
                stage =>
                    renderCycleReading(cycle({ stage }), context)?.[0] ?? ''
            );
            expect(new Set(headlines).size).toBe(6);
            expect(headlines.every(line => !/[{}]/.test(line))).toBe(true);
        }
    );

    it('문장이 쓰는 값 키가 빠진 읽기는 null이라 호출부가 요약으로 물러난다', () => {
        const context = readingContextFor('ko');
        expect(
            renderCycleReading(cycle({ values: { ma5: 1, ma20: 2 } }), context)
        ).toBeNull();
        expect(
            renderCycleReading(
                cycle({
                    kind: 'macd_cycle',
                    order: undefined,
                    values: { upper: 1, middle: 2 },
                }),
                context
            )
        ).toBeNull();
    });

    it('이동평균선 대순환은 순서가 없거나 비었거나 모르는 역할이 있으면 null이다', () => {
        const context = readingContextFor('ko');
        expect(
            renderCycleReading(cycle({ order: undefined }), context)
        ).toBeNull();
        expect(renderCycleReading(cycle({ order: [] }), context)).toBeNull();
        expect(
            renderCycleReading(
                cycle({ order: ['short', 'tiny' as never] }),
                context
            )
        ).toBeNull();
    });

    it('MACD 대순환은 순서 없이도 그려진다', () => {
        expect(
            renderCycleReading(
                cycle({
                    kind: 'macd_cycle',
                    order: undefined,
                    values: { upper: 1, middle: 2, lower: 3 },
                    slopes: { ema9: null, ema21: null, ema60: null },
                }),
                readingContextFor('ko')
            )
        ).toHaveLength(5);
    });

    it('표에 없는 종류나 단계는 null이다', () => {
        const context = readingContextFor('ko');
        // safe: 손상되거나 새로 늘어난 값을 흉내 낸다.
        expect(
            renderCycleReading(cycle({ kind: 'x_cycle' as never }), context)
        ).toBeNull();
        expect(
            renderCycleReading(cycle({ stage: 9 as never }), context)
        ).toBeNull();
    });
});

// order 문장의 선 이름은 core가 공개한 `MA_CYCLE_PERIODS`에서 만든다. 값 키(`ma5`·`ma20`·`ma60`)가 같은
// 기간을 가리켜야 order 문장과 값이 같은 선을 말한다.
describe('MA_CYCLE_PERIODS와 값 키', () => {
    it('order의 역할마다 `ma{기간}` 값 키가 있다', () => {
        const values = cycle().values;
        expect(
            Object.values(MA_CYCLE_PERIODS).map(period => `ma${period}`)
        ).toEqual(expect.arrayContaining(Object.keys(values)));
    });
});
