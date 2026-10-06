import {
    buildOrganizationCoreJsonLd,
    ORGANIZATION_JSON_LD_ID,
    SITE_NAME,
    SITE_NAME_KO,
    SITE_URL,
} from '@/shared/lib/seo';
import { JsonLd } from '@/shared/ui/JsonLd';

export function SiteJsonLd() {
    const website = {
        '@type': 'WebSite',
        // @id로 IRI를 박아 다른 페이지의 WebPage가 isPartOf로 정확히 참조할 수
        // 있게 한다 — schema.org 권장 entity graph 패턴.
        '@id': `${SITE_URL}#website`,
        name: SITE_NAME,
        // 구글의 사이트 이름 시스템이 `name` 다음으로 읽는 후보다. 한글 표기를
        // 먼저 둔다 — 영문은 동명 프로젝트와 겹쳐 식별력이 없다(`SITE_NAME_KO` 주석).
        alternateName: [SITE_NAME_KO, SITE_NAME.toUpperCase()],
        url: SITE_URL,
        // 발행 주체 `Organization` 노드를 IRI로 가리킨다. 참조 대상은 아래 `@graph`에 같이 싣는
        // 최소 노드라 홈이 아닌 페이지에서도 이 문서 안에서 풀린다.
        publisher: { '@id': ORGANIZATION_JSON_LD_ID },
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
    /*
     * `@graph`로 `WebSite`와 발행 주체 `Organization`(핵심 속성만)을 함께 싣는다. 예전에는
     * `publisher`가 `{ '@id' }`만 들고 있어 그 노드를 정의하는 홈 밖에서는 참조가 풀리지 않았다.
     * 홈은 같은 `@id`로 로고·설명·sameAs를 얹은 풍부한 노드를 따로 내는데, 핵심 속성을 둘 다
     * `buildOrganizationCoreJsonLd`에서 받으므로 파서가 두 정의를 합칠 때 값이 충돌하지 않는다.
     */
    const data = {
        '@context': 'https://schema.org',
        '@graph': [website, buildOrganizationCoreJsonLd()],
    };
    return <JsonLd data={data} />;
}
