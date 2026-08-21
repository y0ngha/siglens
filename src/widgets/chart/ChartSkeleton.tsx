import { useTranslations } from 'next-intl';
export function ChartSkeleton() {
    const t = useTranslations('widgets.chart');
    return (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-secondary-900/60">
            <span className="text-sm text-secondary-400">
                {t('ChartSkeleton.486c8b')}
            </span>
        </div>
    );
}
