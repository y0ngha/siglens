import type { ActionRecommendation } from '@/domain/types';

/**
 * AI SL/TP 검증, ATR 기반 fallback resolver, 그리고 ActionRecommendation 재조합.
 *
 * 백테스트 및 production AI 파이프라인에서 AI가 제시한 stopLoss/takeProfit의
 * 유효성을 검증하고, 무효하거나 누락된 경우 ATR 기반 fallback 값을 계산한다.
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

// ─── Text reconciliation (production pipeline) ──────────────────────────────
//
// AI가 제시한 SL/TP가 보정되면, actionRecommendation.exit / riskReward 텍스트는
// 더 이상 실제 값과 일치하지 않는다. 결정론적으로 재생성해 UI 표시와 실제
// 실행 레벨 사이의 괴리를 제거한다. (AI 재호출 없음.)

/**
 * bullish 롱 포지션 기준으로 SL/TP 값을 기반으로 exit 텍스트를 생성.
 * 예: "목표가 $164.90 (+2.3%)에서 익절, 손절 $158.40 (-1.7%)."
 */
export function buildBullishExitText(
    entryPrice: number,
    stopLoss: number | undefined,
    takeProfitPrices: readonly number[] | undefined
): string {
    const parts: string[] = [];
    if (takeProfitPrices && takeProfitPrices.length > 0) {
        const tp = takeProfitPrices[0];
        const pct = (((tp - entryPrice) / entryPrice) * 100).toFixed(1);
        parts.push(`목표가 $${tp.toFixed(2)} (+${pct}%)에서 익절`);
    }
    if (stopLoss !== undefined) {
        const pct = (((stopLoss - entryPrice) / entryPrice) * 100).toFixed(1);
        parts.push(`손절 $${stopLoss.toFixed(2)} (${pct}%)`);
    }
    return parts.length > 0 ? parts.join(', ') + '.' : '';
}

/**
 * bullish 롱 포지션의 위험:보상 비율 텍스트.
 * 예: "손절 1.2% vs 목표 3.2% → 위험:보상 = 1:2.7"
 */
export function buildBullishRiskRewardText(
    entryPrice: number,
    stopLoss: number | undefined,
    takeProfitPrices: readonly number[] | undefined
): string {
    if (
        stopLoss === undefined ||
        !takeProfitPrices ||
        takeProfitPrices.length === 0
    ) {
        return '';
    }
    const tp = takeProfitPrices[0];
    const riskPct = Math.abs(((stopLoss - entryPrice) / entryPrice) * 100);
    const rewardPct = ((tp - entryPrice) / entryPrice) * 100;
    if (riskPct === 0) return '';
    const ratio = (rewardPct / riskPct).toFixed(1);
    return `손절 ${riskPct.toFixed(1)}% vs 목표 ${rewardPct.toFixed(1)}% → 위험:보상 = 1:${ratio}`;
}

export interface ReconcileResult {
    readonly recommendation: ActionRecommendation;
    readonly wasReconciled: boolean;
    readonly changes: readonly string[];
}

/**
 * bullish ActionRecommendation에 대해 SL/TP 유효성 검증 + fallback 적용 +
 * 텍스트 재조합을 수행한다.
 *
 * - 유효한 AI 값은 그대로 유지
 * - 무효/누락 값은 ATR 기반 fallback으로 교체
 * - SL 또는 takeProfitPrices[0]가 교체되면 exit/riskReward 텍스트도 재생성
 * - positionAnalysis, entry, entryRecommendation, entryPrices는 건드리지 않음
 *
 * AI가 여러 목표가를 제시한 경우 첫 번째만 보정 — 나머지 원소는 보존한다.
 */
export function reconcileBullishActionRecommendation(
    rec: ActionRecommendation,
    entryPrice: number,
    atr: number | undefined
): ReconcileResult {
    const changes: string[] = [];

    const slResolved = resolveBullishStopLoss(rec.stopLoss, entryPrice, atr);
    const tpResolved = resolveBullishTakeProfit(
        rec.takeProfitPrices?.[0],
        entryPrice,
        atr
    );

    const slChanged =
        slResolved.source === 'fallback' && slResolved.value !== rec.stopLoss;
    const tpChanged =
        tpResolved.source === 'fallback' &&
        tpResolved.value !== rec.takeProfitPrices?.[0];

    if (slChanged) {
        changes.push(
            `stopLoss: ${rec.stopLoss ?? 'null'} → ${slResolved.value?.toFixed(2)} (fallback)`
        );
    }
    if (tpChanged) {
        changes.push(
            `takeProfitPrices[0]: ${rec.takeProfitPrices?.[0] ?? 'null'} → ${tpResolved.value?.toFixed(2)} (fallback)`
        );
    }

    // TP가 fallback이면 첫 번째 원소만 교체하고, AI가 제공한 나머지 target은 보존.
    let newTpArr = rec.takeProfitPrices;
    if (tpChanged && tpResolved.value !== undefined) {
        const rest = rec.takeProfitPrices?.slice(1) ?? [];
        newTpArr = [tpResolved.value, ...rest];
    }

    const reconciled: ActionRecommendation = {
        ...rec,
        stopLoss: slResolved.value ?? rec.stopLoss,
        takeProfitPrices: newTpArr,
    };

    const wasReconciled = slChanged || tpChanged;

    if (wasReconciled) {
        reconciled.exit = buildBullishExitText(
            entryPrice,
            reconciled.stopLoss,
            reconciled.takeProfitPrices
        );
        reconciled.riskReward = buildBullishRiskRewardText(
            entryPrice,
            reconciled.stopLoss,
            reconciled.takeProfitPrices
        );
    }

    return { recommendation: reconciled, wasReconciled, changes };
}
