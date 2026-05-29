/**
 * OverallContent SSR seed 테스트. 다른 OverallContent.test.tsx와 달리
 * useOverallAnalysis를 mock하지 않고 실제 훅을 사용해 initialAnalysis prop이
 * seed(done 상태)로 흐르는 전체 경로를 검증한다. Server Action만 mock해
 * 네트워크/server-only 의존을 차단한다.
 */

// vi.mock은 vitest가 import 위로 hoist하지만, ESLint(import/first)와 가독성을
// 위해 소스에서도 모든 import보다 위에 둔다.
vi.mock('@/features/symbol-chat', () => ({
    usePublishSymbolChat: vi.fn(),
}));
vi.mock('@/widgets/symbol-page/hooks/useDefaultModelId', () => ({
    useDefaultModelId: vi.fn(() => 'gemini-2.5-flash-lite'),
}));
// react-markdown은 ESM-only라 Jest/Vitest transform에서 직접 로드 시 실패한다.
// headline 텍스트만 검증하므로 단순 wrapper로 대체한다.
vi.mock('@/shared/ui/MarkdownText', () => ({
    MarkdownText: ({ children }: { children: ReactNode }) => (
        <div>{children}</div>
    ),
}));
// Server Action 묶음 — seed 경로에서는 호출되지 않지만 server-only import 체인을
// 끊기 위해 mock한다.
vi.mock('@/entities/analysis/actions', () => ({
    submitOverallAnalysisAction: vi.fn(),
    pollOverallAnalysisAction: vi.fn(),
    pollAnalysisAction: vi.fn(),
    pollFundamentalAnalysisAction: vi.fn(),
    cancelAnalysisJobAction: vi.fn().mockResolvedValue(undefined),
    cancelFundamentalAnalysisJobAction: vi.fn().mockResolvedValue(undefined),
    cancelOverallAnalysisJobAction: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/entities/news-article/actions', () => ({
    pollNewsAnalysisAction: vi.fn(),
    cancelNewsAnalysisJobAction: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/entities/options-chain/actions', () => ({
    pollOptionsAnalysisAction: vi.fn(),
    cancelOptionsAnalysisJobAction: vi.fn().mockResolvedValue(undefined),
}));

import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { OverallAnalysisResponse } from '@y0ngha/siglens-core';
import { OverallContent } from '@/widgets/overall/OverallContent';
import { submitOverallAnalysisAction } from '@/entities/analysis/actions';
import type { MockedFunction } from 'vitest';

const mockSubmit = submitOverallAnalysisAction as MockedFunction<
    typeof submitOverallAnalysisAction
>;

const SEED_RESULT: OverallAnalysisResponse = {
    headlineKo: 'AAPL 시드 헤드라인',
    technicalBulletsKo: ['기술적 신호'],
    fundamentalBulletsKo: ['펀더멘털 신호'],
    newsBulletsKo: ['뉴스 신호'],
    optionsBulletsKo: ['옵션 신호'],
    integratedConclusionKo: '통합 결론',
    scenarios: [],
    riskFactorsKo: [],
};

function makeWrapper() {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return function Wrapper({ children }: { children: ReactNode }) {
        return (
            <QueryClientProvider client={client}>
                {children}
            </QueryClientProvider>
        );
    };
}

describe('OverallContent SSR seed', () => {
    beforeEach(() => {
        mockSubmit.mockReset();
    });

    it('initialAnalysis가 주어지면 done 서사(headline)를 즉시 렌더하고 생성을 트리거하지 않는다', () => {
        render(
            <OverallContent
                symbol="AAPL"
                companyName="Apple Inc."
                timeframe="1Day"
                initialAnalysis={SEED_RESULT}
            />,
            { wrapper: makeWrapper() }
        );

        expect(screen.getByText('AAPL 시드 헤드라인')).toBeInTheDocument();
        expect(mockSubmit).not.toHaveBeenCalled();
    });

    it('initialAnalysis가 없으면 idle CTA(분석 받기)를 렌더한다', () => {
        render(
            <OverallContent
                symbol="AAPL"
                companyName="Apple Inc."
                timeframe="1Day"
            />,
            { wrapper: makeWrapper() }
        );

        expect(
            screen.getByRole('button', { name: /AI 종합 분석 받기/ })
        ).toBeInTheDocument();
    });
});
