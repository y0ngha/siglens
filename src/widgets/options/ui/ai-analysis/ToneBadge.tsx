'use client';

import { useTranslations } from 'next-intl';
import type { OptionsTone } from '@y0ngha/siglens-core';
import { TONE_CLASS, TONE_LABEL_KEY } from '../../utils/optionsAnalysisBadges';
import { AnalysisBadge } from './AnalysisBadge';

interface ToneBadgeProps {
    tone: OptionsTone;
}

/** Localized badge for a per-expiration tone. */
export function ToneBadge({ tone }: ToneBadgeProps) {
    const tLabel = useTranslations('shared.enumLabel');
    return (
        <AnalysisBadge
            label={tLabel(TONE_LABEL_KEY[tone])}
            classes={TONE_CLASS[tone]}
        />
    );
}
