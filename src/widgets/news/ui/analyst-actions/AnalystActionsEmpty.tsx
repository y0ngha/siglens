'use client';

/**
 * 등급 변경 내역이 없을 때의 빈 상태 카드.
 */
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';

/** 제목과 안내 문구만 있는 카드. */
export function AnalystActionsEmpty() {
    const t = useTranslations('widgets.news');
    return (
        <section
            aria-labelledby="analyst-actions-heading"
            className={cn(SURFACE_CARD, 'p-6')}
        >
            <h2
                id="analyst-actions-heading"
                className={cn('mb-3', HEADING_SECTION)}
            >
                {t('AnalystActions.b2cd1a')}
            </h2>
            <p className="text-sm text-secondary-400">
                {t('AnalystActions.dc2ffb')}
            </p>
        </section>
    );
}
