import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { FilteredAnalysisResponse } from '@y0ngha/siglens-core';
import { TechnicalSnapshotProse } from '../renderers/TechnicalSnapshotProse';
import { LIVE_ANALYSIS_CROSS_REF } from '../lib/liveAnalysisCrossRef';

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
                marketProfile="us-equity"
            />
        );

        const text = container.textContent?.trim() ?? '';
        expect(text.length).toBeGreaterThan(40);
        expect(text).toContain(SUMMARY_TEXT);
        expect(
            screen.getByRole('heading', { name: '기술적 분석 요약' })
        ).toBeInTheDocument();
    });

    it('summary의 markdown 마커(**bold**, - 목록)를 제거한다 (FIX 4)', () => {
        render(
            <TechnicalSnapshotProse
                content={buildFixture({
                    summary: '**강조**된 요약\n- 첫 번째 근거\n- 두 번째 근거',
                })}
                symbol="AAPL"
                displayName="Apple Inc."
                marketProfile="us-equity"
            />
        );

        expect(screen.getByText('강조된 요약')).toBeInTheDocument();
        expect(screen.getByText('첫 번째 근거')).toBeInTheDocument();
        expect(screen.getByText('두 번째 근거')).toBeInTheDocument();
    });

    it('trend가 유효하면 방향성 리드 문구를 렌더한다', () => {
        render(
            <TechnicalSnapshotProse
                content={buildFixture({ trend: 'bullish' })}
                symbol="AAPL"
                displayName="Apple Inc."
                marketProfile="us-equity"
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
                marketProfile="us-equity"
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
                marketProfile="us-equity"
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
                marketProfile="us-equity"
            />
        );

        expect(container.textContent ?? '').not.toContain('[object Object]');
        expect(screen.getByText(SUMMARY_TEXT)).toBeInTheDocument();
    });

    // FIX 3 (audit): free tier's allowed info-depth includes 'skill_detection'
    // (core FREE_INFO_DEPTH) — patternSummaries/strategyResults pass through
    // filterAnalysisResult UNMASKED for free tier (only confidenceWeight is
    // zeroed, gated by the separate 'confidence' depth). This renderer had
    // never read either field, dropping ~6 prose entries per symbol on the
    // most-crawled route.
    it('patternSummaries를 차트 패턴 라벨 붙은 목록으로 렌더한다 (FIX 3)', () => {
        render(
            <TechnicalSnapshotProse
                content={buildFixture({
                    patternSummaries: [
                        {
                            id: 'p1',
                            patternName: 'head_and_shoulders',
                            skillName: 'head-and-shoulders',
                            detected: true,
                            trend: 'bearish',
                            summary:
                                '헤드앤숄더 패턴이 형성되며 하락 반전 가능성을 시사합니다.',
                            confidenceWeight: 0,
                        },
                    ] as never,
                })}
                symbol="AAPL"
                displayName="Apple Inc."
                marketProfile="us-equity"
            />
        );

        expect(screen.getByText('차트 패턴')).toBeInTheDocument();
        expect(
            screen.getByText(
                '헤드앤숄더 패턴이 형성되며 하락 반전 가능성을 시사합니다.'
            )
        ).toBeInTheDocument();
        expect(screen.getByText(/head_and_shoulders/)).toBeInTheDocument();
    });

    it('strategyResults를 전략 시그널 라벨 붙은 목록으로 렌더한다 (FIX 3)', () => {
        render(
            <TechnicalSnapshotProse
                content={buildFixture({
                    strategyResults: [
                        {
                            id: 's1',
                            strategyName: 'trend-following',
                            trend: 'bullish',
                            summary:
                                '추세추종 전략이 매수 신호를 발생시켰습니다.',
                            confidenceWeight: 0,
                        },
                    ] as never,
                })}
                symbol="AAPL"
                displayName="Apple Inc."
                marketProfile="us-equity"
            />
        );

        expect(screen.getByText('전략 시그널')).toBeInTheDocument();
        expect(
            screen.getByText('추세추종 전략이 매수 신호를 발생시켰습니다.')
        ).toBeInTheDocument();
        expect(screen.getByText(/trend-following/)).toBeInTheDocument();
    });

    it('patternSummaries/strategyResults가 null이거나 빈 배열이면 두 섹션 다 렌더하지 않는다 (FIX 3)', () => {
        render(
            <TechnicalSnapshotProse
                content={buildFixture({
                    patternSummaries: null,
                    strategyResults: [],
                })}
                symbol="AAPL"
                displayName="Apple Inc."
                marketProfile="us-equity"
            />
        );

        expect(screen.queryByText('차트 패턴')).not.toBeInTheDocument();
        expect(screen.queryByText('전략 시그널')).not.toBeInTheDocument();
    });

    it('patternSummaries 항목의 summary가 비어있으면 해당 항목은 건너뛴다 (FIX 3)', () => {
        render(
            <TechnicalSnapshotProse
                content={buildFixture({
                    patternSummaries: [
                        {
                            id: 'p1',
                            patternName: 'doji',
                            skillName: 'doji',
                            detected: false,
                            trend: 'neutral',
                            summary: '',
                            confidenceWeight: 0,
                        },
                    ] as never,
                })}
                symbol="AAPL"
                displayName="Apple Inc."
                marketProfile="us-equity"
            />
        );

        expect(screen.queryByText('차트 패턴')).not.toBeInTheDocument();
    });

    it('patternSummaries의 trend가 __proto__여도 throw 없이 렌더한다 (FIX 3, 프로토타입 체인 가드)', () => {
        const { container } = render(
            <TechnicalSnapshotProse
                content={buildFixture({
                    patternSummaries: [
                        {
                            id: 'p1',
                            patternName: 'unsafe-pattern',
                            skillName: 'unsafe',
                            detected: true,
                            trend: '__proto__' as never,
                            summary: '패턴 요약 텍스트입니다.',
                            confidenceWeight: 0,
                        },
                    ] as never,
                })}
                symbol="AAPL"
                displayName="Apple Inc."
                marketProfile="us-equity"
            />
        );

        expect(container.textContent ?? '').not.toContain('[object Object]');
        expect(screen.getByText('패턴 요약 텍스트입니다.')).toBeInTheDocument();
    });

    it('patternSummaries/strategyResults 항목의 summary에서 마크다운 마커를 제거한다 (FIX 4)', () => {
        render(
            <TechnicalSnapshotProse
                content={buildFixture({
                    patternSummaries: [
                        {
                            id: 'p1',
                            patternName: 'bull-flag',
                            skillName: 'bull-flag',
                            detected: true,
                            trend: 'bullish',
                            summary: '**강한** 상승 신호입니다.',
                            confidenceWeight: 0,
                        },
                    ] as never,
                })}
                symbol="AAPL"
                displayName="Apple Inc."
                marketProfile="us-equity"
            />
        );

        expect(screen.getByText('강한 상승 신호입니다.')).toBeInTheDocument();
    });

    it('content가 unknown 방어 대상(null·비객체)이어도 렌더하지 않는다', () => {
        const { container: nullContainer } = render(
            <TechnicalSnapshotProse
                content={null}
                symbol="AAPL"
                displayName="Apple Inc."
                marketProfile="us-equity"
            />
        );
        expect(nullContainer.textContent?.trim()).toBe('');

        const { container: stringContainer } = render(
            <TechnicalSnapshotProse
                content="not-an-object"
                symbol="AAPL"
                displayName="Apple Inc."
                marketProfile="us-equity"
            />
        );
        expect(stringContainer.textContent?.trim()).toBe('');
    });
});

