/**
 * 섹터 신호 조회가 실패했을 때의 안내와 재시도 버튼.
 */
import { useTranslations } from 'next-intl';
import { ErrorAlert } from '@/shared/ui/ErrorAlert';

interface SectorSignalErrorProps {
    onRetry: () => void;
}

/** 실패를 "신호 없음"으로 그리지 않고 알리며, 사용자가 직접 다시 불러올 수 있게 한다. */
export function SectorSignalError({ onRetry }: SectorSignalErrorProps) {
    const t = useTranslations('widgets.dashboard');
    return (
        <div className="py-4">
            <ErrorAlert message={t('SectorSignalPanel.loadFailed')} />
            <button
                type="button"
                onClick={onRetry}
                className="inline-flex min-h-11 items-center rounded bg-primary-600 px-3 py-2 text-xs text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-950 focus-visible:outline-none"
            >
                {t('SectorSignalPanel.retry')}
            </button>
        </div>
    );
}
