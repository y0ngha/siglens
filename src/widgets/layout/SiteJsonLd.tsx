import { SITE_NAME, SITE_URL } from '@/shared/lib/seo';
import { JsonLd } from '@/shared/ui/JsonLd';

export function SiteJsonLd() {
    const data = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        // @id로 IRI를 박아 다른 페이지의 WebPage가 isPartOf로 정확히 참조할 수
        // 있게 한다 — schema.org 권장 entity graph 패턴.
        '@id': `${SITE_URL}#website`,
        name: SITE_NAME,
        url: SITE_URL,
        /*
         * `potentialAction`(SearchAction)은 뺐다.
         *
         * 그 마크업의 유일한 용도였던 **사이트링크 검색창**을 구글이 2023-11에
         * 폐기했다 — 지금은 어떤 검색 기능도 만들지 않는 장식이다. 게다가 우리
         * 구현은 사실과 어긋나 있었다: `urlTemplate`이 가리키는 `/?q=apple`은
         * 검색 결과 페이지가 아니라 `/APPLE`로 307 리다이렉트되고, 그 심볼이
         * 없으면 404다(2026-09-18 운영 실측). 아무것도 못 얻는 마크업이 거짓
         * 주장까지 하고 있던 셈이다.
         *
         * ⚠️ `?q=` 핸들러 자체는 남긴다(`proxy.ts`) — 티커를 아는 사용자가 쓰는
         * 딥링크로 여전히 동작한다. 지우는 것은 "검색 엔드포인트가 있다"는 **선언**뿐이다.
         */
    };
    return <JsonLd data={data} />;
}
