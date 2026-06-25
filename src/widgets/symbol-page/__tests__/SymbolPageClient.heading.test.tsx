// vi.mock 호출은 vitest가 자동 호이스팅하지만, import/first 일관성을 위해
// 모든 import보다 위(파일 최상단)에 모아 둔다.
vi.mock('@/widgets/chart', () => ({
    ChartErrorFallback: () => null,
    ChartSkeleton: () => null,
    TimeframeSelector: () => null,
}));
vi.mock('../ChartContent', () => ({ ChartContent: () => null }));
vi.mock('@/entities/ticker/hooks/useAssetInfo', () => ({
    useAssetInfo: () => undefined,
}));
vi.mock('../hooks/useMobileSheet', () => ({
    useMobileSheet: () => ({
        sheetSnap: 0,
        setSheetSnap: vi.fn(),
        mobileSheetContent: null,
        setMobileSheetContent: vi.fn(),
    }),
}));
vi.mock('../hooks/useTimeframeChange', () => ({
    useTimeframeChange: () => ({
        timeframe: '1D',
        timeframeChangeCount: 0,
        handleTimeframeChange: vi.fn(),
    }),
}));
vi.mock('@/shared/hooks/useHydrated', () => ({ useHydrated: () => false }));
vi.mock('@/shared/hooks/useIsMobileViewport', () => ({
    useIsMobileViewport: () => false,
}));
vi.mock('../SymbolPageContext', () => ({
    SymbolPageProvider: ({ children }: { children: ReactNode }) => children,
    useSymbolPageContext: () => ({ indicatorCount: 13 }),
}));

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { FALLBACK_ANALYSIS } from '@/entities/chat-message';
import { SymbolPageClient } from '../SymbolPageClient';

describe('SymbolPageClient 가시 h1', () => {
    it('displayName을 timeframe bar의 가시 h1으로 렌더한다 (sr-only 아님)', () => {
        render(
            <SymbolPageClient
                symbol="aapl"
                companyName="Apple Inc."
                displayName="애플, Apple Inc. (AAPL)"
                initialAnalysis={FALLBACK_ANALYSIS}
                initialAnalysisFailed={true}
                indicatorCount={13}
            />
        );
        const h1 = screen.getByRole('heading', { level: 1 });
        expect(h1).toHaveTextContent('애플, Apple Inc. (AAPL) 차트 분석');
        expect(h1).not.toHaveClass('sr-only');
    });
});
