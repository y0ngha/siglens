import type { SignalStrength } from '@y0ngha/siglens-core';

export interface StrengthDisplay {
    /** `widgets.analysis.signalStrength` 키 — 표시는 렌더 쪽에서 `t()`로. */
    labelKey: string;
    color: string;
}

const SIGNAL_STRENGTH_CONFIG: Record<SignalStrength, StrengthDisplay> = {
    strong: { labelKey: 'strong', color: 'text-chart-bullish' },
    moderate: { labelKey: 'moderate', color: 'text-ui-warning' },
    weak: { labelKey: 'weak', color: 'text-secondary-400' },
};

/**
 * strength 값이 유효한 SignalStrength 리터럴이면 표시 정보를 반환한다.
 * null · undefined · 알 수 없는 값이 들어오면 null을 반환해 렌더링을 건너뛴다.
 * AI 응답에서 strength 필드가 누락되어 정렬이 틀어지는 경우를 방어한다.
 */
export function resolveStrengthDisplay(
    strength: SignalStrength | null | undefined
): StrengthDisplay | null {
    if (strength == null || !Object.hasOwn(SIGNAL_STRENGTH_CONFIG, strength))
        return null;
    return SIGNAL_STRENGTH_CONFIG[strength];
}
