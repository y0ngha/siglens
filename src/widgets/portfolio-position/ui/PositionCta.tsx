import { useTranslations } from 'next-intl';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { formatAmount } from '../lib/positionBuildingNotes';

interface PositionCtaProps {
    symbol: string;
    low52w: number | null;
    high52w: number | null;
}

/**
 * Shared CTA card shown to both anonymous visitors and members with no holding
 * on this symbol — "내 위치" needs an avg purchase price to draw a building, so
 * there is nothing personalized to render for either audience. Kept as a plain
 * presentational component (no hooks) so the guest gate in `PositionTabContent`
 * can render it directly without pulling in the lazy member chunk.
 */
export function PositionCta({ symbol, low52w, high52w }: PositionCtaProps) {
    const t = useTranslations('widgets.portfolio-position');
    return (
        <section
            data-testid="position-cta"
            className="flex flex-col items-start gap-3 rounded-xl border border-secondary-700 bg-secondary-800/40 p-6"
        >
            <p className="text-sm font-semibold text-secondary-100">
                {t('PositionCta.019ed7')}
            </p>
            <p className="text-sm leading-relaxed text-secondary-400">
                {t('PositionCta.5cd686')}
            </p>
            {low52w !== null && high52w !== null && (
                <p
                    data-testid="position-cta-range"
                    className="text-xs text-secondary-400 tabular-nums"
                >
                    {t('PositionCta.2bf3cd', {
                        v0: formatAmount(low52w, symbol),
                    })}{' '}
                    ~ {formatAmount(high52w, symbol)}
                </p>
            )}
            <Link
                href="/onboarding"
                className="inline-flex min-h-11 touch-manipulation items-center rounded-lg border border-primary-500 px-4 text-sm font-medium text-primary-300 transition-colors hover:bg-primary-500/10 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
                {t('PositionCta.5edaf2')}
            </Link>
        </section>
    );
}
