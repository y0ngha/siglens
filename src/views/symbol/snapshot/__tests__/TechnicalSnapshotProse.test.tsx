import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { FilteredAnalysisResponse } from '@y0ngha/siglens-core';
import { TechnicalSnapshotProse } from '../renderers/TechnicalSnapshotProse';

// 스냅샷 저장소 content는 harvest.ts가 core submitAnalysis의 status==='cached'
// 분기에서 얻은 result.result(AnalysisResponse | FilteredAnalysisResponse)를
// 그대로 저장한 unknown이다. free tier로 pre-warm하므로 실제 저장값은
// FilteredAnalysisResponse — summary/trend만 채워지고 나머지는 null.
// 이 타입을 그대로 fixture에 대입해두면 core 쪽 필드명이 바뀔 때 이 테스트가
// 컴파일 단계에서부터 깨진다.
const SUMMARY_TEXT =
    'AAPL은 최근 거래일 종가 기준으로 단기 이동평균선이 장기 이동평균선을 상향 돌파하며 상승 모멘텀을 이어가고 있습니다. RSI는 중립 구간에서 안정적인 흐름을 보이고 있습니다.';

function buildFixture(
    overrides: Partial<FilteredAnalysisResponse> = {}
): FilteredAnalysisResponse {
    return {
        summary: SUMMARY_TEXT,
        trend: 'bullish',
        indicatorResults: null,
        riskLevel: null,
        keyLevels: null,
        priceTargets: null,
        patternSummaries: null,
        strategyResults: null,
        candlePatterns: null,
        trendlines: null,
        actionRecommendation: null,
        ...overrides,
    };
}

describe('TechnicalSnapshotProse', () => {
    it('summary가 40자 이상인 한국어 프로즈면 눈에 보이는 텍스트로 렌더한다', () => {
        const { container } = render(
            <TechnicalSnapshotProse
                content={buildFixture()}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        const text = container.textContent?.trim() ?? '';
        expect(text.length).toBeGreaterThan(40);
        expect(text).toContain(SUMMARY_TEXT);
        expect(
            screen.getByRole('heading', { name: '기술적 분석 요약' })
        ).toBeInTheDocument();
    });

    it('trend가 유효하면 방향성 리드 문구를 렌더한다', () => {
        render(
            <TechnicalSnapshotProse
                content={buildFixture({ trend: 'bullish' })}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        expect(screen.getByText(/강세/)).toBeInTheDocument();
    });

    it('summary가 빈 문자열이면 아무것도 렌더하지 않는다', () => {
        const { container } = render(
            <TechnicalSnapshotProse
                content={buildFixture({ summary: '' })}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        expect(container.textContent?.trim()).toBe('');
    });

    it('summary가 누락되면 아무것도 렌더하지 않는다', () => {
        const { container } = render(
            <TechnicalSnapshotProse
                content={buildFixture({ summary: null })}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        expect(container.textContent?.trim()).toBe('');
    });

    it('trend가 __proto__여도 throw 없이 렌더하고 [object Object]를 노출하지 않는다 (audit fix — prototype-chain-unsafe guard)', () => {
        // 방어 이전엔 `'__proto__' in TREND_LABEL`이 true였고 TREND_LABEL['__proto__']가
        // Object.prototype을 반환해 React child로 렌더 시 throw했다(malformed JSONB로
        // 인한 ISR 생성 500 리스크). Object.hasOwn 가드는 own property만 인정한다.
        const { container } = render(
            <TechnicalSnapshotProse
                content={buildFixture({ trend: '__proto__' as never })}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        expect(container.textContent ?? '').not.toContain('[object Object]');
        expect(screen.getByText(SUMMARY_TEXT)).toBeInTheDocument();
    });

    it('content가 unknown 방어 대상(null·비객체)이어도 렌더하지 않는다', () => {
        const { container: nullContainer } = render(
            <TechnicalSnapshotProse
                content={null}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );
        expect(nullContainer.textContent?.trim()).toBe('');

        const { container: stringContainer } = render(
            <TechnicalSnapshotProse
                content="not-an-object"
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );
        expect(stringContainer.textContent?.trim()).toBe('');
    });
});
