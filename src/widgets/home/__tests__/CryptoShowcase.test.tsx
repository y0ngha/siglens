vi.mock('@/shared/config/crypto-categories', () => ({
    CRYPTO_CATEGORIES: [
        {
            id: 'major',
            label: '메이저',
            items: [{ symbol: 'BTCUSD', name: '비트코인' }],
        },
        {
            id: 'altcoin',
            label: '알트코인',
            items: [{ symbol: 'DOGEUSD', name: '도지코인' }],
        },
    ],
}));
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
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
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

    /**
     * 카드 제목은 라벨 키로 번역된다 — `메이저`·`알트코인`이 라벨 맵에 없던 때는 영어·일본어·
     * 중국어 페이지에서도 한국어 원문으로 남았다(2026-10-05 감사). 설명 문구는 번역돼 있어
     * 한 카드 안에서 제목만 한국어인 모양이었다.
     */
    it.each([
        ['en', 'Major coins', 'Altcoins'],
        ['ja', 'メジャー', 'アルトコイン'],
        ['zh', '主流币', '山寨币'],
    ] as const)(
        '%s: 카드 제목이 한국어 원문이 아니다',
        (locale, major, altcoin) => {
            renderWithIntl(<CryptoShowcase />, { locale });

            expect(
                screen.getByRole('heading', { name: major })
            ).toBeInTheDocument();
            expect(
                screen.getByRole('heading', { name: altcoin })
            ).toBeInTheDocument();
            expect(screen.queryByText('메이저')).toBeNull();
            expect(screen.queryByText('알트코인')).toBeNull();
        }
    );
});