describe('TechnicalSnapshotProse — 기준일 표기 + 라이브 분석 상호참조', () => {
    it('generatedAt이 있으면 기준일 캡션과 "지난 AI 분석" 배지를 렌더한다', () => {
        render(
            <TechnicalSnapshotProse
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

    // SEO 감사(2026-08-18): chart(technical) 탭은 세 시장 전부 렌더한다 —
    // marketProfile을 SnapshotSummarySection까지 실제로 전달하는지 kr-equity·
    // crypto 양쪽으로 겨냥한다.
    it('kr-equity로 렌더하면 "국내 장마감 기준" 캡션을 쓴다', () => {
        render(
            <TechnicalSnapshotProse
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

    it('crypto로 렌더하면 "UTC 기준" 캡션을 쓴다 — "장마감"을 쓰지 않는다', () => {
        render(
            <TechnicalSnapshotProse
                content={buildFixture()}
                symbol="BTCUSD"
                displayName="비트코인"
                marketProfile="crypto"
                generatedAt={new Date('2026-08-14T00:00:00Z')}
            />
        );

        expect(
            screen.getByText(/2026년 8월 14일 UTC 기준/)
        ).toBeInTheDocument();
        expect(screen.queryByText(/장마감/)).not.toBeInTheDocument();
    });

    it('라이브 분석 패널을 가리키는 상호참조 문장을 렌더한다', () => {
        render(
            <TechnicalSnapshotProse
                content={buildFixture()}
                symbol="AAPL"
                displayName="Apple Inc."
                marketProfile="us-equity"
            />
        );

        expect(screen.getByText(LIVE_ANALYSIS_CROSS_REF)).toBeInTheDocument();
    });

    it('generatedAt이 없어도 헤딩은 그대로 렌더한다', () => {
        render(
            <TechnicalSnapshotProse
                content={buildFixture()}
                symbol="AAPL"
                displayName="Apple Inc."
                marketProfile="us-equity"
            />
        );

        expect(
            screen.getByRole('heading', { name: '기술적 분석 요약' })
        ).toBeInTheDocument();
        expect(screen.queryByText('지난 AI 분석')).not.toBeInTheDocument();
    });
});
