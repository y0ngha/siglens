/**
 * 지표 카드·대순환 카드의 구조화된 읽기(`reading`/`cycle`) → 독자 언어 문장.
 *
 * core는 지표 카드를 코드로 만들고(`indicatorResults`), 모델이 쓰던 한국어 설명 대신
 * 영어 정본 한 줄(`description`/`summary`)과 구조화된 읽기를 싣는다. 영어 줄은 에이전트·API용이라
 * 화면에는 이 모듈이 `reading`/`cycle`을 로케일 카탈로그(`widgets.analysis.reading`)로 풀어 쓴다.
 *
 * 카탈로그 키는 변수로 조회한다 — 종류·상태 조합이 90여 개라 리터럴 호출로 늘어놓으면 같은 표가
 * 두 번 생긴다. 대신 키 표를 `satisfies`로 core 타입에 묶어(새 종류·새 상태는 컴파일 에러),
 * `renderIndicatorReading.test.ts`가 표의 모든 키가 네 카탈로그에 있고 카탈로그에 고아 키가 없음을
 * 확인한다(I18-17, I18-18). 이 네임스페이스는 `manualKeys.preserve`에 등록돼 있다.
 */
import { CYCLE_LOOKBACK_BARS, MA_CYCLE_PERIODS } from '@y0ngha/siglens-core';
import type {
    CycleCardKind,
    CycleLineSlope,
    CycleReading,
    CycleStage,
    IndicatorCardKind,
    IndicatorCardStates,
    IndicatorReading,
    SignalType,
} from '@y0ngha/siglens-core';
import type { EnumLabelTranslator } from '@/shared/lib/enumLabelTranslator';

/** `widgets.analysis.reading` 번역자 — 호출부 훅이 바인딩해 넘긴다. */
export type ReadingTranslator = (
    key: string,
    values?: Record<string, string | number>
) => string;

export type ReadingNumberFormatter = (value: number) => string;

export interface ReadingRenderContext {
    t: ReadingTranslator;
    /** `shared.enumLabel` — 이벤트 카드의 신호 이름(`signalType.*`). */
    tLabel: EnumLabelTranslator;
    format: ReadingNumberFormatter;
    /** 로케일의 목록 접속("A, B" / "A and B"). 번역 조각을 코드에서 잇지 않으려고 주입한다. */
    list: (items: readonly string[]) => string;
}

/** 프롬프트가 `N/A`로 찍은 값. */
const NOT_AVAILABLE = 'N/A';

const NUMBER_FORMAT = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 8,
});

/**
 * 카드 숫자 표기. 프롬프트가 찍은 정밀도를 그대로 살리되(`Number`의 최단 표기), 큰 수(OBV·거래량)는
 * 천 단위로 끊는다. 로케일을 고정해 서버·클라이언트 렌더가 어긋나지 않게 한다.
 */
export const formatReadingNumber: ReadingNumberFormatter = value =>
    NUMBER_FORMAT.format(value);

type IndicatorTextKeys = {
    [K in IndicatorCardKind]: SignalType extends IndicatorCardStates[K]
        ? string
        : Readonly<Record<IndicatorCardStates[K], string>>;
};

/**
 * 종류별 문장 키. 이벤트 종류(상태 = 신호 타입)는 키 하나, 상태 종류는 상태마다 하나다.
 * 새 종류·새 상태는 `satisfies`가 컴파일 에러로 잡는다.
 */
