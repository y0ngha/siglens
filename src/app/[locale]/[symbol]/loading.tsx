import { useTranslations } from 'next-intl';
// Layout (`/[symbol]/layout.tsx`) already renders the breadcrumb + tabs, so this
// fallback only fills the page slot below the layout header while the chart page
// resolves its data. The chart page renders its own TimeframeSelector once mounted.
export default function SymbolLoading() {
    const t = useTranslations('app.symbol');
    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-secondary-900 text-secondary-200">
            <div className="relative flex min-h-0 flex-1 overflow-hidden">
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-secondary-900/60">
                    <span className="text-sm text-secondary-400">
                        {t('loading.486c8b')}
                    </span>
                </div>
            </div>
        </div>
    );
}
