// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnalysisResponse } from '@y0ngha/siglens-core';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/shared/lib/funnel/trackFunnelEvent', () => ({
    trackFunnelEvent: track,
}));
const claimMeterShown = vi.hoisted(() => vi.fn());
vi.mock('@/shared/lib/funnel/meterShownDedupe', () => ({
    claimMeterShown,
}));
vi.mock('../AnalysisToast', () => ({ AnalysisToast: () => null }));
vi.mock('../AdBanner', () => ({ AdBanner: () => null }));
vi.mock('../StaleAnalysisBanner', () => ({ StaleAnalysisBanner: () => null }));

import { AnalysisPanel } from '../AnalysisPanel';

const analysis = {
    summary: '요약 텍스트',
    trend: 'bullish',
    riskLevel: 'medium',
    indicatorResults: [],
    patternSummaries: [],
    strategyResults: [],
    trendlines: [],
    priceTargets: { bullish: null, bearish: null },
    actionRecommendation: undefined,
    analyzedAt: '2025-01-01T00:00:00Z',
} as unknown as AnalysisResponse;

describe('AnalysisPanel 퍼널 이벤트', () => {
    beforeEach(() => {
        track.mockReset();
        claimMeterShown.mockReset();
        claimMeterShown.mockReturnValue(true);
    });

    it('잠긴 상세 카드의 가입 CTA 클릭은 gate_clicked{locked_detail}을 보낸다', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={analysis}
                keyLevels={{ support: [], resistance: [] }}
                timeframe="1Day"
                skillCount={42}
                lockedInfoDepth={['partial_detail']}
            />
        );
        fireEvent.click(screen.getByRole('link', { name: '회원가입' }));
        expect(track).toHaveBeenCalledWith('gate_clicked', {
            gate: 'locked_detail',
        });
    });

    it('소진 카드의 가입 CTA 클릭은 meter=exhausted 표식을 함께 보낸다', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={analysis}
                keyLevels={{ support: [], resistance: [] }}
                timeframe="1Day"
                skillCount={42}
                lockedInfoDepth={['partial_detail']}
                meter="exhausted"
            />
        );
        expect(
            screen.getByText('오늘 무료 공개는 끝났어요')
        ).toBeInTheDocument();
        fireEvent.click(screen.getByRole('link', { name: '회원가입' }));
        expect(track).toHaveBeenCalledWith('gate_clicked', {
            gate: 'locked_detail',
            meter: 'exhausted',
        });
    });

    it('공개 띠의 가입 링크 클릭은 meter_clicked{revealed}를 보낸다', () => {
        render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={analysis}
                keyLevels={{ support: [], resistance: [] }}
                timeframe="1Day"
                meter="revealed"
            />
        );
        fireEvent.click(
            screen.getByRole('link', { name: '가입하고 모든 종목에서 보기' })
        );
        expect(track).toHaveBeenCalledWith('meter_clicked', {
            state: 'revealed',
        });
    });

    it('띠·카드가 보일 때 meter_shown을 상태와 함께 한 번 보낸다(IntersectionObserver 없는 환경은 즉시)', () => {
        const { rerender } = render(
            <AnalysisPanel
                symbol="AAPL"
                analysis={analysis}
                keyLevels={{ support: [], resistance: [] }}
                timeframe="1Day"
                meter="revealed"
            />
        );
        expect(track).toHaveBeenCalledWith('meter_shown', {
            state: 'revealed',
        });
        expect(claimMeterShown).toHaveBeenCalledWith('AAPL', 'revealed');

        // 같은 날 같은 (종목, 상태)는 dedupe가 막는다.
        track.mockReset();
        claimMeterShown.mockReturnValue(false);
        rerender(
            <AnalysisPanel
                symbol="AAPL"
                analysis={analysis}
                keyLevels={{ support: [], resistance: [] }}
                timeframe="1Day"
                meter="revealed"
                isAnalyzing={false}
            />
        );
        expect(track).not.toHaveBeenCalledWith(
            'meter_shown',
            expect.anything()
        );
    });
});
