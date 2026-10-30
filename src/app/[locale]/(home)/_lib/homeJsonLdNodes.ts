import { SITE_NAME, SITE_NAME_KO } from '@/shared/config/brand';
import { LOCALE_HREFLANG, type Locale } from '@/shared/i18n/locales';
import {
    ABOUT_PATH,
    OPERATOR_PERSON_JSON_LD_ID,
    OPERATOR_SAME_AS,
    SITE_OPERATOR,
} from '@/shared/lib/legal';
import {
    buildOrganizationCoreJsonLd,
    buildWebPageJsonLd,
    GITHUB_URL,
    localizedAbsoluteUrl,
    ORGANIZATION_JSON_LD_ID,
    SITE_URL,
    VELOG_URL,
    X_URL,
} from '@/shared/lib/seo';

/** 홈 JSON-LD 노드가 공유하는 입력. 문구는 호출부가 로케일 카탈로그에서 푼다. */
export interface HomeJsonLdInput {
    readonly locale: Locale;
    /** 홈 `<title>`과 같은 문자열 — `WebPage.name`이 SERP 제목과 어긋나지 않게 한다. */
    readonly title: string;
    readonly description: string;
}

/** 홈이 싣는 엔티티 그래프 노드. `FAQPage`는 화면 FAQ와 같은 배열에서 따로 만든다. */
export interface HomeJsonLdNodes {
    readonly webApplication: Record<string, unknown>;
    readonly webPage: Record<string, unknown>;
    readonly organization: Record<string, unknown>;
}

/**
 * 홈의 `WebApplication`·`WebPage`·`Organization` 노드.
 *
 * 세 노드는 `@id`로 서로를 잇는다 — `WebPage.mainEntity`가 `WebApplication`을,
 * `WebPage.publisher`가 `Organization`을 가리킨다. 참조가 없으면 그 노드는 그래프에서 떨어져
 * 파서가 같은 사이트의 발행 주체를 별개 엔티티로 읽는다. `@id`·`url`·`inLanguage`는 로케일을
 * 따른다 — 네 로케일이 같은 `@id`를 쓰면 한 문서가 여러 언어를 주장하게 된다.
 */
export function buildHomeJsonLdNodes({
    locale,
    title,
    description,
}: HomeJsonLdInput): HomeJsonLdNodes {
    const homeUrl = localizedAbsoluteUrl(SITE_URL, locale);
    const webApplicationId = `${homeUrl}#webapplication`;
    return {
        webApplication: {
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            '@id': webApplicationId,
            name: SITE_NAME,
            description,
            url: homeUrl,
            inLanguage: LOCALE_HREFLANG[locale],
            applicationCategory: 'FinanceApplication',
            operatingSystem: 'Web',
            offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'KRW',
            },
        },
        webPage: {
            // `@id`·`url`·`inLanguage`는 헬퍼가 로케일에 맞춰 만든다.
            ...buildWebPageJsonLd({
                url: SITE_URL,
                name: title,
                description,
                locale,
            }),
            mainEntity: { '@id': webApplicationId },
            publisher: { '@id': ORGANIZATION_JSON_LD_ID },
        },
        organization: {
            '@context': 'https://schema.org',
            // 핵심 속성(@type·@id·name·url)은 전역 `SiteJsonLd`의 최소 노드와 같은 단일 소스다 —
            // 같은 `@id`의 두 정의가 겹치는 속성에서 다른 값을 말하지 않게 한다.
            ...buildOrganizationCoreJsonLd(),
            // `WebSite.alternateName`과 같은 한글 표기 — "시그렌즈"가 이 Organization을 가리키게 한다.
            alternateName: SITE_NAME_KO,
            logo: `${SITE_URL}/icon512.png`,
            description,
            // 조직의 외부 프로필만 싣는다. 운영자 개인 GitHub은 사람의 프로필이라
            // `founder.sameAs`에만 둔다 — 섞으면 파서가 조직과 운영자를 같은 주체로 읽는다.
            sameAs: [GITHUB_URL, X_URL, VELOG_URL],
            // `/about`의 `Person` 노드와 같은 `@id`라 두 페이지의 사람이 하나로 합쳐진다.
            founder: {
                '@type': 'Person',
                '@id': OPERATOR_PERSON_JSON_LD_ID,
                name: SITE_OPERATOR.name,
                url: `${SITE_URL}${ABOUT_PATH}`,
                sameAs: OPERATOR_SAME_AS,
            },
        },
    };
}