export const INDICATOR_TEXT_KEYS = {
    ma: {
        bullish_stack: 'ma.bullish_stack',
        bearish_stack: 'ma.bearish_stack',
        mixed: 'ma.mixed',
    },
    ema: {
        bullish_stack: 'ema.bullish_stack',
        bearish_stack: 'ema.bearish_stack',
        mixed: 'ema.mixed',
    },
    adx: {
        trending: 'adx.trending',
        between: 'adx.between',
        weak: 'adx.weak',
    },
    atr: {
        rising: 'atr.rising',
        falling: 'atr.falling',
        flat: 'atr.flat',
    },
    obv: {
        rising: 'obv.rising',
        falling: 'obv.falling',
        flat: 'obv.flat',
    },
    volume_profile: {
        above_value_area: 'volume_profile.above_value_area',
        inside_value_area: 'volume_profile.inside_value_area',
        below_value_area: 'volume_profile.below_value_area',
    },
    rsi: 'rsi.event',
    macd: 'macd.event',
    cci: 'cci.event',
    cmf: 'cmf.event',
    dmi: 'dmi.event',
    ichimoku: 'ichimoku.event',
    mfi: 'mfi.event',
    parabolic_sar: 'parabolic_sar.event',
    squeeze_momentum: 'squeeze_momentum.event',
    supertrend: 'supertrend.event',
    bollinger_percent_b: 'bollinger_percent_b.event',
    stochastic: {
        overbought: 'stochastic.overbought',
        oversold: 'stochastic.oversold',
    },
    stoch_rsi: {
        overbought: 'stoch_rsi.overbought',
        oversold: 'stoch_rsi.oversold',
    },
    williams_r: {
        overbought: 'williams_r.overbought',
        oversold: 'williams_r.oversold',
    },
    connors_rsi: {
        overbought: 'connors_rsi.overbought',
        oversold: 'connors_rsi.oversold',
    },
    bollinger: {
        above_band_pctb: 'bollinger.above_band_pctb',
        below_band_pctb: 'bollinger.below_band_pctb',
    },
    keltner: {
        beyond_upper: 'keltner.beyond_upper',
        beyond_lower: 'keltner.beyond_lower',
        near_upper: 'keltner.near_upper',
        near_lower: 'keltner.near_lower',
    },
    donchian: {
        beyond_upper: 'donchian.beyond_upper',
        beyond_lower: 'donchian.beyond_lower',
        near_upper: 'donchian.near_upper',
        near_lower: 'donchian.near_lower',
    },
    vwap: {
        above: 'vwap.above',
        below: 'vwap.below',
    },
    buy_sell_volume: {
        buy_dominant: 'buy_sell_volume.buy_dominant',
        sell_dominant: 'buy_sell_volume.sell_dominant',
    },
    macd_v: {
        high_positive: 'macd_v.high_positive',
        high_negative: 'macd_v.high_negative',
    },
    force_index: {
        turned_positive: 'force_index.turned_positive',
        turned_negative: 'force_index.turned_negative',
    },
    elder_ray: {
        bear_power_rising: 'elder_ray.bear_power_rising',
        bull_power_falling: 'elder_ray.bull_power_falling',
        both: 'elder_ray.both',
    },
    // 엘더 임펄스는 상태가 색 이름이라 문구가 아니라 색 라벨 키를 둔다 — 문장은 아래 `ELDER_IMPULSE_KEYS`.
    elder_impulse: {
        green: 'elder_impulse.color.green',
        red: 'elder_impulse.color.red',
        blue: 'elder_impulse.color.blue',
    },
    chandelier: {
        flipped_long: 'chandelier.flipped_long',
        flipped_short: 'chandelier.flipped_short',
    },
    hurst: {
        trending: 'hurst.trending',
        mean_reverting: 'hurst.mean_reverting',
    },
    variance_ratio: {
        trending: 'variance_ratio.trending',
        mean_reverting: 'variance_ratio.mean_reverting',
    },
    regression: {
        strong_fit_up: 'regression.strong_fit_up',
        strong_fit_down: 'regression.strong_fit_down',
    },
    yang_zhang: {
        high_volatility: 'yang_zhang.high_volatility',
        low_volatility: 'yang_zhang.low_volatility',
    },
    ewma: {
        high_volatility: 'ewma.high_volatility',
        low_volatility: 'ewma.low_volatility',
    },
} as const satisfies IndicatorTextKeys;

