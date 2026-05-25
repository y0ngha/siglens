// @vitest-environment jsdom
vi.mock('next/navigation', () => ({
    usePathname: vi.fn(),
}));
vi.mock('@/entities/chat-message', () => ({
    deriveLabel: vi.fn((pathname: string) => {
        if (pathname.includes('/AAPL/news')) return '뉴스 분석';
        if (pathname.includes('/AAPL')) return '차트 분석';
        return null;
    }),
}));

import { renderHook } from '@testing-library/react';
import { usePathname } from 'next/navigation';

import { usePageContextLabel } from '../../hooks/usePageContextLabel';

describe('usePageContextLabel', () => {
    it('returns a label for a symbol news page', () => {
        vi.mocked(usePathname).mockReturnValue('/AAPL/news');
        const { result } = renderHook(() => usePageContextLabel());

        expect(result.current).toBe('뉴스 분석');
    });

    it('returns a label for a symbol chart page', () => {
        vi.mocked(usePathname).mockReturnValue('/AAPL');
        const { result } = renderHook(() => usePageContextLabel());

        expect(result.current).toBe('차트 분석');
    });

    it('returns null for a non-symbol page', () => {
        vi.mocked(usePathname).mockReturnValue('/');
        const { result } = renderHook(() => usePageContextLabel());

        expect(result.current).toBeNull();
    });
});
