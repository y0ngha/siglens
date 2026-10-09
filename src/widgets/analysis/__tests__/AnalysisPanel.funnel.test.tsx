// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnalysisResponse } from '@y0ngha/siglens-core';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/shared/lib/funnel/trackFunnelEvent', () => ({
    trackFunnelEvent: track,
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
});
