import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { DashboardScope } from '@/shared/config/dashboardScope';
import { resolveLocale } from '@/shared/i18n/locales';
import { buildHubMetadata } from '@/shared/lib/seoAlternates';
import { rssAlternateTypes } from '@/shared/config/rssFeed';
import { marketCopyFor } from './copy';
import { loadMarketSignals } from './loadMarketSignals';

/**
 * `/market`·`/market/kr`의 `generateMetadata` 본체. 두 라우트는 scope만 다르다.
 *
 * variant URL(?sector=, ?timeframe=)은 noindex 대신 clean canonical(/market)로
 * 색인 통합한다 — canonical과 noindex를 동시에 거는 신호 충돌을 제거. 단, 두
 * loader가 모두 실패해 본문이 빈 렌더로 떨어지면 economy/fear-greed와 동일하게
 * noindex + self-canonical(hreflang 없음)로 임시 상태를 색인하지 않는다.
 */
export async function marketMetadata(
    params: Promise<{ locale: string }>,
    scope: DashboardScope
): Promise<Metadata> {
    const locale = resolveLocale((await params).locale);
    const t = await getTranslations({ locale, namespace: 'shared.seo' });
    const copy = marketCopyFor(scope.id, t);
    // metadata·본문·구조화데이터가 **같은 술어**를 본다 — `loadMarketSignals` JSDoc 참조.
    const { degraded } = await loadMarketSignals(scope);
    return buildHubMetadata({
        params,
        locale,
        path: copy.path,
        title: copy.title,
        description: copy.description,
        keywords: copy.keywords,
        degraded,
        alternateTypes: rssAlternateTypes(locale),
    });
}