/** 엘더 임펄스 문장: 색이 그대로면 `current`, 이전 색에서 바뀌었으면 `flipped`. */
export const ELDER_IMPULSE_KEYS = {
    current: 'elder_impulse.current',
    flipped: 'elder_impulse.flipped',
} as const;

type CycleTextKeys = Readonly<{
    headline: string;
    /** `ma_cycle`은 높은 순서, `macd_cycle`은 세 차이값. */
    lines: string;
    slopes: string;
}>;

/** 대순환 카드의 종류별 키. 단계 이름과 이력 문장은 두 종류가 같이 쓴다. */
export const CYCLE_TEXT_KEYS = {
    ma_cycle: {
        headline: 'cycle.ma_cycle.headline',
        lines: 'cycle.ma_cycle.order',
        slopes: 'cycle.ma_cycle.slopes',
    },
    macd_cycle: {
        headline: 'cycle.macd_cycle.headline',
        lines: 'cycle.macd_cycle.values',
        slopes: 'cycle.macd_cycle.slopes',
    },
} as const satisfies Record<CycleCardKind, CycleTextKeys>;

/** 종류별로 문장이 쓰는 `values` 키 — 없으면 읽기를 그리지 않는다. */
const CYCLE_VALUE_KEYS = {
    ma_cycle: ['ma5', 'ma20', 'ma60'],
    macd_cycle: ['upper', 'middle', 'lower'],
} as const satisfies Record<CycleCardKind, readonly string[]>;

export const CYCLE_STAGE_NAME_KEYS = {
    1: 'cycle.stageName.stage1',
    2: 'cycle.stageName.stage2',
    3: 'cycle.stageName.stage3',
    4: 'cycle.stageName.stage4',
    5: 'cycle.stageName.stage5',
    6: 'cycle.stageName.stage6',
} as const satisfies Record<CycleStage, string>;

export const CYCLE_SLOPE_KEYS = {
    rising: 'cycle.slope.rising',
    falling: 'cycle.slope.falling',
    flat: 'cycle.slope.flat',
    unknown: 'cycle.slope.unknown',
} as const satisfies Record<NonNullable<CycleLineSlope> | 'unknown', string>;

/** 단계 이력 문장 — 두 종류가 같이 쓴다. */
export const CYCLE_HISTORY_KEYS = {
    previousForward: 'cycle.previous.forward',
    previousReverse: 'cycle.previous.reverse',
    previousOther: 'cycle.previous.other',
    previousNone: 'cycle.previous.none',
    durationBars: 'cycle.duration.bars',
    durationSinceStart: 'cycle.duration.sinceStart',
    changes: 'cycle.changes',
} as const;

/**
 * 지표 카드 한 장의 화면 문장. 카탈로그에 없는 종류·상태(core가 늘렸는데 아직 이 표가 못 따라간
 * 새 값, 손상된 캐시)는 `null`을 돌려 호출부가 영어 정본(`description`)으로 물러나게 한다.
 */
export function renderIndicatorReading(
    reading: IndicatorReading,
    { t, tLabel, format, list }: ReadingRenderContext
): string | null {
    if (!Object.hasOwn(INDICATOR_TEXT_KEYS, reading.kind)) return null;
    const entry: string | Readonly<Record<string, string>> =
        INDICATOR_TEXT_KEYS[reading.kind];
    const key = typeof entry === 'string' ? entry : entry[reading.state];
    if (key === undefined) return null;
    if (reading.kind === 'elder_impulse') {
        const previous =
            reading.flippedFrom === null
                ? undefined
                : INDICATOR_TEXT_KEYS.elder_impulse[reading.flippedFrom];
        return previous === undefined
            ? t(ELDER_IMPULSE_KEYS.current, { color: t(key) })
            : t(ELDER_IMPULSE_KEYS.flipped, {
                  from: t(previous),
                  color: t(key),
              });
    }

    const signalTypes: readonly SignalType[] =
        reading.signals.length > 0
            ? reading.signals.map(signal => signal.type)
            : reading.basis === 'event'
              ? // safe: 이벤트 카드의 `state`는 발화한 첫 신호의 타입이다(core `IndicatorCardStates`의 `SignalType` 종류).
                [reading.state as SignalType]
              : [];
    const values: Record<string, string> = {
        ...Object.fromEntries(
            Object.entries(reading.values).map(([name, value]) => [
                name,
                value === null ? NOT_AVAILABLE : format(value),
            ])
        ),
        signals: list(signalTypes.map(type => tLabel(`signalType.${type}`))),
    };
    return t(key, values);
}

