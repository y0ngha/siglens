// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { OverallAnalysisResponse } from '@y0ngha/siglens-core';
import { OverallFactsSummary } from '@/widgets/overall';

// 컴포넌트가 읽는 필드만 채운 부분 mock (OverallAnalysisResponse의 나머지 필드는 미사용).
const baseAnalysis = {
    headlineKo: '애플 강세 전환 헤드라인',
    integratedConclusionKo: '차트·옵션·실적·뉴스 4축 종합 결론 텍스트',
    scenarios: [
        {
            name: 'bullish',
            triggerConditionKo: '저항 돌파',
            priceRangeKo: '$200~$210',
        },
        {
            name: 'bearish',
            triggerConditionKo: '지지 이탈',
            priceRangeKo: '$180~$190',
        },
    ],
    riskFactorsKo: ['다음 실적 발표 리스크', '매크로 이벤트 리스크'],
} as unknown as OverallAnalysisResponse;

describe('OverallFactsSummary', () => {
    it('Happy: 헤드라인·종합결론·시나리오(라벨 매핑)·위험요인을 크롤 가능한 텍스트로 렌더한다', () => {
        render(<OverallFactsSummary symbol="AAPL" analysis={baseAnalysis} />);

        expect(screen.getByText('애플 강세 전환 헤드라인')).toBeInTheDocument();
        expect(
            screen.getByText('차트·옵션·실적·뉴스 4축 종합 결론 텍스트')
        ).toBeInTheDocument();
        // SCENARIO_LABEL 매핑: bullish→강세, bearish→약세
        expect(screen.getByText('강세 시나리오:')).toBeInTheDocument();
        expect(screen.getByText('약세 시나리오:')).toBeInTheDocument();
        // 위험 요인 항목
        expect(screen.getByText('다음 실적 발표 리스크')).toBeInTheDocument();
        expect(screen.getByText('매크로 이벤트 리스크')).toBeInTheDocument();
        // sr-only h2 — 종목 결합
        expect(screen.getByText('AAPL AI 종합 분석 결론')).toBeInTheDocument();
    });

    it('Worst: scenarios/riskFactors가 비면 해당 목록을 렌더하지 않는다(크래시 없음)', () => {
        const empty = {
            ...baseAnalysis,
            scenarios: [],
            riskFactorsKo: [],
        } as unknown as OverallAnalysisResponse;

        const { container } = render(
            <OverallFactsSummary symbol="AAPL" analysis={empty} />
        );

        // 헤드라인/결론은 여전히 렌더
        expect(screen.getByText('애플 강세 전환 헤드라인')).toBeInTheDocument();
        // 빈 배열 분기 → <ul> 없음
        expect(container.querySelectorAll('ul')).toHaveLength(0);
    });
});
