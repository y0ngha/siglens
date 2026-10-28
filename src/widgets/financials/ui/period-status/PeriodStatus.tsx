/**
 * 기간 토글 옆 상태 표시 — 분기 조회 중 스피너, 분기를 못 가져왔을 때의 짧은 안내.
 */
import { useTranslations } from 'next-intl';
import { Spinner } from '@/shared/ui/Spinner';

interface PeriodStatusProps {
    isLoading: boolean;
    /** 분기 조회가 실패해 연간으로 되돌아왔는지. */
    quarterUnavailable: boolean;
}

/** 조회 중이면 스피너를, 실패했으면 안내 문구를 `role="status"`로 알린다. 둘 다 아니면 비운다. */
export function PeriodStatus({
    isLoading,
    quarterUnavailable,
}: PeriodStatusProps) {
    const t = useTranslations('widgets.financials');
    const tPeriod = useTranslations('widgets.financials.periodToggle');

    if (isLoading) {
        return (
            <span
                className="flex items-center gap-1.5 text-xs text-secondary-400"
                role="status"
                aria-live="polite"
            >
                <Spinner size="sm" />
                {t('FinancialsStatements.c78656')}
            </span>
        );
    }

    if (quarterUnavailable) {
        return (
            <span
                className="text-xs text-secondary-400"
                role="status"
                aria-live="polite"
            >
                {tPeriod('quarterUnavailable')}
            </span>
        );
    }

    return null;
}
