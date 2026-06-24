vi.mock('next/link', () => ({
    default: ({
        href,
        children,
        ...rest
    }: {
        href: string;
        children: React.ReactNode;
        [key: string]: unknown;
    }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));
vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) =>
        args
            .flat()
            .filter(a => typeof a === 'string' && a.length > 0)
            .join(' '),
}));

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CryptoShowcase } from '../CryptoShowcase';

describe('CryptoShowcase', () => {
    it('섹션 heading이 "암호화폐 인기 종목"이다', () => {
        render(<CryptoShowcase />);
        expect(
            screen.getByRole('heading', { name: '암호화폐 인기 종목' })
        ).toBeInTheDocument();
    });

    it('major 카드와 altcoin 카드가 모두 렌더링된다', () => {
        render(<CryptoShowcase />);
        expect(screen.getByText('메이저')).toBeInTheDocument();
        expect(screen.getByText('알트코인')).toBeInTheDocument();
    });

    it('비트코인 링크가 /BTCUSD로 연결된다', () => {
        render(<CryptoShowcase />);
        const btcLink = screen.getByRole('link', { name: /BTCUSD/ });
        expect(btcLink).toHaveAttribute('href', '/BTCUSD');
    });

    it('각 카드에 한글명이 표시된다', () => {
        render(<CryptoShowcase />);
        expect(screen.getByText('비트코인')).toBeInTheDocument();
        expect(screen.getByText('도지코인')).toBeInTheDocument();
    });
});
