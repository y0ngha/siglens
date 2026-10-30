'use client';

import { useTranslations } from 'next-intl';
import { usePortfolioHoldings } from '@/entities/portfolio/hooks/usePortfolioHoldings';
import type {
    RawHoldingInput,
    SavePortfolioResult,
} from '@/entities/portfolio/model';
import type { UseWatchlistResult } from '@/features/watchlist/hooks/useWatchlist';
import { useToast } from '@/shared/ui/ToastProvider';

/** "보유로 전환" 저장 함수와 저장 중 여부. */
export interface UseConvertToHoldingResult {
    /** 보유를 저장하고, 성공하면 그 종목을 관심 목록에서 지운다. 저장 결과를 그대로 돌려준다. */
    convert: (input: RawHoldingInput) => Promise<SavePortfolioResult>;
    isSaving: boolean;
}

/**
 * 관심 항목 → 보유 전환. `removeFromWatchlist`는 호출부가 이미 가진 `useWatchlist().remove`다 —
 * 훅을 한 번 더 부르면 목록 구독이 겹친다. 보유 목록은 읽지 않고(`enabled: false`) 저장 변이만
 * 쓴다. 보유는 이미 저장됐는데 관심 항목 삭제가 실패하면(훅이 띄운 일반 실패 토스트를 교체해)
 * 무엇이 됐고 무엇이 안 됐는지 구체적으로 알린다.
 */
export function useConvertToHolding(
    removeFromWatchlist: UseWatchlistResult['remove']
): UseConvertToHoldingResult {
    const t = useTranslations('features.watchlist');
    const { showToast } = useToast();
    const { save } = usePortfolioHoldings({ enabled: false });

    const convert = async (
        input: RawHoldingInput
    ): Promise<SavePortfolioResult> => {
        const result = await save.mutateAsync(input);
        if (result.status !== 'ok') return result;
        if (!(await removeFromWatchlist(result.holding.symbol))) {
            showToast({ message: t('toast.holdingKeptInWatchlist') });
        }
        return result;
    };

    return { convert, isSaving: save.isPending };
}
