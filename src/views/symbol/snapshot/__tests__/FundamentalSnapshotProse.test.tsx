import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { FundamentalAnalysisResponse } from '@y0ngha/siglens-core';
import { FundamentalSnapshotProse } from '../renderers/FundamentalSnapshotProse';

// 스냅샷 저장소 content는 harvest.ts가 core prewarmFundamental(→submitFundamentalAnalysis)의
// status==='cached' 분기에서 얻은 result.result(FundamentalAnalysisResponse)를 그대로
// 저장한 unknown이다. fundamental submit 경로는 tier를 BYOK 게이트·usage 한도·스킬
// 샘플링·캐시 키에만 사용하고 응답 필드를 tier로 마스킹하지 않으므로, free tier로
// pre-warm해도 전 필드가 그대로 채워진다. 이 타입을 그대로 fixture에 대입해두면 core
// 쪽 필드명이 바뀔 때 이 테스트가 컴파일 단계에서부터 깨진다.
const CONCLUSION_TEXT =
    'AAPL은 높은 밸류에이션에도 불구하고 견조한 수익성과 안정적인 성장세를 바탕으로 프리미엄이 정당화되는 구간으로 판단됩니다.';
const RATIONALE_TEXT =
    'PER과 PSR이 업종 평균 대비 높은 수준이지만 최근 실적 개선세를 감안하면 과도하지 않습니다.';

function buildFixture(
    overrides: Partial<FundamentalAnalysisResponse> = {}
): FundamentalAnalysisResponse {
    return {
        overallConclusionKo: CONCLUSION_TEXT,
        categoryAssessments: [
            {
                category: 'valuation',
                sentiment: 'neutral',
                rationaleKo: RATIONALE_TEXT,
            },
        ],
        riskFactorsKo: ['규제 리스크가 부각되고 있습니다.'],
        overallSentiment: 'bullish',
        ...overrides,
    };
}

