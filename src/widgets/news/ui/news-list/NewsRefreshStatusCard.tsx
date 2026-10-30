'use client';

/**
 * 뒤에서 새 기사를 받아오는 중임을 알리는 상태 카드.
 */
import { useTranslations } from 'next-intl';
import { Spinner } from '@/shared/ui/Spinner';

/** `role="status"`로 스크린리더에 갱신 중임을 알린다. */
export function NewsRefreshStatusCard() {
    const t = useTranslations('widgets.news');
    return (
        <div
            role="status"
            aria-live="polite"
            className="flex w-full max-w-full min-w-0 items-start gap-3 overflow-hidden rounded-lg border border-primary-500/30 bg-primary-500/5 p-4"
        >
            <Spinner className="mt-0.5 shrink-0" />
            <div className="min-w-0">
                <p className="text-sm font-medium text-secondary-100">
                    {t('NewsList.17ecc6')}
                </p>
                <p className="mt-1 text-xs leading-relaxed wrap-break-word text-secondary-400">
                    {t('NewsList.a61f43')}
                </p>
            </div>
        </div>
    );
}
