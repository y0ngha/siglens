import { CHART_COLORS } from '@/shared/lib/chartColors';

/**
 * Elder Ray 막대 색: 해당 side의 우세 방향(bull=양수, bear=음수)일 때만 색을 입히고,
 * 반대 부호 막대는 neutral(회색)로 죽인다 — bull/bear power를 한 pane에 겹쳐도 우세 쪽만 부각.
 */
export function elderRayBarColor(value: number, side: 'bull' | 'bear'): string {
    if (side === 'bull') {
        return value >= 0 ? CHART_COLORS.elderBullPower : CHART_COLORS.neutral;
    }
    return value <= 0 ? CHART_COLORS.elderBearPower : CHART_COLORS.neutral;
}

/** Regression alpha 기본값 — r2가 null(신뢰도 미확정)일 때 흐릿하게. */
const REGRESSION_FALLBACK_ALPHA = 0.25;
/** Regression 막대 RGB(투명도만 r2로 변조) — DESIGN.md teal/red 고정값의 RGB 분해. */
const REGRESSION_UP_RGB = '38, 166, 154'; // #26a69a
const REGRESSION_DOWN_RGB = '239, 83, 80'; // #ef5350

/**
 * Squeeze 모멘텀 히스토그램 4색: 부호(상승/하락) × increasing(강/약).
 * value > 0: increasing이면 강한 상승, 아니면 약화. value ≤ 0: increasing이면
 * 회복(약한 하락), 아니면 강한 하락. (LazyBear 표준)
 */
export function squeezeMomentumColor(
    value: number,
    increasing: boolean | null
): string {
    if (value > 0) {
        return increasing
            ? CHART_COLORS.squeezeMomentumUp
            : CHART_COLORS.squeezeMomentumUpWeak;
    }
    return increasing
        ? CHART_COLORS.squeezeMomentumDownWeak
        : CHART_COLORS.squeezeMomentumDown;
}

/**
 * Squeeze 상태 점 색: noSqz > sqzOn > sqzOff 우선순위. 어느 상태도 아니면 null(점 없음).
 */
export function squeezeStateColor(row: {
    noSqz: boolean | null;
    sqzOn: boolean | null;
    sqzOff: boolean | null;
}): string | null {
    if (row.noSqz) return CHART_COLORS.squeezeNone;
    if (row.sqzOn) return CHART_COLORS.squeezeOn;
    if (row.sqzOff) return CHART_COLORS.squeezeOff;
    return null;
}

/**
 * Regression slope 막대 색: 부호로 teal/red, 투명도 = r2(적합도) 클램프.
 * r2 null/undefined이면 fallback alpha로 "신뢰도 미확정"을 흐리게 표현(`== null`로 둘 다 방어 → NaN alpha 방지).
 */
export function regressionBarColor(
    slope: number,
    r2: number | null | undefined
): string {
    const alpha =
        r2 == null ? REGRESSION_FALLBACK_ALPHA : Math.min(1, Math.max(0, r2));
    const rgb = slope >= 0 ? REGRESSION_UP_RGB : REGRESSION_DOWN_RGB;
    return `rgba(${rgb}, ${alpha})`;
}
