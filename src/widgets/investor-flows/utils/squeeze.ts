/**
 * 숏스퀴즈 점수 카드의 표시 규칙 — 수준 배지, 구성요소 값 포맷, 출처.
 */
import type {
    SqueezeRiskComponentId,
    SqueezeRiskLevel,
    SqueezeRiskScore,
} from '@y0ngha/siglens-core';
import type { Locale } from '@/shared/i18n/locales';
import {
    formatDecimal,
    formatInteger,
    formatPercent,
    formatSignedPercent,
} from './flowFormat';

/** 수준 배지 색(`ui-*-text` AA 변형). 방향(강세·약세)이 아니라 위험 정도라 상태 토큰을 쓴다. */
export const SQUEEZE_LEVEL_CLASS: Record<SqueezeRiskLevel, string> = {
    low: 'bg-secondary-700 text-secondary-300',
    elevated: 'bg-ui-warning/10 text-ui-warning-text',
    high: 'bg-ui-warning/10 text-ui-warning-text',
    extreme: 'bg-ui-danger/10 text-ui-danger-text',
};

/** 색과 별개로 붙는 기호 — 막대 개수로 수준을 읽게 한다. */
export const SQUEEZE_LEVEL_MARK: Record<SqueezeRiskLevel, string> = {
    low: '▮',
    elevated: '▮▮',
    high: '▮▮▮',
    extreme: '▮▮▮▮',
};

/**
 * `tradingDays`는 과열 목록 연속 등재일(정수 거래일). 등재되지 않았으면(0) 숫자 대신 `notListed`로 바꿔 `0.0일` 같은
 * 표기를 피한다 — 과열 목록 배지의 "지금은 과열 목록에 없어요"와 같은 뜻이다.
 */
type ValueUnit =
    | 'percent'
    | 'signedPercent'
    | 'days'
    | 'tradingDays'
    | 'notListed'
    | 'z'
    | 'multiple';

/** 원값의 단위. `notListed`는 값에서 정해지는 표시 단위라 여기 없다. */
type ComponentUnit = Exclude<ValueUnit, 'notListed'>;

/** 구성요소 값의 단위(core `SqueezeRiskComponent.value`는 각 입력의 원래 단위다). */
const COMPONENT_UNIT: Record<SqueezeRiskComponentId, ComponentUnit> = {
    short_interest_pct_float: 'percent',
    days_to_cover: 'days',
    short_interest_trend: 'signedPercent',
    off_exchange_short_ratio_z: 'z',
    fails_to_deliver_pct: 'percent',
    threshold_list_days: 'tradingDays',
    price_change_20d: 'signedPercent',
    volume_ratio: 'multiple',
};

/** 포맷한 구성요소 값과 단위. */
export interface FormattedComponentValue {
    /** 단위 — 퍼센트는 `value`에 `%`가 이미 붙고, 나머지는 화면이 로케일별 단위 글자를 붙인다(`notListed`는 `value`가 빈 문자열). */
    unit: ValueUnit;
    value: string;
}

/** 퍼센트 원값(유통주식 대비 잔고 %·결제 불이행 %)의 소수 자리. */
const PERCENT_DIGITS = 2;
/** 증감 퍼센트·일수·z·배수의 소수 자리. */
const DECIMAL_DIGITS = 1;

/** 단위별 값 포맷. `tradingDays`는 등재되지 않았으면(0 이하) 숫자 대신 `notListed`로 바꾼다. */
const UNIT_FORMATTER: Record<
    ComponentUnit,
    (value: number, locale: Locale) => FormattedComponentValue
> = {
    percent: (value, locale) => ({
        unit: 'percent',
        value: formatPercent(value, locale, PERCENT_DIGITS),
    }),
    signedPercent: (value, locale) => ({
        unit: 'signedPercent',
        value: formatSignedPercent(value, locale, DECIMAL_DIGITS),
    }),
    tradingDays: (value, locale) =>
        value <= 0
            ? { unit: 'notListed', value: '' }
            : { unit: 'tradingDays', value: formatInteger(value, locale) },
    days: (value, locale) => ({
        unit: 'days',
        value: formatDecimal(value, locale, DECIMAL_DIGITS),
    }),
    z: (value, locale) => ({
        unit: 'z',
        value: formatDecimal(value, locale, DECIMAL_DIGITS),
    }),
    multiple: (value, locale) => ({
        unit: 'multiple',
        value: formatDecimal(value, locale, DECIMAL_DIGITS),
    }),
};

/** 구성요소 원값을 단위에 맞게 포맷한다(계산하지 않고 core 값을 그대로 쓴다). */
export function formatComponentValue(
    id: SqueezeRiskComponentId,
    value: number,
    locale: Locale
): FormattedComponentValue {
    return UNIT_FORMATTER[COMPONENT_UNIT[id]](value, locale);
}

/** 숏스퀴즈 점수가 기댄 데이터 출처. */
export type SqueezeSource = 'finra' | 'sec' | 'exchange' | 'price';

/** 출처를 문구에 나열하는 순서. */
const SQUEEZE_SOURCE_ORDER: readonly SqueezeSource[] = [
    'finra',
    'sec',
    'exchange',
    'price',
];

/**
 * 점수에 실제로 쓰인 출처를 순서대로 모은다 — FINRA(공매도 잔고·비중), SEC(결제 불이행 구성요소가 있을 때), 거래소 과열 목록,
 * 가격(마지막 봉 날짜가 있을 때).
 */
export function squeezeSources(risk: SqueezeRiskScore): SqueezeSource[] {
    const used: Record<SqueezeSource, boolean> = {
        finra: risk.includesFinra,
        sec: risk.components.some(c => c.id === 'fails_to_deliver_pct'),
        exchange: risk.includesExchangeLists,
        price: risk.lastBarDate !== null,
    };
    return SQUEEZE_SOURCE_ORDER.filter(source => used[source]);
}
