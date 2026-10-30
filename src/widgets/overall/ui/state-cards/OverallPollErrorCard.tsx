'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';

/**
 * 뉴스 카드 분석 준비가 누적 실패로 끝났을 때의 안내. 시작 CTA 자리를 대신하며,
 * `OverallContent`는 ErrorBoundary로 감싸지 않아 throw하면 페이지 전체가 죽으므로
 * 자체 카드로 새로고침 기회를 준다.
 */
export function OverallPollErrorCard() {
    const t = useTranslations('widgets.overall');
    return (
        <section
            aria-labelledby="overall-cta-poll-error-heading"
            role="alert"
            className={cn(SURFACE_CARD, 'border-ui-danger/30 p-6 text-center')}
        >
            <h2
                id="overall-cta-poll-error-heading"
                className={cn(HEADING_SECTION, 'mb-2 text-balance')}
            >
                {t('OverallContent.8b7ae7')}
            </h2>
            <p className="text-sm text-ui-danger-text">
                {t('OverallContent.1c85d8')}
            </p>
            <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-4 inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-800 focus-visible:outline-none"
            >
                {t('OverallContent.0c767c')}
            </button>
        </section>
    );
}
