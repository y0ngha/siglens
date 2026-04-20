/**
 * AI SL/TP 검증 및 ATR 기반 fallback resolver.
 *
 * 백테스트 파이프라인에서 AI가 제시한 stopLoss/takeProfit의 유효성을 검증하고,
 * 무효하거나 누락된 경우 ATR 기반 fallback 값을 계산한다.
 *
 * 설계 배경:
 *   - 기존 inline 검증(entry 대비 단순 비교)은 $0.01만 낮아도 SL로 수용,
 *     SL 누락 시 exitReason='time'으로 빠지는 비율이 높았다 (29/100).
 *   - ATR 배수 한도로 터무니없이 먼 값을 걸러내고, 누락 시 ATR 기반
 *     합리적 fallback을 제공해 시뮬레이션 정확도를 높인다.
 *
 * 모든 함수는 순수 함수 — 외부 I/O/상태 없음.
 */

/** ATR 배수 한도 — entryPrice - ATR*5 보다 더 낮은 SL은 비현실적으로 간주한다. */
export const SL_MAX_ATR_MULTIPLIER = 5;

/** ATR 배수 한도 — entryPrice + ATR*10 보다 더 높은 TP는 비현실적으로 간주한다. */
export const TP_MAX_ATR_MULTIPLIER = 10;

/** Fallback SL 배수 — entryPrice - ATR*1.5. */
export const SL_FALLBACK_ATR_MULTIPLIER = 1.5;

/** Fallback TP 배수 — entryPrice + ATR*2.0 (risk:reward ≈ 1:1.33). */
export const TP_FALLBACK_ATR_MULTIPLIER = 2.0;

export type LevelSource = 'ai' | 'fallback' | 'missing';

export interface ResolvedLevel {
    readonly value: number | undefined;
    readonly source: LevelSource;
}

function isFinitePositive(n: number | undefined): n is number {
    return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

function hasUsableAtr(atr: number | undefined): atr is number {
    return typeof atr === 'number' && Number.isFinite(atr) && atr > 0;
}

/**
 * Bullish 매수 포지션의 stopLoss 유효성 검증.
 * - 숫자 유한 + 양수
 * - entryPrice보다 낮음 (bullish이므로)
 * - ATR이 있으면 entryPrice - ATR*SL_MAX_ATR_MULTIPLIER 이상
 */
export function isValidBullishStopLoss(
    sl: number | undefined,
    entryPrice: number,
    atr: number | undefined
): boolean {
    if (!isFinitePositive(sl)) return false;
    if (sl >= entryPrice) return false;
    if (hasUsableAtr(atr)) {
        const minSl = entryPrice - atr * SL_MAX_ATR_MULTIPLIER;
        if (sl < minSl) return false;
    }
    return true;
}

/**
 * Bullish takeProfit 유효성 검증.
 * - 숫자 유한 + 양수
 * - entryPrice보다 높음
 * - ATR이 있으면 entryPrice + ATR*TP_MAX_ATR_MULTIPLIER 이하
 */
export function isValidBullishTakeProfit(
    tp: number | undefined,
    entryPrice: number,
    atr: number | undefined
): boolean {
    if (!isFinitePositive(tp)) return false;
    if (tp <= entryPrice) return false;
    if (hasUsableAtr(atr)) {
        const maxTp = entryPrice + atr * TP_MAX_ATR_MULTIPLIER;
        if (tp > maxTp) return false;
    }
    return true;
}

/**
 * ATR 기반 SL fallback 계산. ATR이 없거나 0 이하이면 undefined.
 */
export function deriveFallbackStopLoss(
    entryPrice: number,
    atr: number | undefined
): number | undefined {
    if (!hasUsableAtr(atr)) return undefined;
    return entryPrice - atr * SL_FALLBACK_ATR_MULTIPLIER;
}

/**
 * ATR 기반 TP fallback 계산. ATR이 없거나 0 이하이면 undefined.
 */
export function deriveFallbackTakeProfit(
    entryPrice: number,
    atr: number | undefined
): number | undefined {
    if (!hasUsableAtr(atr)) return undefined;
    return entryPrice + atr * TP_FALLBACK_ATR_MULTIPLIER;
}

/**
 * AI 값이 유효하면 AI 값을, 무효하면 ATR 기반 fallback을, 둘 다 없으면 undefined를 반환.
 */
export function resolveBullishStopLoss(
    aiValue: number | undefined,
    entryPrice: number,
    atr: number | undefined
): ResolvedLevel {
    if (isValidBullishStopLoss(aiValue, entryPrice, atr)) {
        return { value: aiValue, source: 'ai' };
    }
    const fallback = deriveFallbackStopLoss(entryPrice, atr);
    if (fallback !== undefined) {
        return { value: fallback, source: 'fallback' };
    }
    return { value: undefined, source: 'missing' };
}

/**
 * AI TP 값이 유효하면 AI 값을, 무효하면 ATR 기반 fallback을, 둘 다 없으면 undefined를 반환.
 */
export function resolveBullishTakeProfit(
    aiValue: number | undefined,
    entryPrice: number,
    atr: number | undefined
): ResolvedLevel {
    if (isValidBullishTakeProfit(aiValue, entryPrice, atr)) {
        return { value: aiValue, source: 'ai' };
    }
    const fallback = deriveFallbackTakeProfit(entryPrice, atr);
    if (fallback !== undefined) {
        return { value: fallback, source: 'fallback' };
    }
    return { value: undefined, source: 'missing' };
}