/** 대순환 카드의 한 줄들 — 첫 줄이 제목, 나머지는 사실 한 줄씩이다. */
export function renderCycleReading(
    cycle: CycleReading,
    { t, format }: ReadingRenderContext
): string[] | null {
    if (!Object.hasOwn(CYCLE_TEXT_KEYS, cycle.kind)) return null;
    if (!Object.hasOwn(CYCLE_STAGE_NAME_KEYS, cycle.stage)) return null;
    const keys = CYCLE_TEXT_KEYS[cycle.kind];
    // 문장이 가리키는 값·순서가 빠진 읽기는 빈 칸이 있는 문장이 되므로 그리지 않고 호출부가
    // 저장된 요약으로 물러나게 한다(손상된 캐시, core가 키를 바꾼 경우).
    if (!CYCLE_VALUE_KEYS[cycle.kind].every(key => key in cycle.values)) {
        return null;
    }
    if (
        cycle.kind === 'ma_cycle' &&
        (cycle.order === undefined ||
            cycle.order.length === 0 ||
            !cycle.order.every(role => Object.hasOwn(MA_CYCLE_PERIODS, role)))
    ) {
        return null;
    }

    const formatted = Object.fromEntries(
        Object.entries(cycle.values).map(([name, value]) => [
            name,
            format(value),
        ])
    );
    const slopeLabels = Object.fromEntries(
        Object.entries(cycle.slopes).map(([name, slope]) => [
            name,
            t(CYCLE_SLOPE_KEYS[slope ?? 'unknown']),
        ])
    );
    const hasSlope = Object.values(cycle.slopes).some(slope => slope !== null);

    const previousKey =
        cycle.previousStage === null
            ? CYCLE_HISTORY_KEYS.previousNone
            : cycle.progression === 'forward'
              ? CYCLE_HISTORY_KEYS.previousForward
              : cycle.progression === 'reverse'
                ? CYCLE_HISTORY_KEYS.previousReverse
                : CYCLE_HISTORY_KEYS.previousOther;

    return [
        t(keys.headline, {
            stage: cycle.stage,
            stageName: t(CYCLE_STAGE_NAME_KEYS[cycle.stage]),
        }),
        t(keys.lines, {
            ...formatted,
            order: (cycle.order ?? [])
                .map(role => `MA${MA_CYCLE_PERIODS[role]}`)
                .join(' > '),
        }),
        t(previousKey, {
            previousStage: cycle.previousStage ?? 0,
            lookback: CYCLE_LOOKBACK_BARS,
        }),
        cycle.barsInStage === null
            ? t(CYCLE_HISTORY_KEYS.durationSinceStart, {
                  lookback: CYCLE_LOOKBACK_BARS,
              })
            : t(CYCLE_HISTORY_KEYS.durationBars, { bars: cycle.barsInStage }),
        t(CYCLE_HISTORY_KEYS.changes, {
            count: cycle.stageChanges,
            lookback: CYCLE_LOOKBACK_BARS,
        }),
        ...(hasSlope ? [t(keys.slopes, slopeLabels)] : []),
    ];
}
