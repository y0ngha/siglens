// react-markdown은 ESM-only라 vitest의 기본 transform이 처리하지 못한다.
// MarkdownText를 단순 wrapper로 대체해 inline markdown 렌더 경로를 우회한다.
// vi.mock은 vitest가 import 위로 hoist하지만, ESLint(import/first)와
// 가독성을 위해 소스 코드에서도 모든 import보다 위에 둔다.
vi.mock('@/shared/ui/MarkdownText', () => ({
    MarkdownText: ({ children }: { children: ReactNode }) => (
        <span>{children}</span>
    ),
}));

import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { OverallAnalysisResponse } from '@y0ngha/siglens-core';

import { OverallView } from '@/widgets/overall/OverallView';

function makeResult(
    overrides: Partial<OverallAnalysisResponse> = {}
): OverallAnalysisResponse {
    return {
        headlineKo: '헤드라인',
        technicalBulletsKo: ['기술적 신호'],
        fundamentalBulletsKo: ['펀더멘털 신호'],
        newsBulletsKo: ['뉴스 신호'],
        optionsBulletsKo: ['감마 상승'],
        financialsBulletsKo: ['재무 신호'],
        integratedConclusionKo: '통합 결론 텍스트',
        scenarios: [],
        riskFactorsKo: [],
        ...overrides,
    };
}

/**
 * 회귀 가드(SEO 감사 finding 2, 2026-08-18): 한국 개별주식은 assetClass가
 * 'equity'라 예전 `isEquity` 단독 게이트로는 옵션 시장이 없는데도
 * OptionsSummary 섹션 헤딩("옵션 시장")이 그대로 남았다. `hasOptions=false`가
 * 그 섹션 자체를 렌더에서 빼는지, 다른 equity 전용 섹션(펀더멘털·재무)은
 * 그대로 남아 있는지 pin한다.
 */
describe('OverallView — hasOptions gating (SEO 감사 finding 2)', () => {
    it('kr-equity(hasOptions=false)에서는 옵션 시장 섹션 헤딩을 렌더하지 않는다', () => {
        render(
            <OverallView
                result={makeResult()}
                assetClass="equity"
                hasOptions={false}
            />
        );
        expect(
            screen.queryByRole('heading', { name: '옵션 시장' })
        ).not.toBeInTheDocument();
    });

    it('kr-equity(hasOptions=false)여도 펀더멘털·재무 섹션은 그대로 렌더한다', () => {
        render(
            <OverallView
                result={makeResult()}
                assetClass="equity"
                hasOptions={false}
            />
        );
        expect(screen.getByText('펀더멘털 신호')).toBeInTheDocument();
        expect(screen.getByText('재무 신호')).toBeInTheDocument();
    });

    it('us-equity(hasOptions=true)에서는 옵션 시장 섹션 헤딩을 렌더한다', () => {
        render(
            <OverallView
                result={makeResult()}
                assetClass="equity"
                hasOptions={true}
            />
        );
        expect(
            screen.getByRole('heading', { name: '옵션 시장' })
        ).toBeInTheDocument();
    });

    it('crypto는 hasOptions=true여도 옵션 시장 섹션을 렌더하지 않는다', () => {
        render(
            <OverallView
                result={makeResult()}
                assetClass="crypto"
                hasOptions={true}
            />
        );
        expect(
            screen.queryByRole('heading', { name: '옵션 시장' })
        ).not.toBeInTheDocument();
    });
});
