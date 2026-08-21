// next/link renders a plain <a> in test environments — no router needed.
vi.mock('next/link', () => ({
    default: ({
        href,
        children,
        ...props
    }: {
        href: string;
        children: React.ReactNode;
        [key: string]: unknown;
    }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CategoryCard } from '../CategoryCard';

const DEFAULTS = {
    label: '암호화폐',
    href: '/news/crypto',
    description: '비트코인·이더리움 등 주요 암호화폐 시장 동향을 모았습니다.',
    previewHeadlines: ['헤드라인 1', '헤드라인 2', '헤드라인 3'],
};

describe('CategoryCard', () => {
    it('koLabel을 heading으로 렌더한다', () => {
        render(<CategoryCard {...DEFAULTS} />);
        expect(
            screen.getByRole('heading', { name: '암호화폐' })
        ).toBeInTheDocument();
    });

    it('koDescription을 렌더한다', () => {
        render(<CategoryCard {...DEFAULTS} />);
        expect(
            screen.getByText(
                '비트코인·이더리움 등 주요 암호화폐 시장 동향을 모았습니다.'
            )
        ).toBeInTheDocument();
    });

    it('previewHeadlines를 렌더한다', () => {
        render(<CategoryCard {...DEFAULTS} />);
        expect(screen.getByText('헤드라인 1')).toBeInTheDocument();
        expect(screen.getByText('헤드라인 2')).toBeInTheDocument();
        expect(screen.getByText('헤드라인 3')).toBeInTheDocument();
    });

    it('previewHeadlines가 비어 있으면 fallback 문구를 렌더한다', () => {
        render(<CategoryCard {...DEFAULTS} previewHeadlines={[]} />);
        expect(
            screen.getByText('최신 뉴스를 불러오고 있어요.')
        ).toBeInTheDocument();
    });

    /**
     * 앵커 텍스트가 곧 목적지에 대한 신호다. 예전에는 링크가 `더보기`뿐이라
     * 이 카드가 거는 내부 링크에 키워드가 하나도 실리지 않았다.
     */
    it('제목이 링크이고 앵커 텍스트가 카테고리 이름이다', () => {
        render(<CategoryCard {...DEFAULTS} />);

        const link = screen.getByRole('link', { name: '암호화폐' });
        expect(link).toHaveAttribute('href', '/news/crypto');
        expect(link.closest('h2')).not.toBeNull();
    });

    it('보조기술에 노출되는 링크는 카드당 하나다', () => {
        render(<CategoryCard {...DEFAULTS} />);

        // `더보기 →`도 같은 곳으로 가지만 `aria-hidden` + `tabIndex={-1}`이라
        // 접근성 트리에는 안 뜬다 — 같은 링크가 두 번 읽히지 않게.
        expect(screen.getAllByRole('link')).toHaveLength(1);
    });

    it('aria-label에 koLabel을 포함한다', () => {
        render(<CategoryCard {...DEFAULTS} />);
        expect(
            screen.getByRole('link', { name: /암호화폐/ })
        ).toBeInTheDocument();
    });
});
