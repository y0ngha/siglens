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
    koLabel: '미국 암호화폐',
    slug: 'crypto',
    koDescription: '비트코인·이더리움 등 주요 암호화폐 시장 동향을 모았습니다.',
    previewHeadlines: ['헤드라인 1', '헤드라인 2', '헤드라인 3'],
};

describe('CategoryCard', () => {
    it('koLabel을 heading으로 렌더한다', () => {
        render(<CategoryCard {...DEFAULTS} />);
        expect(
            screen.getByRole('heading', { name: '미국 암호화폐' })
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

    it('올바른 href를 가진 "더보기" 링크를 렌더한다', () => {
        render(<CategoryCard {...DEFAULTS} />);
        const link = screen.getByRole('link', {
            name: '미국 암호화폐 뉴스 더보기',
        });
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute('href', '/news/crypto');
    });

    it('aria-label에 koLabel을 포함한다', () => {
        render(<CategoryCard {...DEFAULTS} />);
        expect(
            screen.getByRole('link', { name: /미국 암호화폐/ })
        ).toBeInTheDocument();
    });
});
