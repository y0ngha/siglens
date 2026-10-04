import { render, screen } from '@testing-library/react';
import { FaqSection } from '@/shared/ui/FaqSection';
import { buildFaqJsonLd } from '@/shared/lib/seo';

const ITEMS = [
    { question: '무엇을 볼 수 있나요?', answer: '차트와 지표를 봅니다.' },
    { question: '데이터는 어디서 오나요?', answer: 'FMP에서 가져옵니다.' },
];

describe('FaqSection', () => {
    it('질문과 답변을 모두 보이는 텍스트로 렌더한다', () => {
        render(<FaqSection heading="자주 묻는 질문" items={ITEMS} />);

        expect(
            screen.getByRole('heading', { name: '자주 묻는 질문', level: 2 })
        ).toBeInTheDocument();
        ITEMS.forEach(({ question, answer }) => {
            expect(screen.getByText(question)).toBeInTheDocument();
            expect(screen.getByText(answer)).toBeInTheDocument();
        });
    });

    /**
     * 이 섹션의 존재 이유 자체가 "마크업한 Q&A가 화면에 보여야 한다"이므로,
     * `sr-only`로 숨기는 회귀는 결함이다 — 그때 화면에는 아무것도 없으면서
     * `textContent`만 채워져 감사 도구가 통과시킨다.
     */
    it('sr-only로 숨기지 않는다', () => {
        const { container } = render(
            <FaqSection heading="자주 묻는 질문" items={ITEMS} />
        );

        expect(container.querySelector('.sr-only')).toBeNull();
    });

    it('구조화데이터와 같은 항목 수를 그린다', () => {
        render(<FaqSection heading="자주 묻는 질문" items={ITEMS} />);

        const entities = buildFaqJsonLd(ITEMS).mainEntity as unknown[];
        expect(document.querySelectorAll('dt')).toHaveLength(entities.length);
    });
});
