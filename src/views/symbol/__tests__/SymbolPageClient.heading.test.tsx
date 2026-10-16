// vi.mock 호출은 vitest가 자동 호이스팅하지만, import/first 일관성을 위해
// 모든 import보다 위(파일 최상단)에 모아 둔다.
vi.mock('@/widgets/chart/ChartErrorFallback', () => ({
    ChartErrorFallback: () => null,
}));
vi.mock('@/widgets/chart/ChartSkeleton', () => ({
    ChartSkeleton: () => null,
}));
vi.mock('@/widgets/chart/TimeframeSelector', () => ({
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
    useSymbolPageContext: () => ({ indicatorCount: 13, skillCount: 30 }),
}));
vi.mock('@/features/symbol-model/model/SymbolModelContext', () => ({
    useSymbolModel: vi.fn(() => ({ tier: 'free', isTierHydrated: true })),
}));

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { buildFallbackAnalysis } from '@/entities/analysis/lib/fallbackAnalysis';
import { catalogTranslator } from '@/shared/test-utils/catalogTranslator';
import { SymbolPageClient } from '../SymbolPageClient';

// 폴백은 이제 로케일별 빌더다 — 예전 `FALLBACK_ANALYSIS` 상수는 한국어 요약을
// 들고 있어 `/en/AAPL`이 영어 화면에 한국어 폴백을 렌더했다.
const FALLBACK_ANALYSIS = buildFallbackAnalysis(
    catalogTranslator('entities.analysis.fallback', 'ko')('unavailable')
);

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
                skillCount={30}
            />
        );
        const h1 = screen.getByRole('heading', { level: 1 });
        expect(h1).toHaveTextContent('애플, Apple Inc. (AAPL) 차트 분석');
        expect(h1).not.toHaveClass('sr-only');
    });

    it('headingBadge를 h1과 같은 행에 렌더한다(모바일에서 차트 높이를 한 줄 더 쓰지 않는다)', () => {
        render(
            <SymbolPageClient
                symbol="aapl"
                companyName="Apple Inc."
                displayName="애플, Apple Inc. (AAPL)"
                initialAnalysis={FALLBACK_ANALYSIS}
                initialAnalysisFailed={true}
                indicatorCount={13}
                skillCount={30}
                headingBadge={<span>희석 배지</span>}
            />
        );
        const badge = screen.getByText('희석 배지');
        const h1 = screen.getByRole('heading', { level: 1 });
        // h1과 형제 — 세로 스택의 다른 행이 아니다.
        expect(badge.parentElement).toBe(h1.parentElement);
        // DOM 순서: h1 → 배지.
        expect(
            h1.compareDocumentPosition(badge) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
    });

    it('headingBadge가 없으면 바에 아무것도 더하지 않는다', () => {
        render(
            <SymbolPageClient
                symbol="aapl"
                companyName="Apple Inc."
                displayName="애플, Apple Inc. (AAPL)"
                initialAnalysis={FALLBACK_ANALYSIS}
                initialAnalysisFailed={true}
                indicatorCount={13}
                skillCount={30}
            />
        );
        expect(screen.queryByText('희석 배지')).toBeNull();
    });
});
