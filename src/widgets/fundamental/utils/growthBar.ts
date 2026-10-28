/**
 * 성장률 막대의 방향·채움·색 계산.
 */
import { formatSignedPercent } from '@/shared/lib/priceFormat';
import { MISSING_VALUE, PERCENT_SCALE } from './moneyFormat';

/** 성장률 막대 한 줄을 그리는 데 필요한 값. */
export interface GrowthBarView {
    /** 부호가 붙은 퍼센트 표기. 값이 없으면 `-`. */
    formatted: string;
    /** 값이 없으면 막대를 그리지 않는다. */
    hasValue: boolean;
    isPositive: boolean;
    /** 중심선에서 뻗는 폭(%), ±100%에서 잘린다. */
    fillAbs: number;
}

/** 숫자 색 클래스 조회표 — 값 없음·양수·음수. */
export const GROWTH_TEXT_CLASS = {
    none: 'text-secondary-400',
    positive: 'text-ui-success-text',
    negative: 'text-ui-danger-text',
} as const;

/** 성장률 비율(0.12 = 12%)을 막대 표시 값으로 바꾼다. */
export function growthBarView(value: number | null): GrowthBarView {
    if (value === null) {
        return {
            formatted: MISSING_VALUE,
            hasValue: false,
            isPositive: true,
            fillAbs: 0,
        };
    }
    const pct = value * PERCENT_SCALE;
    return {
        formatted: formatSignedPercent(pct),
        hasValue: true,
        isPositive: pct >= 0,
        fillAbs: Math.min(PERCENT_SCALE, Math.abs(pct)),
    };
}

/** 막대 표시 값에서 텍스트 색 클래스를 고른다. */
export function growthTextClass(view: GrowthBarView): string {
    if (!view.hasValue) return GROWTH_TEXT_CLASS.none;
    return view.isPositive
        ? GROWTH_TEXT_CLASS.positive
        : GROWTH_TEXT_CLASS.negative;
}
