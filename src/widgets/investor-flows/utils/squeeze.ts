import type {
    SqueezeRiskComponentId,
    SqueezeRiskLevel,
} from '@y0ngha/siglens-core';
import type { Locale } from '@/shared/i18n/locales';
import {
    formatDecimal,
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

type ValueUnit = 'percent' | 'signedPercent' | 'days' | 'z' | 'multiple';

/** 구성요소 값의 단위(core `SqueezeRiskComponent.value`는 각 입력의 원래 단위다). */
const COMPONENT_UNIT: Record<SqueezeRiskComponentId, ValueUnit> = {
    short_interest_pct_float: 'percent',
    days_to_cover: 'days',
    short_interest_trend: 'signedPercent',
    off_exchange_short_ratio_z: 'z',
    fails_to_deliver_pct: 'percent',
    threshold_list_days: 'days',
    price_change_20d: 'signedPercent',
    volume_ratio: 'multiple',
};

export interface FormattedComponentValue {
    /** 단위 — 퍼센트는 `value`에 `%`가 이미 붙고, 나머지는 화면이 로케일별 단위 글자를 붙인다. */
    unit: ValueUnit;
    value: string;
}

/** 구성요소 원값을 단위에 맞게 포맷한다(계산하지 않고 core 값을 그대로 쓴다). */
export function formatComponentValue(
    id: SqueezeRiskComponentId,
    value: number,
    locale: Locale
): FormattedComponentValue {
    const unit = COMPONENT_UNIT[id];
    switch (unit) {
        case 'percent':
            return { unit, value: formatPercent(value, locale, 2) };
        case 'signedPercent':
            return { unit, value: formatSignedPercent(value, locale, 1) };
        case 'days':
        case 'z':
        case 'multiple':
            return { unit, value: formatDecimal(value, locale, 1) };
    }
}
