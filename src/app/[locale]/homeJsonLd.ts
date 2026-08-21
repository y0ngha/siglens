import type { SkillCounts } from '@y0ngha/siglens-core';
import { SITE_NAME, SITE_URL } from '@/shared/lib/seo';

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

/** HowTo 단계 — 순서와 URL은 코드가, 문구는 카탈로그가 정한다. */
const HOW_TO_STEPS = [
    { key: 'step1', url: `${SITE_URL}/#search` },
    { key: 'step2', url: `${SITE_URL}/AAPL` },
    { key: 'step3', url: `${SITE_URL}/AAPL/fundamental` },
    { key: 'step4', url: `${SITE_URL}/AAPL/options` },
    { key: 'step5', url: `${SITE_URL}/AAPL/fear-greed` },
    { key: 'step6', url: `${SITE_URL}/AAPL/overall` },
    { key: 'step7', url: `${SITE_URL}/AAPL#chat` },
] as const;

export function buildHomeHowToJsonLd(
    skillCounts: SkillCounts,
    t: JsonLdTranslator
): Record<string, unknown> {
    return {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: t('howTo.name', { v0: SITE_NAME }),
        description: t('howTo.description', { v0: SITE_NAME }),
        step: HOW_TO_STEPS.map(({ key, url }) => ({
            '@type': 'HowToStep',
            name: t(`howTo.${key}Name`),
            // 스킬 개수는 step2에만 쓰인다. 다른 단계에 넘겨도 무해하고,
            // 단계마다 다른 값 목록을 만드는 것보다 읽기 쉽다.
            text: t(`howTo.${key}Text`, {
                v0: skillCounts.indicators,
                v1: skillCounts.candlesticks,
                v2: skillCounts.patterns,
                v3: skillCounts.strategies,
                v4: skillCounts.supportResistance,
            }),
            url,
        })),
    };
}
