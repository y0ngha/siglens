import type { Locale } from '@/shared/i18n/locales';
import { localeOpenGraph } from '@/shared/lib/seoAlternates';

/** `entities.shared-analysis.seo` 네임스페이스 번역자. */
type ShareSeoTranslator = (
    key: string,
    values?: Record<string, string | number>
) => string;
import type { Metadata } from 'next';
import type { SharedAnalysisLookup } from '../types';
import { buildOgText, type OgTranslator } from '../server/buildOgText';
import { SITE_NAME, localizedAbsoluteUrl } from '@/shared/lib/seo';

/**
 * 공유 페이지(`/share/[id]`) generateMetadata 반환값 빌더.
 *
 * found 상태에서는 종목명·분석 요약을 담은 메타데이터를 구성하되,
 * SEO 크롤링은 막는다(robots noindex): 공유 스냅샷은 시세가 고정돼 있어
 * 색인하면 stale한 분석이 검색 결과에 노출될 수 있다.
 *
 * expired / not_found 상태에서는 최소 noindex 메타데이터만 반환한다.
 */
/**
 * `id`는 선택 인자가 아니다. 선택으로 두면 호출부가 빠뜨려도 타입·린트·테스트가
 * 전부 통과하면서 og:url만 조용히 사라진다 — 이 브랜치에서 반복적으로 나온
 * "아무것도 붙들지 않는 수정" 형태다. 필수로 두면 컴파일러가 붙든다.
 */
export function buildShareMetadata(
    lookup: SharedAnalysisLookup,
    id: string,
    t: ShareSeoTranslator,
    locale: Locale,
    tOg: OgTranslator
): Metadata {
    if (lookup.status === 'found') {
        const { snapshot } = lookup;
        const ticker = snapshot.symbol.toUpperCase();
        const title = t('title', { v0: ticker });
        const { description } = buildOgText(snapshot, tOg);

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
                // 예전에는 `'ko_KR'` 고정이라 `/ja/share/x`가 한국어 로케일을
                // 광고했다.
                ...localeOpenGraph(locale),
                // 이 페이지의 존재 이유가 채팅앱에 붙여넣는 것인데 og:url이
                // 없었다. 없으면 루트 레이아웃의 og:url(홈)이 상속돼, 언펄러가
                // 공유 스냅샷 카드에 홈 주소를 붙이거나 서로 다른 공유 링크를
                // 같은 대상으로 접는다.
                //
                // canonical과 헷갈리지 말 것 — 위 `canonical: null`은
                // noindex 페이지가 스스로를 정본이라고 선언하지 않게 하려는
                // 것이고, og:url은 색인 신호가 아니라 언펄링 대상 주소다.
                // 둘은 서로 상충하지 않는다.
                url: localizedAbsoluteUrl(`/share/${id}`, locale),
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
        title: t('expiredTitle'),
        robots: { index: false },
        alternates: { canonical: null },
    };
}
