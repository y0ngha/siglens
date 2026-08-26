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
 * FAQPage 구조화데이터의 **가시 표면**. `buildFaqJsonLd`에 넘긴 것과 같은 배열을
 * 받아야 한다 — 구글은 마크업에 대응하는 질문·답변이 페이지에 실제로 보일 것을
 * 요구하고, 두 벌로 두면 한쪽만 고쳐져 리치 결과 자격을 잃는다.
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
