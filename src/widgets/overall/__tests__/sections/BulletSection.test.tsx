// react-markdown은 ESM-only라 vitest의 기본 transform이 처리하지 못한다.
// MarkdownText를 단순 wrapper로 대체해 inline markdown 렌더 경로를 우회한다.
vi.mock('@/shared/ui/MarkdownText', () => ({
    MarkdownText: ({ children }: { children: ReactNode }) => (
        <span>{children}</span>
    ),
}));

import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { BulletSection } from '@/widgets/overall/sections/BulletSection';

const BASE = {
    headingId: 'test-summary-heading',
    title: '재무 분석',
    listLabel: '재무 분석 항목',
};

describe('BulletSection', () => {
    it('renders nothing when bullets is empty', () => {
        const { container } = render(<BulletSection {...BASE} bullets={[]} />);
        expect(container.innerHTML).toBe('');
    });

    it('labels the section by its heading and renders every bullet', () => {
        render(<BulletSection {...BASE} bullets={['A', 'B', 'C']} />);

        expect(
            screen.getByRole('region', { name: '재무 분석' })
        ).toBeInTheDocument();
        const heading = screen.getByRole('heading', { name: '재무 분석' });
        expect(heading).toHaveAttribute('id', 'test-summary-heading');
        expect(heading).toHaveClass('mb-3');
        const list = screen.getByRole('list', { name: '재무 분석 항목' });
        expect(list.querySelectorAll('li')).toHaveLength(3);
    });

    it('puts the heading and badge in one row when a badge slot is given', () => {
        render(
            <BulletSection
                {...BASE}
                bullets={['A']}
                badge={<span>OI 데이터 지연</span>}
            />
        );

        const heading = screen.getByRole('heading', { name: '재무 분석' });
        expect(heading).not.toHaveClass('mb-3');
        expect(heading.parentElement).toHaveClass('mb-3', 'flex');
        expect(heading.parentElement).toHaveTextContent('OI 데이터 지연');
    });

    it('keeps the row layout when the badge slot is present but empty', () => {
        render(<BulletSection {...BASE} bullets={['A']} badge={null} />);

        const heading = screen.getByRole('heading', { name: '재무 분석' });
        expect(heading.parentElement).toHaveClass('flex');
    });
});
