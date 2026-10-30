'use client';

import { useTranslations } from 'next-intl';
import type { OptionsSignalKind } from '@y0ngha/siglens-core';
import {
    SIGNAL_KIND_CLASS,
    SIGNAL_KIND_LABEL_KEY,
} from '../../utils/optionsAnalysisBadges';
import { AnalysisBadge } from './AnalysisBadge';

interface SignalBadgeProps {
    kind: OptionsSignalKind;
}

/** Localized badge for a signal kind. */
export function SignalBadge({ kind }: SignalBadgeProps) {
    const tLabel = useTranslations('shared.enumLabel');
    return (
        <AnalysisBadge
            label={tLabel(SIGNAL_KIND_LABEL_KEY[kind])}
            classes={SIGNAL_KIND_CLASS[kind]}
        />
    );
}
