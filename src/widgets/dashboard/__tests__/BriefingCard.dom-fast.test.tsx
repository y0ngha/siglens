import { render, screen } from '@testing-library/react';
import type { MarketBriefingResponse } from '@y0ngha/siglens-core';
import {
    BriefingCard,
    BriefingLoadingCard,
    BriefingErrorCard,
} from '@/widgets/dashboard/BriefingCard';
import { TEST_SCOPE } from './helpers/testScope';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { KR_DASHBOARD_SCOPE } from '@/shared/config/dashboardScope';

const BRIEFING: MarketBriefingResponse = {
    summary: 'Markets rallied today',
    dominantThemes: ['AI', 'Earnings'],
    sectorAnalysis: {
        // core 0.48.0부터 이 필드는 **표시용 한국어명**이다(티커 아님).
        leadingSectors: ['기술', '금융'],
        laggingSectors: ['에너지'],
        performanceDescription: 'Tech led the way',
    },
    volatilityAnalysis: { vixLevel: 14.5, description: 'Low volatility' },
    riskSentiment: 'Risk on mode',
};

describe('BriefingCard', () => {
    /**
     * 섹터명은 core가 **한국어 표시명**으로 준다. 그대로 찍으면 영어 페이지에서
     * 바로 아래 번역된 `performanceDescription` 옆에 `기술·금융`이 붙는다.
     * 표시 시점에 심볼로 카탈로그를 찾는지 비-기본 로케일로 확인한다.
     */
    it.each([
        ['en', 'Technology·Financials', 'Energy'],
        ['ja', 'テクノロジー·金融', 'エネルギー'],
    ] as const)(
        '%s: 섹터명을 그 로케일로 표시한다',
        (locale, leading, lagging) => {
            renderWithIntl(
                <BriefingCard
                    scope={TEST_SCOPE}
                    briefing={BRIEFING}
                    generatedAt="2025-01-15T10:00:00Z"
                />,
                { locale }
            );

            expect(screen.getByText(leading)).toBeInTheDocument();
            expect(screen.getByText(lagging)).toBeInTheDocument();
            expect(screen.queryByText('기술·금융')).not.toBeInTheDocument();
        }
    );

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
        expect(screen.getByText('기술·금융')).toBeInTheDocument();
        expect(screen.getByText('에너지')).toBeInTheDocument();
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
 * 예전 core 프롬프트가 섹터 필드를 `"섹터 ETF 티커 (예: 'XLK')"`로 설명해,
 * 한국 요약을 넣어도 모델이 미국 것을 돌려주는 일이 실제로 있었다
 * (2026-08-19 `/market/kr` 실측: `하락 섹터 XLK·XLV·XLY`, `VIX 18.30`).
 * core 0.48.0에서 프롬프트를 고쳤지만 출력은 여전히 모델 산물이라
 * 카드 앞단의 필터는 유지한다.
 */
describe('BriefingCard — 근거 없는 값 차단', () => {
    it('scope에 없는 섹터명은 그리지 않는다', () => {
        render(
            <BriefingCard
                scope={KR_DASHBOARD_SCOPE}
                briefing={BRIEFING}
                generatedAt="2025-01-15T10:00:00Z"
            />
        );

        expect(screen.queryByText(/기술/)).not.toBeInTheDocument();
        expect(screen.queryByText(/에너지/)).not.toBeInTheDocument();
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

    it('scope에 있는 섹터명은 그대로 남긴다', () => {
        render(
            <BriefingCard
                scope={TEST_SCOPE}
                briefing={BRIEFING}
                generatedAt="2025-01-15T10:00:00Z"
            />
        );

        expect(screen.getByText('기술·금융')).toBeInTheDocument();
        expect(screen.getByText('에너지')).toBeInTheDocument();
        expect(screen.getByText(/VIX 14\.50/)).toBeInTheDocument();
    });
});