describe('FundamentalSnapshotProse', () => {
    it('overallConclusionKo·categoryAssessments·riskFactorsKo가 모두 채워지면 눈에 보이는 텍스트로 렌더한다', () => {
        const { container } = render(
            <FundamentalSnapshotProse
                content={buildFixture()}
                symbol="AAPL"
                displayName="Apple Inc."
                marketProfile="us-equity"
            />
        );

        const text = container.textContent?.trim() ?? '';
        expect(text.length).toBeGreaterThan(40);
        expect(text).toContain(CONCLUSION_TEXT);
        expect(text).toContain(RATIONALE_TEXT);
        expect(text).toContain('밸류에이션');
        expect(text).toContain('규제 리스크가 부각되고 있습니다.');
        expect(
            screen.getByRole('heading', { name: '펀더멘털 종합 평가' })
        ).toBeInTheDocument();
    });

    it('overallSentiment가 유효하면 종합 평가 리드 문구를 렌더한다', () => {
        render(
            <FundamentalSnapshotProse
                content={buildFixture({ overallSentiment: 'bullish' })}
                symbol="AAPL"
                displayName="Apple Inc."
                marketProfile="us-equity"
            />
        );

        // getByText는 이제 h2 타이틀과 lead 문구(AAPL 펀더멘털 종합 평가: ...) 둘 다에 매치돼
        // "Found multiple elements"로 실패한다(audit fix FIX 6 — 타이틀이 더 이상
        // dead code가 아니게 됨). lead 문구만 특정해 검증한다.
        expect(
            screen.getByText(new RegExp(`AAPL 펀더멘털 종합 평가`))
        ).toBeInTheDocument();
    });

    it('overallSentiment·category가 __proto__여도 throw 없이 렌더하고 [object Object]를 노출하지 않는다 (audit fix — prototype-chain-unsafe guard)', () => {
        // 방어 이전엔 `'__proto__' in SENTIMENT_LABEL`/`CATEGORY_LABEL`이 true였고
        // MAP['__proto__']가 Object.prototype을 반환해 React child로 렌더 시 throw했다.
        // Object.hasOwn 가드는 own property만 인정한다.
        const { container } = render(
            <FundamentalSnapshotProse
                content={buildFixture({
                    overallSentiment: '__proto__' as never,
                    categoryAssessments: [
                        {
                            category: '__proto__' as never,
                            sentiment: 'bullish',
                            rationaleKo: RATIONALE_TEXT,
                        },
                    ],
                })}
                symbol="AAPL"
                displayName="Apple Inc."
                marketProfile="us-equity"
            />
        );

        expect(container.textContent ?? '').not.toContain('[object Object]');
        expect(screen.getByText(CONCLUSION_TEXT)).toBeInTheDocument();
    });

    it('모든 프로즈 필드가 비어있거나 content가 비객체면 아무것도 렌더하지 않는다', () => {
        const { container: emptyContainer } = render(
            <FundamentalSnapshotProse
                content={buildFixture({
                    overallConclusionKo: '',
                    categoryAssessments: [],
                    riskFactorsKo: [],
                })}
                symbol="AAPL"
                displayName="Apple Inc."
                marketProfile="us-equity"
            />
        );
        expect(emptyContainer.textContent?.trim()).toBe('');

        const { container: nullContainer } = render(
            <FundamentalSnapshotProse
                content={null}
                symbol="AAPL"
                displayName="Apple Inc."
                marketProfile="us-equity"
            />
        );
        expect(nullContainer.textContent?.trim()).toBe('');

        const { container: stringContainer } = render(
            <FundamentalSnapshotProse
                content="not-an-object"
                symbol="AAPL"
                displayName="Apple Inc."
                marketProfile="us-equity"
            />
        );
        expect(stringContainer.textContent?.trim()).toBe('');
    });

    it('overallConclusionKo·rationaleKo·riskFactorsKo의 markdown 마커를 제거한다 (FIX 4)', () => {
        render(
            <FundamentalSnapshotProse
                content={buildFixture({
                    overallConclusionKo: '**프리미엄** 정당화 구간',
                    categoryAssessments: [
                        {
                            category: 'valuation',
                            sentiment: 'neutral',
                            rationaleKo: '`PER` 업종 평균 대비 높음',
                        },
                    ],
                    riskFactorsKo: ['- 규제 리스크'],
                })}
                symbol="AAPL"
                displayName="Apple Inc."
                marketProfile="us-equity"
            />
        );

        expect(screen.getByText('프리미엄 정당화 구간')).toBeInTheDocument();
        expect(screen.getByText('PER 업종 평균 대비 높음')).toBeInTheDocument();
        expect(screen.getByText('규제 리스크')).toBeInTheDocument();
    });

    it('결론만 있고 카테고리 평가·위험 요인이 비어있으면 결론만 렌더하고 빈 목록은 렌더하지 않는다', () => {
        render(
            <FundamentalSnapshotProse
                content={buildFixture({
                    categoryAssessments: [],
                    riskFactorsKo: [],
                })}
                symbol="AAPL"
                displayName="Apple Inc."
                marketProfile="us-equity"
            />
        );

        expect(screen.getByText(CONCLUSION_TEXT)).toBeInTheDocument();
        expect(screen.queryByText('카테고리별 평가')).not.toBeInTheDocument();
        expect(screen.queryByText('위험 요인')).not.toBeInTheDocument();
    });
});

describe('FundamentalSnapshotProse — 기준일 표기 (C1 감사)', () => {
    it('generatedAt이 있으면 기준일 캡션과 "지난 AI 분석" 배지를 렌더한다', () => {
        render(
            <FundamentalSnapshotProse
                content={buildFixture()}
                symbol="AAPL"
                displayName="Apple Inc."
                marketProfile="us-equity"
                generatedAt={new Date('2026-07-31T20:00:00Z')}
            />
        );

        expect(screen.getByText('지난 AI 분석')).toBeInTheDocument();
        expect(
            screen.getByText(/2026년 7월 31일 미국 장마감 기준/)
        ).toBeInTheDocument();
    });

    // SEO 감사(2026-08-18): fundamental 탭은 kr-equity도 렌더한다 — marketProfile을
    // SnapshotSummarySection까지 실제로 전달하는지(캡션이 "미국 장마감"으로 굳어
    // 있지 않은지) 직접 겨냥한다.
    it('kr-equity로 렌더하면 "국내 장마감 기준" 캡션을 쓴다', () => {
        render(
            <FundamentalSnapshotProse
                content={buildFixture()}
                symbol="005930.KS"
                displayName="삼성전자"
                marketProfile="kr-equity"
                generatedAt={new Date('2026-08-14T06:30:00Z')}
            />
        );

        expect(
            screen.getByText(/2026년 8월 14일 국내 장마감 기준/)
        ).toBeInTheDocument();
        expect(screen.queryByText(/미국 장마감 기준/)).not.toBeInTheDocument();
    });
});
