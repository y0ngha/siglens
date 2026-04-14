import type { SignalStrength } from '@/domain/types';

const SIGNAL_STRENGTH_COLOR: Record<SignalStrength, string> = {
    strong: 'text-chart-bullish',
    moderate: 'text-ui-warning',
    weak: 'text-secondary-400',
};

export const SIGNAL_STRENGTH_LABEL: Record<SignalStrength, string> = {
    strong: '강한 시그널',
    moderate: '보통 시그널',
    weak: '약한 시그널',
};

export interface StrengthDisplay {
    label: string;
    color: string;
}

/**
 * strength 값이 유효한 SignalStrength 리터럴이면 표시 정보를 반환한다.
 * null · undefined · 알 수 없는 값이 들어오면 null을 반환해 렌더링을 건너뛴다.
 * AI 응답에서 strength 필드가 누락되어 정렬이 틀어지는 경우를 방어한다.
 */
export function resolveStrengthDisplay(
    strength: SignalStrength | null | undefined
): StrengthDisplay | null {
    if (strength == null || !Object.hasOwn(SIGNAL_STRENGTH_LABEL, strength))
        return null;
    return {
        label: SIGNAL_STRENGTH_LABEL[strength],
        color: SIGNAL_STRENGTH_COLOR[strength],
    };
}
