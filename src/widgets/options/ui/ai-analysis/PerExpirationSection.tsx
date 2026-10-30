'use client';

import { useTranslations } from 'next-intl';
import type { OptionsPerExpirationCommentary } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { ToneBadge } from './ToneBadge';

interface PerExpirationSectionProps {
    items: ReadonlyArray<OptionsPerExpirationCommentary>;
}

/** "만기별 해석" list; renders nothing when there are no items. */
export function PerExpirationSection({ items }: PerExpirationSectionProps) {
    const t = useTranslations('widgets.options');
    if (items.length === 0) return null;
    return (
        <div className="mb-5">
            <h3 className={cn('mb-3', HEADING_SUBSECTION)}>
                {t('OptionsAiAnalysis.e26a05')}
            </h3>
            <ul
                className="space-y-3"
                aria-label={t('OptionsAiAnalysis.440d96')}
            >
                {items.map(item => (
                    <li
                        key={item.expirationDate}
                        className={cn(SURFACE_NESTED, 'p-3')}
                    >
                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                            <span className="text-xs font-medium text-secondary-200 tabular-nums">
                                {item.expirationDate}
                            </span>
                            <ToneBadge tone={item.tone} />
                        </div>
                        <p className="text-sm leading-relaxed text-secondary-400">
                            {item.commentary}
                        </p>
                    </li>
                ))}
            </ul>
        </div>
    );
}
