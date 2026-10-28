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

/**
 * 조회 중이면 스피너를, 실패했으면 안내 문구를 알린다. 라이브 영역은 내용이 없을 때도 마운트해 둔다 —
 * 내용과 함께 새로 생기는 `role="status"`는 스크린 리더가 놓칠 수 있고, 자리를 미리 잡아 두면
 * 문구가 나타나고 사라질 때 토글 줄의 높이도 흔들리지 않는다.
 */
export function PeriodStatus({
    isLoading,
    quarterUnavailable,
}: PeriodStatusProps) {
    const t = useTranslations('widgets.financials');
    const tPeriod = useTranslations('widgets.financials.periodToggle');

    return (
        <span
            className="flex min-h-5 min-w-0 items-center justify-end gap-1.5 text-right text-xs text-secondary-400"
            role="status"
            aria-live="polite"
        >
            {isLoading ? (
                <>
                    <Spinner size="sm" />
                    {t('FinancialsStatements.c78656')}
                </>
            ) : (
                quarterUnavailable && tPeriod('quarterUnavailable')
            )}
        </span>
    );
}
