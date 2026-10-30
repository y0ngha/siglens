'use client';

import { useTranslations } from 'next-intl';
import type { OptionsSignal } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { SignalBadge } from './SignalBadge';

interface SignalsSectionProps {
    signals: ReadonlyArray<OptionsSignal>;
}

/** Signals bullet list; renders nothing when there are no signals. */
export function SignalsSection({ signals }: SignalsSectionProps) {
    const t = useTranslations('widgets.options');
    if (signals.length === 0) return null;
    return (
        <div>
            <h3 className={cn('mb-3', HEADING_SUBSECTION)}>
                {t('OptionsAiAnalysis.598bf4')}
            </h3>
            <ul
                className="space-y-2"
                aria-label={t('OptionsAiAnalysis.e0c6a1')}
            >
                {signals.map(signal => (
                    <li
                        // The AI rarely emits duplicate `${kind}::${message}`
                        // pairs, so the composite avoids an index key.
                        key={`${signal.kind}::${signal.message}`}
                        className="flex min-w-0 items-start gap-2 text-sm text-secondary-400"
                    >
                        <span
                            aria-hidden="true"
                            className="mt-0.5 shrink-0 text-secondary-500"
                        >
                            •
                        </span>
                        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <SignalBadge kind={signal.kind} />
                            <span className="min-w-0 leading-relaxed">
                                {signal.message}
                            </span>
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
