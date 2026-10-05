import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockSegment = vi.hoisted(() => ({ current: null as string | null }));

vi.mock('next/navigation', async importOriginal => ({
    ...(await importOriginal<typeof import('next/navigation')>()),
    useSelectedLayoutSegment: () => mockSegment.current,
}));

import { RelatedSymbolLink } from '../RelatedSymbolLink';

function hrefFor(segment: string | null, symbol = 'NVDA'): string | null {
    mockSegment.current = segment;
    render(
        <RelatedSymbolLink symbol={symbol} className="chip">
            <span>이름</span>
        </RelatedSymbolLink>
    );
    return screen.getByRole('link').getAttribute('href');
}

describe('RelatedSymbolLink', () => {
    beforeEach(() => {
        mockSegment.current = null;
    });

    it('차트 탭(세그먼트 없음)이면 /{peer}로 간다', () => {
        expect(hrefFor(null)).toBe('/NVDA');
    });

    it('뉴스 탭이면 /{peer}/news로 간다', () => {
        expect(hrefFor('news')).toBe('/NVDA/news');
    });

    it('공포탐욕 탭이면 /{peer}/fear-greed로 간다', () => {
        expect(hrefFor('fear-greed')).toBe('/NVDA/fear-greed');
    });

    it.each([
        'overall',
        'fundamental',
        'financials',
        'options',
        'congress',
        'position',
    ])('항상-noindex이거나 비색인 탭(%s)에서는 차트 /{peer}로 간다', tab => {
        expect(hrefFor(tab)).toBe('/NVDA');
    });

    it('KR 심볼의 canonical(접미사 포함)을 href에 쓴다', () => {
        expect(hrefFor('news', '005930.KS')).toBe('/005930.KS/news');
    });

    it('children을 그대로 렌더하고 className을 전달한다', () => {
        hrefFor(null);
        const link = screen.getByRole('link');
        expect(link).toHaveTextContent('이름');
        expect(link).toHaveClass('chip');
    });
});
