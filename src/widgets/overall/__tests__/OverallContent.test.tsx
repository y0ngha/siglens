import type { MockedFunction } from 'vitest';
/**
 * OverallContent done branch만 검증하는 테스트. hook은 mock 처리해
 * 다양한 state shape를 강제로 주입하고, 4축 layout(특히 OptionsSummary 위치,
 * IntegratedConclusion rename, ReanalyzeButton 노출 + amber 강조 조건)을 확인한다.
 */

// vi.mock은 vitest가 import 위로 hoist하지만, ESLint(import/first)와
// 가독성을 위해 소스 코드에서도 모든 import보다 위에 둔다.
vi.mock('@/widgets/overall/hooks/useOverallAnalysis', () => ({
    useOverallAnalysis: vi.fn(),
}));
vi.mock('@/features/symbol-chat', () => ({
    usePublishSymbolChat: vi.fn(),
}));
vi.mock('@/widgets/symbol-page/hooks/useDefaultModelId', () => ({
    useDefaultModelId: vi.fn(() => 'gemini-2.5-flash-lite'),
}));
// react-markdown은 ESM-only라 Jest 환경에서 직접 로드하면 실패한다. 본 테스트는
// markdown rendering이 아니라 OverallContent의 layout과 trigger 동작을 검증하므로
// MarkdownText를 단순 wrapper로 대체한다.
vi.mock('@/shared/ui/MarkdownText', () => ({
    MarkdownText: ({ children }: { children: ReactNode }) => (
        <div>{children}</div>
    ),
}));

import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { OverallAnalysisResponse } from '@y0ngha/siglens-core';

import { OverallContent } from '@/widgets/overall/OverallContent';
import { useOverallAnalysis } from '@/widgets/overall/hooks/useOverallAnalysis';

const mockUseOverallAnalysis = useOverallAnalysis as MockedFunction<
    typeof useOverallAnalysis
>;

function makeDoneResult(
    overrides: Partial<OverallAnalysisResponse> = {}
): OverallAnalysisResponse {
    return {
        headlineKo: '헤드라인',
        technicalBulletsKo: ['기술적 신호'],
        fundamentalBulletsKo: ['펀더멘털 신호'],
        newsBulletsKo: ['뉴스 신호'],
        optionsBulletsKo: ['감마 상승'],
        integratedConclusionKo: '통합 결론 텍스트',
        scenarios: [],
        riskFactorsKo: [],
        ...overrides,
    };
}

function mockDoneState(result: OverallAnalysisResponse, trigger = vi.fn()) {
    mockUseOverallAnalysis.mockReturnValue({
        state: { status: 'done', result },
        trigger,
    });
}

describe('OverallContent done branch', () => {
    beforeEach(() => {
        mockUseOverallAnalysis.mockReset();
    });

    it('TechnicalSummary와 FundamentalSummary 사이에 OptionsSummary를 렌더한다', () => {
        mockDoneState(makeDoneResult());
        render(
            <OverallContent
                symbol="AAPL"
                companyName="Apple Inc."
                timeframe="1Day"
            />
        );
        // 헤딩 텍스트 순서를 DOM 순서로 비교
        const headings = screen
            .getAllByRole('heading')
            .map(h => h.textContent ?? '');
        const techIdx = headings.findIndex(t => t.includes('기술'));
        const optsIdx = headings.findIndex(t => t.includes('옵션 시장'));
        const fundIdx = headings.findIndex(t => t.includes('펀더멘털'));
        expect(techIdx).toBeGreaterThanOrEqual(0);
        expect(optsIdx).toBeGreaterThan(techIdx);
        expect(fundIdx).toBeGreaterThan(optsIdx);
    });

    it('IntegratedConclusion("통합 결론") 헤딩을 렌더한다 (3축 종합 결론 X)', () => {
        mockDoneState(makeDoneResult());
        render(
            <OverallContent
                symbol="AAPL"
                companyName="Apple Inc."
                timeframe="1Day"
            />
        );
        expect(
            screen.getByRole('heading', { name: /통합 결론/ })
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('heading', { name: /3축 종합 결론/ })
        ).not.toBeInTheDocument();
    });

    it('ReanalyzeButton(재분석)이 done 상태에서 노출된다', () => {
        mockDoneState(makeDoneResult());
        render(
            <OverallContent
                symbol="AAPL"
                companyName="Apple Inc."
                timeframe="1Day"
            />
        );
        expect(
            screen.getByRole('button', { name: /재분석/ })
        ).toBeInTheDocument();
    });

    it('options bullets가 있고 OI가 stale이면 ReanalyzeButton을 ui-warning으로 강조한다', () => {
        mockDoneState(
            makeDoneResult({
                optionsBulletsKo: ['감마 상승'],
                optionsOiStale: true,
            })
        );
        render(
            <OverallContent
                symbol="AAPL"
                companyName="Apple Inc."
                timeframe="1Day"
            />
        );
        const btn = screen.getByRole('button', { name: /재분석/ });
        expect(btn.className).toMatch(/ui-warning/);
    });

    it('options bullets가 비어 있으면 stale이어도 ReanalyzeButton을 강조하지 않는다', () => {
        mockDoneState(
            makeDoneResult({
                optionsBulletsKo: [],
                optionsOiStale: true,
            })
        );
        render(
            <OverallContent
                symbol="AAPL"
                companyName="Apple Inc."
                timeframe="1Day"
            />
        );
        const btn = screen.getByRole('button', { name: /재분석/ });
        expect(btn.className).not.toMatch(/ui-warning/);
    });

    it('ReanalyzeButton 클릭 시 trigger를 호출한다', () => {
        const trigger = vi.fn();
        mockDoneState(makeDoneResult(), trigger);
        render(
            <OverallContent
                symbol="AAPL"
                companyName="Apple Inc."
                timeframe="1Day"
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /재분석/ }));
        expect(trigger).toHaveBeenCalledTimes(1);
    });
});
