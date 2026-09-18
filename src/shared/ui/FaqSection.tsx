import type { FaqItem } from '@/shared/lib/seo';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';

// 한 페이지에 FAQ 섹션은 하나뿐이라 id는 상수로 충분하다.
const FAQ_HEADING_ID = 'faq-heading';

interface FaqSectionProps {
    /**
     * 섹션 h2. 종목 탭은 여기에 종목명을 넣는다 — 같은 구조의 탭이 9개라
     * "자주 묻는 질문"만 있으면 페이지끼리 구분되는 신호가 없다.
     */
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
 * **종목 탭 6곳(congress·fear-greed·financials·fundamental·options·overall)은 화면에만
 * 둔다.** FAQ 리치 결과는 2023-08부터 정부·보건 등 권위 사이트로 한정됐고, 종목 탭의
 * 문답은 종목명만 바뀌는 템플릿이라 색인 대상 1,900여 URL에 같은 마크업을 복제하는
 * 것뿐이었다(2026-09-17 운영 감사). 화면 문답은 독자에게 쓸모가 있어 그대로 둔다.
 * 각 페이지에는 이 JSDoc을 가리키는 한 줄 주석만 남긴다 — 근거를 6곳에 복제하면
 * 정책이 또 바뀔 때 손으로 맞춰야 한다. 테스트 가드는
 * `expectVisibleFaqWithoutJsonLd`(종목 탭)와 `expectFaqSingleSource`(허브)다.
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
