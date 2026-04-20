import type {
    ActionRecommendation,
    AnalysisResponse,
    ReconciledActionLevels,
    ReconcileResult,
    ResolvedLevel,
} from '@/domain/types';

/** AI SL/TP 검증 + ATR 기반 fallback resolver. AI 원본 필드를 수정하지 않고 reconciledLevels에 보정값을 병기한다. */

/** ATR 배수 한도 — entryPrice - ATR*5 보다 더 낮은 SL은 비현실적으로 간주한다. */
export const SL_MAX_ATR_MULTIPLIER = 5;

/** ATR 배수 한도 — entryPrice + ATR*10 보다 더 높은 TP는 비현실적으로 간주한다. */
export const TP_MAX_ATR_MULTIPLIER = 10;

/** Fallback SL 배수 — entryPrice - ATR*1.5. */
export const SL_FALLBACK_ATR_MULTIPLIER = 1.5;

/** Fallback TP 배수 — entryPrice + ATR*2.0 (risk:reward ≈ 1:1.33). */
export const TP_FALLBACK_ATR_MULTIPLIER = 2.0;

function isFinitePositive(n: number | undefined): n is number {
    return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

function hasUsableAtr(atr: number | undefined): atr is number {
    return isFinitePositive(atr);
}

/** SL이 bullish 포지션에서 유효한지 검증한다 (양수·entry 미만·ATR 배수 범위 내). */
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

/** TP가 bullish 포지션에서 유효한지 검증한다 (entry 초과·ATR 배수 범위 내). */
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

// SL/TP 보정 후 exit · riskReward 텍스트를 AI 재호출 없이 결정론적으로 재생성한다.

const ORDINAL_LABEL = ['1차', '2차', '3차', '4차', '5차'] as const;

function ordinalLabel(index: number): string {
    return ORDINAL_LABEL[index] ?? `${index + 1}차`;
}

/** 진입가 대비 signed 백분율 문자열 반환 (+3.2% / -1.2% 형식). */
function formatSignedPct(entryPrice: number, price: number): string {
    const pct = ((price - entryPrice) / entryPrice) * 100;
    return pct >= 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`;
}

/** 유효 TP 배열을 exit 텍스트 TP 파트로 포맷. 빈 배열이면 undefined. */
function buildExitTpPart(
    entryPrice: number,
    validTps: readonly number[]
): string | undefined {
    if (validTps.length === 0) return undefined;
    if (validTps.length === 1) {
        const tp = validTps[0];
        return `목표가 $${tp.toFixed(2)} (${formatSignedPct(entryPrice, tp)})에서 익절`;
    }
    const tpParts = validTps.map(
        (tp, idx) =>
            `${ordinalLabel(idx)} 목표 $${tp.toFixed(2)} (${formatSignedPct(entryPrice, tp)})`
    );
    return `${tpParts.join(', ')}에서 익절`;
}

/** 유효한 SL을 exit 텍스트 파트로 포맷. 무효값이면 undefined. */
function buildExitSlPart(
    entryPrice: number,
    stopLoss: number | undefined
): string | undefined {
    if (
        stopLoss === undefined ||
        !Number.isFinite(stopLoss) ||
        stopLoss <= 0 ||
        stopLoss >= entryPrice
    ) {
        return undefined;
    }
    return `손절 $${stopLoss.toFixed(2)} (${formatSignedPct(entryPrice, stopLoss)})`;
}

/** bullish 포지션 SL/TP 기반 exit 텍스트 생성. 유효하지 않은 파트는 생략한다. */
export function buildBullishExitText(
    entryPrice: number,
    stopLoss: number | undefined,
    takeProfitPrices: readonly number[] | undefined
): string {
    const validTps = (takeProfitPrices ?? []).filter(
        (tp): tp is number =>
            typeof tp === 'number' && Number.isFinite(tp) && tp > entryPrice
    );

    const parts = [
        buildExitTpPart(entryPrice, validTps),
        buildExitSlPart(entryPrice, stopLoss),
    ].filter((p): p is string => p !== undefined);

    return parts.length > 0 ? parts.join(', ') + '.' : '';
}

/** bullish 롱 포지션의 signed 위험:보상 비율 텍스트. SL/TP 중 하나라도 무효면 빈 문자열. */
export function buildBullishRiskRewardText(
    entryPrice: number,
    stopLoss: number | undefined,
    takeProfitPrices: readonly number[] | undefined
): string {
    if (
        stopLoss === undefined ||
        !Number.isFinite(stopLoss) ||
        stopLoss <= 0 ||
        stopLoss >= entryPrice
    )
        return '';
    const tp = takeProfitPrices?.[0];
    // tp가 entryPrice보다 크지 않으면 R:R이 음수가 되어 사용자 혼란 → 빈 문자열
    if (tp === undefined || !Number.isFinite(tp) || tp <= entryPrice) return '';

    const slPct = ((stopLoss - entryPrice) / entryPrice) * 100;
    const tpPct = ((tp - entryPrice) / entryPrice) * 100;
    const riskAbs = Math.abs(slPct);
    if (riskAbs === 0) return '';

    const slLabel = `${slPct.toFixed(1)}%`;
    const tpLabel =
        tpPct >= 0 ? `+${tpPct.toFixed(1)}%` : `${tpPct.toFixed(1)}%`;
    const ratio = (tpPct / riskAbs).toFixed(1);

    return `손절 ${slLabel} vs 목표 ${tpLabel} → 위험:보상 = 1:${ratio}`;
}

/** 보정 경위 문장 생성 (SL·TP 누락·무효 여부 조합 4가지). */
function buildReconcileReason(
    slWas: boolean,
    tpWas: boolean,
    aiSlMissing: boolean,
    aiTpMissing: boolean
): string {
    if (slWas && tpWas) {
        return aiSlMissing && aiTpMissing
            ? 'AI가 손절·목표가를 제시하지 않아 ATR 기반 기본값을 계산했습니다.'
            : 'AI가 제시한 손절·목표가 중 일부가 내부 기준을 벗어나 보정했습니다.';
    }
    if (slWas) {
        return aiSlMissing
            ? 'AI가 손절가를 제시하지 않아 ATR 기반 기본값을 계산했습니다.'
            : 'AI가 제시한 손절가가 내부 기준을 벗어나 보정했습니다.';
    }
    return aiTpMissing
        ? 'AI가 목표가를 제시하지 않아 ATR 기반 기본값을 계산했습니다.'
        : 'AI가 제시한 목표가가 내부 기준을 벗어나 보정했습니다.';
}

/** bullish 추천에 SL/TP 보정을 적용한다. AI 원본 필드는 수정하지 않고 reconciledLevels에만 보정값을 병기한다. */
export function reconcileBullishActionRecommendation(
    rec: ActionRecommendation,
    entryPrice: number,
    atr: number | undefined
): ReconcileResult {
    // avoid: AI가 의도적으로 레벨을 비운 것이므로 보정하지 않는다.
    if (rec.entryRecommendation === 'avoid') {
        return { recommendation: rec, wasReconciled: false, changes: [] };
    }

    const slResolved = resolveBullishStopLoss(rec.stopLoss, entryPrice, atr);
    const tpResolved = resolveBullishTakeProfit(
        rec.takeProfitPrices?.[0],
        entryPrice,
        atr
    );

    const slWasReconciled =
        slResolved.source === 'fallback' && slResolved.value !== undefined;
    const tpWasReconciled =
        tpResolved.source === 'fallback' && tpResolved.value !== undefined;

    if (!slWasReconciled && !tpWasReconciled) {
        return { recommendation: rec, wasReconciled: false, changes: [] };
    }

    // tpWasReconciled 게이트로 value가 number임이 런타임 보장되지만 TS가 좁히기를
    // 전파하지 못해, narrowing을 지역 const로 고정해 `!` 단언을 제거한다.
    const tpFallback = tpResolved.value;
    // TP 배열 보정 시 entryPrice 초과 유효값만 유지하고 오름차순 정렬.
    // [0]이 fallback으로 교체됐을 때 기존 [1..]과 순서가 역전되는 경우 방지.
    const reconciledTpArr: readonly number[] | undefined =
        tpWasReconciled && tpFallback !== undefined
            ? [
                  tpFallback,
                  ...(rec.takeProfitPrices?.slice(1) ?? []).filter(
                      tp => Number.isFinite(tp) && tp > entryPrice
                  ),
              ].toSorted((a, b) => a - b)
            : rec.takeProfitPrices;

    const reconciledSl = slWasReconciled ? slResolved.value : rec.stopLoss;

    const aiSlMissing = rec.stopLoss === undefined;
    const aiTpMissing =
        rec.takeProfitPrices === undefined ||
        rec.takeProfitPrices.length === 0 ||
        rec.takeProfitPrices[0] === undefined;

    const reconciled: ReconciledActionLevels = {
        stopLoss: reconciledSl,
        takeProfitPrices: reconciledTpArr,
        exit: buildBullishExitText(entryPrice, reconciledSl, reconciledTpArr),
        riskReward: buildBullishRiskRewardText(
            entryPrice,
            reconciledSl,
            reconciledTpArr
        ),
        reason: buildReconcileReason(
            slWasReconciled,
            tpWasReconciled,
            aiSlMissing,
            aiTpMissing
        ),
    };

    const changes: readonly string[] = [
        ...(slWasReconciled
            ? [
                  `stopLoss: ${rec.stopLoss ?? 'null'} → ${reconciled.stopLoss?.toFixed(2)} (fallback)`,
              ]
            : []),
        ...(tpWasReconciled
            ? [
                  `takeProfitPrices[0]: ${rec.takeProfitPrices?.[0] ?? 'null'} → ${tpResolved.value?.toFixed(2)} (fallback)`,
              ]
            : []),
    ];

    return {
        recommendation: { ...rec, reconciledLevels: reconciled }, // AI fields UNCHANGED
        wasReconciled: true,
        changes,
    };
}

/** entryPrices 중 유효한 양수의 산술 평균. 유효 원소가 없으면 fallback 반환. */
function computeEntryPriceMid(
    entryPrices: readonly number[] | undefined,
    fallback: number | undefined
): number | undefined {
    if (entryPrices && entryPrices.length > 0) {
        const valid = entryPrices.filter(p => Number.isFinite(p) && p > 0);
        if (valid.length > 0) {
            return valid.reduce((sum, p) => sum + p, 0) / valid.length;
        }
    }
    return fallback;
}

/** AnalysisResponse에 reconciledLevels를 병기한다. entryPrice 결정 불가 시 원본 반환. */
export function postProcessAnalysisWithReconcile(
    response: AnalysisResponse,
    fallbackEntryPrice: number | undefined,
    atr: number | undefined
): AnalysisResponse {
    const rec = response.actionRecommendation;
    if (!rec) return response;

    const entryPrice = computeEntryPriceMid(
        rec.entryPrices,
        fallbackEntryPrice
    );
    if (entryPrice === undefined || !Number.isFinite(entryPrice))
        return response;

    const { recommendation } = reconcileBullishActionRecommendation(
        rec,
        entryPrice,
        atr
    );
    return { ...response, actionRecommendation: recommendation };
}
