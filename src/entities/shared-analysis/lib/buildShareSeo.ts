import type { Metadata } from 'next';
import type { SharedAnalysisLookup } from '../types';
import { buildOgText } from '../server/buildOgText';
import { SITE_NAME } from '@/shared/lib/seo';

/**
 * 공유 페이지(`/share/[id]`) generateMetadata 반환값 빌더.
 *
 * found 상태에서는 종목명·분석 요약을 담은 메타데이터를 구성하되,
 * SEO 크롤링은 막는다(robots noindex): 공유 스냅샷은 시세가 고정돼 있어
 * 색인하면 stale한 분석이 검색 결과에 노출될 수 있다.
 *
 * expired / not_found 상태에서는 최소 noindex 메타데이터만 반환한다.
 */
export function buildShareMetadata(lookup: SharedAnalysisLookup): Metadata {
    if (lookup.status === 'found') {
        const { snapshot } = lookup;
        const ticker = snapshot.symbol.toUpperCase();
        const title = `${ticker} AI 분석 결과`;
        const { description } = buildOgText(snapshot);

        return {
            title,
            description,
            robots: { index: false, follow: false },
            // canonical: null mirrors the NOINDEX_SYMBOL_METADATA pattern:
            // noindex pages should not declare a canonical URL so crawlers do
            // not accidentally attribute the snapshot URL as authoritative.
            alternates: { canonical: null },
            openGraph: {
                type: 'website',
                siteName: SITE_NAME,
                title,
                description,
                locale: 'ko_KR',
            },
            twitter: {
                card: 'summary_large_image',
                title,
                description,
            },
        };
    }

    // expired | not_found — minimal noindex; canonical: null for the same reason.
    return {
        title: '공유 분석',
        robots: { index: false },
        alternates: { canonical: null },
    };
}
