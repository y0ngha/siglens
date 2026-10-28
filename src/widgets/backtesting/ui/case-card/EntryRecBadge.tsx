import { useTranslations } from 'next-intl';
import type { BacktestAiEntryRecommendation } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';

interface EntryRecBadgeProps {
    recommendation: BacktestAiEntryRecommendation;
}

type BacktestTranslator = ReturnType<
    typeof useTranslations<'widgets.backtesting'>
>;

/** 진입 권고 → 배지 배색. 위험도·청산 칩처럼 모듈 레벨 표로 둔다. */
const ENTRY_REC_TONE: Record<BacktestAiEntryRecommendation, string> = {
    enter: 'bg-ui-success/10 text-ui-success-text border-ui-success/30',
    avoid: 'bg-ui-danger/10 text-ui-danger-text border-ui-danger/30',
    wait: 'bg-secondary-800 text-secondary-400 border-secondary-700',
};

/**
 * 진입 권고 → 라벨.
 *
 * 라벨은 `shared.enumLabel`이 아닌 이 위젯의 네임스페이스에 해시 키로 있다. 추출기는
 * 리터럴 키만 스캔하므로 키를 표에 담아 변수로 넘기지 않고 호출마다 리터럴로 적는다.
 */
function entryRecLabel(
    t: BacktestTranslator,
    recommendation: BacktestAiEntryRecommendation
): string {
    switch (recommendation) {
        case 'enter':
            return t('BacktestCaseCard.0f8bf6');
        case 'avoid':
            return t('BacktestCaseCard.6c8ca5');
        case 'wait':
            return t('BacktestCaseCard.540e42');
    }
}

/** AI 진입 권고(진입/관망/회피) 배지. */
export function EntryRecBadge({ recommendation }: EntryRecBadgeProps) {
    const t = useTranslations('widgets.backtesting');
    return (
        <span
            translate="no"
            className={cn(
                'rounded border px-1.5 py-0.5 text-xs font-semibold',
                ENTRY_REC_TONE[recommendation]
            )}
        >
            {entryRecLabel(t, recommendation)}
        </span>
    );
}
