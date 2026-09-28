import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { Spinner } from '@/shared/ui/Spinner';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';

const SKELETON_LINE_WIDTHS = [
    'w-full',
    'w-[92%]',
    'w-4/5',
    'w-3/5',
    'w-2/3',
] as const;

export function OptionsAiAnalysisSkeleton() {
    const t = useTranslations('widgets.options');
    return (
        <section
            className={cn(SURFACE_CARD, 'p-6')}
            aria-busy="true"
            aria-label={t('OptionsAiAnalysisSkeleton.673e73')}
        >
            <div className="flex items-center gap-2">
                <Spinner size="sm" />
                <span className="text-xs tracking-[0.01em] text-secondary-400">
                    {t('OptionsAiAnalysisSkeleton.a88633')}
                </span>
            </div>
            <div className="mt-4 space-y-2" aria-hidden="true">
                {SKELETON_LINE_WIDTHS.map(w => (
                    <div
                        key={w}
                        className={cn(
                            'bg-secondary-700 h-3 animate-pulse rounded',
                            w
                        )}
                    />
                ))}
            </div>
        </section>
    );
}
