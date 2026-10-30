/**
 * 10b5-1 사전 매매 계획으로 낸 Form 144 신고 배지.
 */
import { useTranslations } from 'next-intl';

/** 10b5-1 계획 배지. */
export function PlanBadge() {
    const t = useTranslations('widgets.investor-flows');
    return (
        <span className="inline-flex items-center rounded bg-secondary-700 px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-secondary-200">
            {t('form144.planBadge')}
        </span>
    );
}
