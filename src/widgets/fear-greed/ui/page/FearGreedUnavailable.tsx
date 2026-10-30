import { useTranslations } from 'next-intl';

/** 표본이 모자라 점수를 낼 수 없을 때의 안내 문구. */
export function FearGreedUnavailable() {
    const t = useTranslations('widgets.fear-greed');
    return (
        <div className="flex flex-col gap-2 p-6 text-sm text-secondary-400">
            <p>{t('FearGreedPage.d6e558')}</p>
            <p className="text-xs text-secondary-500">
                {t('FearGreedPage.ef5b22')}
            </p>
        </div>
    );
}
