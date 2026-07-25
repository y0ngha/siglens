import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { FinancialsAnalysisResponse } from '@y0ngha/siglens-core';
import { FinancialsSnapshotProse } from '../renderers/FinancialsSnapshotProse';

// 스냅샷 저장소 content는 harvest.ts가 core prewarmFinancials(→submitFinancialsAnalysis)의
// status==='cached' 분기에서 얻은 result.result(FinancialsAnalysisResponse)를 그대로
// 저장한 unknown이다. financials submit 경로는 tier를 BYOK 게이트·usage 한도·스킬
// 샘플링·캐시 키에만 사용하고 응답 필드를 tier로 마스킹하지 않으므로, free tier로
// pre-warm해도 전 필드가 그대로 채워진다. 이 타입을 그대로 fixture에 대입해두면 core
// 쪽 필드명이 바뀔 때 이 테스트가 컴파일 단계에서부터 깨진다.
const CONCLUSION_TEXT =
    'AAPL은 견조한 매출 성장과 안정적인 현금창출력을 바탕으로 재무 건전성이 우수한 편입니다.';
const RATIONALE_TEXT =
    '최근 4개 분기 매출 성장률이 업종 평균을 상회하며 이익률 개선세도 뚜렷합니다.';

function buildFixture(
    overrides: Partial<FinancialsAnalysisResponse> = {}
): FinancialsAnalysisResponse {
    return {
        overallConclusionKo: CONCLUSION_TEXT,
        axisAssessments: [
            {
                axis: 'growth',
                sentiment: 'bullish',
                rationaleKo: RATIONALE_TEXT,
            },
        ],
        riskFactorsKo: ['부채비율이 다소 상승했습니다.'],
        overallSentiment: 'bullish',
        ...overrides,
    };
}

describe('FinancialsSnapshotProse', () => {
    it('overallConclusionKo·axisAssessments·riskFactorsKo가 모두 채워지면 눈에 보이는 텍스트로 렌더한다', () => {
        const { container } = render(
            <FinancialsSnapshotProse
                content={buildFixture()}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        const text = container.textContent?.trim() ?? '';
        expect(text.length).toBeGreaterThan(40);
        expect(text).toContain(CONCLUSION_TEXT);
        expect(text).toContain(RATIONALE_TEXT);
        expect(text).toContain('성장성');
        expect(text).toContain('부채비율이 다소 상승했습니다.');
        expect(
            screen.getByRole('heading', { name: '최근 분석 요약' })
        ).toBeInTheDocument();
    });

    it('overallSentiment가 유효하면 종합 평가 리드 문구를 렌더한다', () => {
        render(
            <FinancialsSnapshotProse
                content={buildFixture({ overallSentiment: 'bullish' })}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        expect(screen.getByText(/재무제표 종합 평가/)).toBeInTheDocument();
    });

    it('모든 프로즈 필드가 비어있거나 content가 비객체면 아무것도 렌더하지 않는다', () => {
        const { container: emptyContainer } = render(
            <FinancialsSnapshotProse
                content={buildFixture({
                    overallConclusionKo: '',
                    axisAssessments: [],
                    riskFactorsKo: [],
                })}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );
        expect(emptyContainer.textContent?.trim()).toBe('');

        const { container: nullContainer } = render(
            <FinancialsSnapshotProse
                content={null}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );
        expect(nullContainer.textContent?.trim()).toBe('');

        const { container: stringContainer } = render(
            <FinancialsSnapshotProse
                content="not-an-object"
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );
        expect(stringContainer.textContent?.trim()).toBe('');
    });

    it('결론만 있고 축별 평가·위험 요인이 비어있으면 결론만 렌더하고 빈 목록은 렌더하지 않는다', () => {
        render(
            <FinancialsSnapshotProse
                content={buildFixture({
                    axisAssessments: [],
                    riskFactorsKo: [],
                })}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        expect(screen.getByText(CONCLUSION_TEXT)).toBeInTheDocument();
        expect(screen.queryByText('축별 평가')).not.toBeInTheDocument();
        expect(screen.queryByText('위험 요인')).not.toBeInTheDocument();
    });
});
