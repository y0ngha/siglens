import { useTranslations } from 'next-intl';
import { type MarketProfileId } from '@/shared/config/marketProfile/types';
import type { NewsDisplayItem } from '@/shared/lib/types';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { cn } from '@/shared/lib/cn';
import { useFactualAxesText } from './hooks/useFactualAxesText';

export interface OverallFactualFallbackProps {
    displayName: string;
    marketProfile: MarketProfileId;
    newsItems: readonly NewsDisplayItem[];
}

/**
 * `overall/page.tsx`의 Suspense fallback으로 렌더되는 SSR HTML이다. `OverallContent`가
 * client 컴포넌트라 JS 없이 접근하는 크롤러에게는 이 fallback이 사실상 최종 콘텐츠다.
 * 축 문구는 `marketProfile`의 실제 탭 구성을 따라 존재하지 않는 분석을 약속하지 않는다.
 */
export function OverallFactualFallback({
    displayName,
    marketProfile,
    newsItems,
}: OverallFactualFallbackProps) {
    const t = useTranslations('widgets.overall');
    const axesText = useFactualAxesText(marketProfile);
    const headingId = 'overall-factual-fallback-heading';
    const analyzedNewsCount = newsItems.filter(
        item => item.sentiment !== null
    ).length;

    return (
        <section
            aria-labelledby={headingId}
            className={cn(SURFACE_CARD, 'p-5')}
        >
            <h2 id={headingId} className={HEADING_SECTION}>
                {displayName} {t('OverallFactualFallback.87d0df')}
            </h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-secondary-300">
                <p>
                    {/* `displayName`이 이미 `(AAPL)`을 품고 있어 괄호를 따로 덧붙이지 않는다. */}
                    {t('OverallFactualFallback.ab960a', {
                        v0: displayName,
                        v1: axesText,
                    })}
                </p>
                {newsItems.length > 0 ? (
                    <p>
                        {t('OverallFactualFallback.278a07', {
                            v0: newsItems.length,
                            v1: analyzedNewsCount,
                        })}
                    </p>
                ) : (
                    <p>{t('OverallFactualFallback.3a92a1')}</p>
                )}
                <p>{t('OverallFactualFallback.ea75f6')}</p>
            </div>
        </section>
    );
}
