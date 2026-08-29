import { SITE_NAME } from '@/shared/lib/seo';

/**
 * 홈의 FAQ·HowTo JSON-LD.
 *
 * **왜 page.tsx 밖으로 뺐는가**: 이 두 블록은 사이트가 어떤 자산군을 다루는지
 * 프로즈로 선언하는 표면이고, 같은 선언이 `ROOT_TITLE`·`SITE_DESCRIPTION`·
 * `ROOT_KEYWORDS`·OG alt에도 각각 흩어져 있다. 한국 상장 종목을 추가하면서 그중
 * 일부만 고치는 일이 세 라운드 연속 반복됐다(MISTAKES.md §6.6). 컴포넌트 본문
 * 안에 있으면 렌더 없이는 검사할 수 없어 테스트로 동기화를 강제할 수가 없다 —
 * 모듈로 빼서 `supportedAssets.test.ts`가 모든 표면을 한 번에 검사한다.
 *
 * **문구는 카탈로그에 있다**(`app.home.jsonLd`). 예전에는 여기에 한국어가 박혀
 * 있어서, `/en`의 `WebPage`가 `inLanguage: "en"`을 선언하면서 12개 FAQ와 HowTo
 * 전 단계를 한국어로 내보냈다 — 한 문서가 두 언어를 주장하는 상태였다.
 */
type JsonLdTranslator = (
    key: string,
    values?: Record<string, string | number>
) => string;

/** FAQ 질문 수. 카탈로그 키(`faq.q0`…)와 1:1로 대응한다. */
const FAQ_COUNT = 12;

export function buildHomeFaqJsonLd(
    t: JsonLdTranslator
): Record<string, unknown> {
    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: Array.from({ length: FAQ_COUNT }, (_, i) => ({
            '@type': 'Question',
            name: t(`faq.q${i}.question`, { v0: SITE_NAME }),
            acceptedAnswer: {
                '@type': 'Answer',
                text: t(`faq.q${i}.answer`, { v0: SITE_NAME }),
            },
        })),
    };
}
