import { render, screen } from '@testing-library/react';
import type { MarketBriefingResponse } from '@y0ngha/siglens-core';
import {
    BriefingCard,
    BriefingLoadingCard,
    BriefingErrorCard,
} from '@/widgets/dashboard/BriefingCard';
import { TEST_SCOPE } from './helpers/testScope';
import { KR_DASHBOARD_SCOPE } from '@/shared/config/dashboardScope';

const BRIEFING: MarketBriefingResponse = {
    summary: 'Markets rallied today',
    dominantThemes: ['AI', 'Earnings'],
    sectorAnalysis: {
        leadingSectors: ['XLK', 'XLF'],
        laggingSectors: ['XLE'],
        performanceDescription: 'Tech led the way',
    },
    volatilityAnalysis: { vixLevel: 14.5, description: 'Low volatility' },
    riskSentiment: 'Risk on mode',
};

describe('BriefingCard', () => {
    it('renders summary text', () => {
        render(
            <BriefingCard
                scope={TEST_SCOPE}
                briefing={BRIEFING}
                generatedAt="2025-01-15T10:00:00Z"
            />
        );
        expect(screen.getByText('Markets rallied today')).toBeInTheDocument();
    });

    it('renders dominant themes as badges', () => {
        render(
            <BriefingCard
                scope={TEST_SCOPE}
                briefing={BRIEFING}
                generatedAt="2025-01-15T10:00:00Z"
            />
        );
        expect(screen.getByText('AI')).toBeInTheDocument();
        expect(screen.getByText('Earnings')).toBeInTheDocument();
    });

    it('renders leading and lagging sectors', () => {
        render(
            <BriefingCard
                scope={TEST_SCOPE}
                briefing={BRIEFING}
                generatedAt="2025-01-15T10:00:00Z"
            />
        );
        expect(screen.getByText('XLK·XLF')).toBeInTheDocument();
        expect(screen.getByText('XLE')).toBeInTheDocument();
    });

    it('renders VIX level', () => {
        render(
            <BriefingCard
                scope={TEST_SCOPE}
                briefing={BRIEFING}
                generatedAt="2025-01-15T10:00:00Z"
            />
        );
        expect(screen.getByText(/VIX 14\.50/)).toBeInTheDocument();
    });

    it('renders risk sentiment', () => {
        render(
            <BriefingCard
                scope={TEST_SCOPE}
                briefing={BRIEFING}
                generatedAt="2025-01-15T10:00:00Z"
            />
        );
        expect(screen.getByText('Risk on mode')).toBeInTheDocument();
    });

    it('renders generated date in KST', () => {
        render(
            <BriefingCard
                scope={TEST_SCOPE}
                briefing={BRIEFING}
                generatedAt="2025-01-15T10:00:00Z"
            />
        );
        expect(screen.getByText(/기준/)).toBeInTheDocument();
    });

    it('hides timestamp when generatedAt is empty string', () => {
        render(
            <BriefingCard
                scope={TEST_SCOPE}
                briefing={BRIEFING}
                generatedAt=""
            />
        );
        expect(screen.queryByText(/기준/)).not.toBeInTheDocument();
    });

    it('hides timestamp when generatedAt is invalid date string', () => {
        render(
            <BriefingCard
                scope={TEST_SCOPE}
                briefing={BRIEFING}
                generatedAt="not-a-date"
            />
        );
        expect(screen.queryByText(/기준/)).not.toBeInTheDocument();
    });

    it('hides summary when empty', () => {
        const briefing: MarketBriefingResponse = {
            ...BRIEFING,
            summary: '',
        };
        render(
            <BriefingCard
                scope={TEST_SCOPE}
                briefing={briefing}
                generatedAt="2025-01-15T10:00:00Z"
            />
        );
        expect(
            screen.queryByText('Markets rallied today')
        ).not.toBeInTheDocument();
    });
});

describe('BriefingLoadingCard', () => {
    it('renders loading state with status role', () => {
        render(<BriefingLoadingCard />);
        expect(screen.getByRole('status')).toBeInTheDocument();
        expect(screen.getByText(/브리핑 생성 중/)).toBeInTheDocument();
    });
});

describe('BriefingErrorCard', () => {
    it('renders error state with alert role', () => {
        render(<BriefingErrorCard />);
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/불러오지 못했어요/)).toBeInTheDocument();
    });
});

/**
 * core `marketBriefingPrompt`가 섹터 필드를 `"섹터 ETF 티커 (예: 'XLK')"`로 설명해,
 * 한국 요약을 넣어도 모델이 미국 티커를 돌려주는 일이 실제로 있었다
 * (2026-08-19 `/market/kr` 실측: `하락 섹터 XLK·XLV·XLY`, `VIX 18.30`).
 * 카드가 그 값을 그대로 그리면 화면상 완전히 그럴듯해 보인다.
 */
describe('BriefingCard — 근거 없는 값 차단', () => {
    it('scope에 없는 섹터 티커는 그리지 않는다', () => {
        render(
            <BriefingCard
                scope={KR_DASHBOARD_SCOPE}
                briefing={BRIEFING}
                generatedAt="2025-01-15T10:00:00Z"
            />
        );

        expect(screen.queryByText(/XLK/)).not.toBeInTheDocument();
        expect(screen.queryByText(/XLE/)).not.toBeInTheDocument();
        expect(screen.queryByText('상승 섹터')).not.toBeInTheDocument();
        expect(screen.queryByText('하락 섹터')).not.toBeInTheDocument();
        // 서술 문장은 남는다 — 요약 데이터에서 직접 나온 줄이라 근거가 있다.
        expect(screen.getByText('Tech led the way')).toBeInTheDocument();
    });

    it('변동성 지수가 없는 시장에서는 수치도 해설도 숨긴다', () => {
        render(
            <BriefingCard
                scope={KR_DASHBOARD_SCOPE}
                briefing={BRIEFING}
                generatedAt="2025-01-15T10:00:00Z"
            />
        );

        expect(screen.queryByText(/VIX/)).not.toBeInTheDocument();
        expect(screen.queryByText('Low volatility')).not.toBeInTheDocument();
    });

    it('scope에 있는 티커는 그대로 남긴다', () => {
        render(
            <BriefingCard
                scope={TEST_SCOPE}
                briefing={BRIEFING}
                generatedAt="2025-01-15T10:00:00Z"
            />
        );

        expect(screen.getByText('XLK·XLF')).toBeInTheDocument();
        expect(screen.getByText('XLE')).toBeInTheDocument();
        expect(screen.getByText(/VIX 14\.50/)).toBeInTheDocument();
    });
});
