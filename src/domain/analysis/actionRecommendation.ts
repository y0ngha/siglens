import type {
    ActionRecommendation,
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
