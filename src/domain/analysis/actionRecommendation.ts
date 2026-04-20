import type {
    ActionRecommendation,
    ReconciledActionLineData,
    ValidatedActionPrices,
} from '@/domain/types';

export function validateActionPrices(
    rec: ActionRecommendation | undefined
): ValidatedActionPrices | undefined {
    if (!rec) return undefined;

    const entryPrices = (rec.entryPrices ?? []).filter(p => p > 0);
    const stopLoss =
        rec.stopLoss !== undefined && rec.stopLoss > 0
            ? rec.stopLoss
            : undefined;
    const takeProfitPrices = (rec.takeProfitPrices ?? []).filter(p => p > 0);

    if (
        entryPrices.length === 0 &&
        stopLoss === undefined &&
        takeProfitPrices.length === 0
    ) {
        return undefined;
    }

    return { entryPrices, stopLoss, takeProfitPrices };
}

/**
 * 차트 오버레이용 "보정값 라인" 정보 추출.
 *
 * AI 원본(`rec.stopLoss`, `rec.takeProfitPrices`)과 보정값(`rec.reconciledLevels`)을
 * 비교해, **값이 실제로 다른 인덱스만** 포함하는 구조를 반환한다.
 *
 * - 보정값 stopLoss가 AI 값과 동일하면 stopLoss는 생략 (중복 라인 방지)
 * - 보정값 takeProfitPrices[i]가 AI 값 [i]와 동일하면 해당 인덱스는 생략
 * - 반환되는 takeProfitPrices는 총 TP 개수(totalCount)를 함께 담아 라벨 분기에 사용한다.
 */
export function extractReconciledActionLines(
    rec: ActionRecommendation | undefined
): ReconciledActionLineData | undefined {
    const reconciled = rec?.reconciledLevels;
    if (!rec || !reconciled) return undefined;

    const aiSl = rec.stopLoss;
    const reconciledSl = reconciled.stopLoss;
    const slToRender =
        reconciledSl !== undefined && reconciledSl > 0 && reconciledSl !== aiSl
            ? reconciledSl
            : undefined;

    const reconciledTps = reconciled.takeProfitPrices ?? [];
    const totalCount = reconciledTps.length;
    const tpsToRender = reconciledTps.flatMap((reconciledTp, index) => {
        const aiTp = rec.takeProfitPrices?.[index];
        if (
            reconciledTp === undefined ||
            reconciledTp <= 0 ||
            reconciledTp === aiTp
        ) {
            return [];
        }
        return [{ index, price: reconciledTp, totalCount }];
    });

    if (slToRender === undefined && tpsToRender.length === 0) return undefined;

    return {
        stopLoss: slToRender,
        takeProfitPrices: tpsToRender,
    };
}
