import { render, screen } from '@testing-library/react';
import { LegalPageFrame } from '@/widgets/legal/ui/layout/LegalPageFrame';

describe('LegalPageFrame', () => {
    it('wraps the document in a main landmark with breadcrumb, eyebrow, one h1, header extra and body', () => {
        const { container } = render(
            <LegalPageFrame
                breadcrumb={<nav aria-label="경로" />}
                eyebrow="TERMS OF SERVICE"
                title="이용약관"
                headerExtra={<p>시행일: 2026년 9월 14일</p>}
            >
                <p>본문</p>
            </LegalPageFrame>
        );

        const main = screen.getByRole('main');
        expect(main).toContainElement(
            screen.getByRole('navigation', { name: '경로' })
        );
        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
        expect(
            screen.getByRole('heading', { level: 1, name: '이용약관' })
        ).toBeInTheDocument();
        expect(screen.getByText('TERMS OF SERVICE')).toBeInTheDocument();
        // `<article>` 안의 `<header>`는 banner 랜드마크가 아니라 문서 머리말이다.
        expect(container.querySelector('article > header')).toHaveTextContent(
            '시행일: 2026년 9월 14일'
        );
        expect(main).toHaveTextContent('본문');
    });
});
