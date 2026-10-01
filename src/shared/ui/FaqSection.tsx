import type { FaqItem } from '@/shared/lib/seo';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';

// 한 페이지에 FAQ 섹션은 하나뿐이라 id는 상수로 충분하다.
const FAQ_HEADING_ID = 'faq-heading';

interface FaqSectionProps {
    /** 섹션 h2. */
    heading: string;
    items: readonly FaqItem[];
}

/**
 * FAQ의 가시 표면.
 *
 * **허브(홈·`/economy*`·`/fear-greed*`)는 같은 배열을 `buildFaqJsonLd`에도 넘긴다** —
 * 구글은 마크업에 대응하는 질문·답변이 페이지에 실제로 보일 것을 요구하고, 두 벌로
 * 두면 한쪽만 고쳐져 리치 결과 자격을 잃는다.
 *
 * **종목 탭에는 FAQ를 두지 않는다**(2026-10-01, `docs/architecture/SEO_RECOVERY_2026_09.md`
 * §10). 2026-09-17에 FAQPage 마크업을 먼저 뺐고(FAQ 리치 결과는 2023-08부터 정부·보건
 * 등 권위 사이트 한정), 남은 화면 문답도 종목명만 바뀌는 템플릿이라 종목 페이지끼리의
 * 공통 문장 비율을 끌어올리던 주범이어서 걷어냈다. 종목 탭에 다시 넣지 않는다 — 지표
 * 일반 설명은 허브나 `/about`이 맡는다. 테스트 가드는 `expectFaqSingleSource`(허브)다.
 *
 * 마크업(`dl`/`dt`/`dd`)과 클래스는 `/economy/kr`·`/fear-greed`가 이미 쓰던 것을
 * 그대로 옮겼다. 카드 테두리는 `/[symbol]/overall`의 안내 섹션과 동일하다.
 */
export function FaqSection({ heading, items }: FaqSectionProps) {
    return (
        <section
            aria-labelledby={FAQ_HEADING_ID}
            className="space-y-3 rounded-lg border border-secondary-700 bg-secondary-800/30 p-5"
        >
            <h2 id={FAQ_HEADING_ID} className={HEADING_SECTION}>
                {heading}
            </h2>
            <dl className="space-y-4 text-sm leading-relaxed text-secondary-400">
                {items.map(({ question, answer }) => (
                    <div key={question}>
                        <dt className="font-medium text-secondary-300">
                            {question}
                        </dt>
                        <dd className="mt-1">{answer}</dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}
