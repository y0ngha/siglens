'use client';

/**
 * Read-only presentational view of a FearGreedSnapshot for the share/[id] panel.
 * Renders the hero gauge, group bars, and warning badge from a static snapshot
 * without needing live hooks.
 */

import { useTranslations } from 'next-intl';
import type { FearGreedSnapshot } from '@y0ngha/siglens-core';
import { FearGreedHero } from './FearGreedHero';
import { FearGreedGroupBar } from './FearGreedGroupBar';
import { SelfNormWarningBadge } from './SelfNormWarningBadge';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';

interface FearGreedShareViewProps {
    snapshot: FearGreedSnapshot;
}

/**
 * Static display of a fear-greed snapshot.
 * Intentionally omits FearGreedComparisonGauges (requires history data)
 * and FearGreedHistoricalChart (requires history data) since the snapshot
 * alone does not carry history. Only the current-score sections are rendered.
 */
export function FearGreedShareView({ snapshot }: FearGreedShareViewProps) {
    const t = useTranslations('widgets.fear-greed');
    return (
        <div className="flex flex-col gap-6 p-4 md:p-6">
            <div className="grid gap-6 md:grid-cols-2">
                <section className="flex flex-col gap-3">
                    <h2 className={HEADING_SECTION}>
                        {t('FearGreedShareView.d9e96a')}
                    </h2>
                    <FearGreedHero snapshot={snapshot} />
                    <SelfNormWarningBadge warning={snapshot.warning} />
                </section>

                <section className="flex flex-col gap-3">
                    <h2 className="sr-only">
                        {t('FearGreedShareView.0506ae')}
                    </h2>
                    {snapshot.groups.map(group => (
                        <FearGreedGroupBar key={group.name} group={group} />
                    ))}
                </section>
            </div>
        </div>
    );
}
