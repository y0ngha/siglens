import { render, screen } from '@testing-library/react';
import type {
    MarketBriefingResponse,
    RunBriefingResult,
} from '@y0ngha/siglens-core';
import { BriefingRegion } from '@/widgets/dashboard/BriefingRegion';
import { TEST_SCOPE } from './helpers/testScope';

const BRIEFING: MarketBriefingResponse = {
    summary: 'Markets rallied today',
    dominantThemes: [],
    sectorAnalysis: {
        leadingSectors: [],
        laggingSectors: [],
        performanceDescription: '',
    },
    volatilityAnalysis: { vixLevel: undefined, description: '' },
    riskSentiment: '',
};

describe('BriefingRegion', () => {
    it('입력이 아직 없으면 자리를 잡은 로딩 카드를 그린다', () => {
        render(<BriefingRegion input={undefined} scope={TEST_SCOPE} />);
        expect(screen.getByRole('status')).toHaveClass('min-h-64');
    });

    it("입력이 'error'면 오류 카드를 그린다", () => {
        render(<BriefingRegion input="error" scope={TEST_SCOPE} />);
        expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it.each(['cached', 'done'] as const)(
        '%s 결과면 브리핑 본문을 그린다',
        status => {
            const input = {
                status,
                briefing: BRIEFING,
                generatedAt: '2025-01-15T10:00:00Z',
            } as RunBriefingResult;
            render(<BriefingRegion input={input} scope={TEST_SCOPE} />);
            expect(
                screen.getByText('Markets rallied today')
            ).toBeInTheDocument();
        }
    );

    it('알 수 없는 status면 방어적으로 로딩 카드를 그린다', () => {
        const input = { status: 'unexpected' } as unknown as RunBriefingResult;
        render(<BriefingRegion input={input} scope={TEST_SCOPE} />);
        expect(screen.getByRole('status')).toHaveClass('min-h-64');
    });
});
