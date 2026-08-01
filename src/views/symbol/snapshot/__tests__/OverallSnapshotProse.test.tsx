import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { OverallAnalysisResponse } from '@y0ngha/siglens-core';
import {
    hasOverallProse,
    OverallSnapshotProse,
} from '../renderers/OverallSnapshotProse';

// 스냅샷 저장소 content는 harvest.ts가 core prewarmOverall(→submitOverallAnalysis)의
// status==='cached' 분기에서 얻은 result.result(OverallAnalysisResponse)를 그대로
// 저장한 unknown이다. `pollOverallAnalysis`/`peekOverallAnalysisCache` JSDoc이 명시하듯
// overall은 technical과 달리 `filterAnalysisResult`(info-depth 필드 마스킹) 대상이
// 아니다 — "OverallAnalysisResponse는 필드별 게이팅 detail이 없는 synthesized
// headline/bullet narrative"라 free tier로 pre-warm해도 전 필드가 그대로 채워진다.
// 이 타입을 그대로 fixture에 대입해두면 core 쪽 필드명이 바뀔 때 이 테스트가
// 컴파일 단계에서부터 깨진다.
const HEADLINE_TEXT =
    'AAPL은 대형 기술주로 견조한 실적과 함께 단기 상승 추세를 이어가고 있습니다.';
const CONCLUSION_TEXT =
    '기술적 분석에 따르면 단기 이동평균선이 장기 이동평균선을 상향 돌파하며 모멘텀이 우세합니다. 다만 뉴스 분석에서는 규제 리스크가 부각되고 있어 방향이 엇갈린 구간으로 판단합니다.';

function buildFixture(
    overrides: Partial<OverallAnalysisResponse> = {}
): OverallAnalysisResponse {
    return {
        headlineKo: HEADLINE_TEXT,
        technicalBulletsKo: [],
        fundamentalBulletsKo: [],
        newsBulletsKo: [],
        optionsBulletsKo: [],
        financialsBulletsKo: [],
        integratedConclusionKo: CONCLUSION_TEXT,
        scenarios: [
            {
                name: 'bullish',
                triggerConditionKo:
                    '200일선을 상향 돌파하고 거래량이 급증하는 경우',
                priceRangeKo: '210 ~ 230 달러',
            },
            {
                name: 'neutral',
                triggerConditionKo: '박스권 등락이 지속되는 경우',
                priceRangeKo: '190 ~ 210 달러',
            },
            {
                name: 'bearish',
                triggerConditionKo: '180 지지선이 붕괴되는 경우',
                priceRangeKo: '160 ~ 180 달러',
            },
        ],
        riskFactorsKo: [],
        ...overrides,
    };
}

describe('OverallSnapshotProse', () => {
    it('headline·conclusion·강세/약세 시나리오가 모두 채워지면 눈에 보이는 텍스트로 렌더한다', () => {
        const { container } = render(
            <OverallSnapshotProse
                content={buildFixture()}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        const text = container.textContent?.trim() ?? '';
        expect(text.length).toBeGreaterThan(40);
        expect(text).toContain(HEADLINE_TEXT);
        expect(text).toContain(CONCLUSION_TEXT);
        expect(text).toContain(
            '200일선을 상향 돌파하고 거래량이 급증하는 경우'
        );
        expect(text).toContain('180 지지선이 붕괴되는 경우');
        expect(
            screen.getByRole('heading', { name: '종합 분석 결론' })
        ).toBeInTheDocument();
    });

    // audit fix FIX 7a: Tailwind v4 preflight sets `ul { list-style: none }`,
    // which drops the list role in Safari+VoiceOver. Every <ul> must carry an
    // explicit role="list" to restore it.
    it('모든 <ul>이 role="list"를 갖는다(FIX 7a)', () => {
        render(
            <OverallSnapshotProse
                content={buildFixture()}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        const lists = screen.getAllByRole('list');
        // 강세/중립/약세 시나리오 3개 <ul> (riskFactorsKo는 이 fixture에서 빈 배열).
        expect(lists.length).toBeGreaterThanOrEqual(3);
    });

    // audit fix FIX 7b: a bare text node next to the shrink-0 bullet span is
    // an anonymous flex item with min-width:auto — a long unbreakable run can
    // overflow and widen the document. The text must be wrapped in a
    // min-w-0 break-words span.
    it('불릿 텍스트가 min-w-0 break-words span으로 감싸져 있다(FIX 7b)', () => {
        const { container } = render(
            <OverallSnapshotProse
                content={buildFixture()}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        const wrapped = container.querySelectorAll('span.min-w-0.break-words');
        expect(wrapped.length).toBeGreaterThan(0);
        expect(
            Array.from(wrapped).some(el =>
                el.textContent?.includes(
                    '200일선을 상향 돌파하고 거래량이 급증하는 경우'
                )
            )
        ).toBe(true);
    });

    it('모든 프로즈 필드가 비어있거나 content가 비객체면 아무것도 렌더하지 않는다', () => {
        const { container: emptyContainer } = render(
            <OverallSnapshotProse
                content={buildFixture({
                    headlineKo: '',
                    integratedConclusionKo: '',
                    scenarios: [],
                })}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );
        expect(emptyContainer.textContent?.trim()).toBe('');

        const { container: nullContainer } = render(
            <OverallSnapshotProse
                content={null}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );
        expect(nullContainer.textContent?.trim()).toBe('');

        const { container: stringContainer } = render(
            <OverallSnapshotProse
                content="not-an-object"
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );
        expect(stringContainer.textContent?.trim()).toBe('');
    });

    it('headline만 있고 시나리오가 비어있으면 headline만 렌더하고 빈 시나리오 목록은 렌더하지 않는다', () => {
        render(
            <OverallSnapshotProse
                content={buildFixture({
                    integratedConclusionKo: '',
                    scenarios: [],
                })}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        expect(screen.getByText(HEADLINE_TEXT)).toBeInTheDocument();
        expect(screen.queryByText('강세 시나리오')).not.toBeInTheDocument();
        expect(screen.queryByText('중립 시나리오')).not.toBeInTheDocument();
        expect(screen.queryByText('약세 시나리오')).not.toBeInTheDocument();
        expect(screen.queryByText(CONCLUSION_TEXT)).not.toBeInTheDocument();
    });

    // FIX 3 (audit): OverallFactsSummary(peek path this renderer replaces) renders
    // ALL scenarios including neutral PLUS riskFactorsKo — the snapshot renderer had
    // dropped both, emitting LESS crawlable text than the peek path it replaced.
    it('중립 시나리오를 강세/약세와 동일하게 라벨 붙은 목록으로 렌더한다 (FIX 3)', () => {
        render(
            <OverallSnapshotProse
                content={buildFixture()}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        expect(screen.getByText('중립 시나리오')).toBeInTheDocument();
        expect(
            screen.getByText(
                '박스권 등락이 지속되는 경우 (예상 가격대: 190 ~ 210 달러)'
            )
        ).toBeInTheDocument();
    });

    it('riskFactorsKo를 위험 요인 라벨 붙은 목록으로 렌더한다 (FIX 3)', () => {
        const RISK_TEXT = '규제 리스크가 부각되고 있습니다.';
        render(
            <OverallSnapshotProse
                content={buildFixture({ riskFactorsKo: [RISK_TEXT] })}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        expect(screen.getByText('위험 요인')).toBeInTheDocument();
        expect(screen.getByText(RISK_TEXT)).toBeInTheDocument();
    });

    it('중립 시나리오·riskFactorsKo가 모두 비어있으면 두 섹션 다 렌더하지 않는다 (FIX 3)', () => {
        render(
            <OverallSnapshotProse
                content={buildFixture({
                    scenarios: [
                        {
                            name: 'bullish',
                            triggerConditionKo:
                                '200일선을 상향 돌파하고 거래량이 급증하는 경우',
                            priceRangeKo: '210 ~ 230 달러',
                        },
                    ],
                    riskFactorsKo: [],
                })}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        expect(screen.queryByText('중립 시나리오')).not.toBeInTheDocument();
        expect(screen.queryByText('위험 요인')).not.toBeInTheDocument();
    });
});

describe('OverallSnapshotProse — FIX 2 (4축 bullet 배열)', () => {
    it('technicalBulletsKo를 기술적 분석 라벨 붙은 목록으로 렌더한다', () => {
        render(
            <OverallSnapshotProse
                content={buildFixture({
                    technicalBulletsKo: [
                        'RSI가 과매수 구간에 진입했습니다.',
                        'MACD가 골든크로스를 형성했습니다.',
                    ],
                })}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        expect(screen.getByText('기술적 분석')).toBeInTheDocument();
        expect(
            screen.getByText('RSI가 과매수 구간에 진입했습니다.')
        ).toBeInTheDocument();
        expect(
            screen.getByText('MACD가 골든크로스를 형성했습니다.')
        ).toBeInTheDocument();
    });

    it('fundamentalBulletsKo를 펀더멘털 라벨 붙은 목록으로 렌더한다', () => {
        render(
            <OverallSnapshotProse
                content={buildFixture({
                    fundamentalBulletsKo: ['PER이 업종 평균 대비 낮습니다.'],
                })}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        expect(screen.getByText('펀더멘털')).toBeInTheDocument();
        expect(
            screen.getByText('PER이 업종 평균 대비 낮습니다.')
        ).toBeInTheDocument();
    });

    it('newsBulletsKo를 뉴스 라벨 붙은 목록으로 렌더한다', () => {
        render(
            <OverallSnapshotProse
                content={buildFixture({
                    newsBulletsKo: ['최근 실적 발표가 긍정적이었습니다.'],
                })}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        expect(screen.getByText('뉴스')).toBeInTheDocument();
        expect(
            screen.getByText('최근 실적 발표가 긍정적이었습니다.')
        ).toBeInTheDocument();
    });

    it('optionsBulletsKo를 옵션 라벨 붙은 목록으로 렌더한다', () => {
        render(
            <OverallSnapshotProse
                content={buildFixture({
                    optionsBulletsKo: ['콜옵션 프리미엄이 우세합니다.'],
                })}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        expect(screen.getByText('옵션')).toBeInTheDocument();
        expect(
            screen.getByText('콜옵션 프리미엄이 우세합니다.')
        ).toBeInTheDocument();
    });

    it('financialsBulletsKo를 재무제표 라벨 붙은 목록으로 렌더한다', () => {
        render(
            <OverallSnapshotProse
                content={buildFixture({
                    financialsBulletsKo: ['영업이익이 5년 연속 증가했습니다.'],
                })}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        expect(screen.getByText('재무제표')).toBeInTheDocument();
        expect(
            screen.getByText('영업이익이 5년 연속 증가했습니다.')
        ).toBeInTheDocument();
    });

    it('다섯 bullet 배열이 모두 비어있으면 다섯 섹션 헤딩 모두 렌더하지 않는다', () => {
        render(
            <OverallSnapshotProse
                content={buildFixture()}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        expect(screen.queryByText('기술적 분석')).not.toBeInTheDocument();
        expect(screen.queryByText('펀더멘털')).not.toBeInTheDocument();
        expect(screen.queryByText('뉴스')).not.toBeInTheDocument();
        expect(screen.queryByText('옵션')).not.toBeInTheDocument();
        expect(screen.queryByText('재무제표')).not.toBeInTheDocument();
    });

    it('headline/conclusion/시나리오가 전부 비어도 bullet 배열 하나만 있으면 렌더한다 (hasOverallProse와 정합)', () => {
        const content = buildFixture({
            headlineKo: '',
            integratedConclusionKo: '',
            scenarios: [],
            technicalBulletsKo: ['RSI가 과매수 구간입니다.'],
        });

        expect(hasOverallProse(content)).toBe(true);
        render(
            <OverallSnapshotProse
                content={content}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );
        expect(
            screen.getByText('RSI가 과매수 구간입니다.')
        ).toBeInTheDocument();
    });
});

describe('OverallSnapshotProse — FIX 4 (markdown marker 제거)', () => {
    it('headline/conclusion/bullet의 **bold**·- 목록 마커를 제거한다', () => {
        render(
            <OverallSnapshotProse
                content={buildFixture({
                    headlineKo: '**AAPL** 강세 전환',
                    integratedConclusionKo: '- 첫 번째 근거\n- 두 번째 근거',
                    technicalBulletsKo: ['**RSI** 과매수 구간'],
                })}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        expect(screen.getByText('AAPL 강세 전환')).toBeInTheDocument();
        expect(screen.getByText('첫 번째 근거')).toBeInTheDocument();
        expect(screen.getByText('두 번째 근거')).toBeInTheDocument();
        expect(screen.getByText('RSI 과매수 구간')).toBeInTheDocument();
    });
});

describe('hasOverallProse', () => {
    it('narrowOverallContent가 성공하는 content에는 true를 반환한다', () => {
        expect(hasOverallProse(buildFixture())).toBe(true);
    });

    it('모든 프로즈 필드가 비어있으면 false를 반환한다 (peek/placeholder 체인으로 폴백해야 함)', () => {
        expect(
            hasOverallProse(
                buildFixture({
                    headlineKo: '',
                    integratedConclusionKo: '',
                    scenarios: [],
                    riskFactorsKo: [],
                })
            )
        ).toBe(false);
    });

    it('content가 null·비객체·undefined면 false를 반환한다', () => {
        expect(hasOverallProse(null)).toBe(false);
        expect(hasOverallProse('not-an-object')).toBe(false);
        expect(hasOverallProse(undefined)).toBe(false);
    });
});

describe('OverallSnapshotProse — scenarios 방어적 좁히기', () => {
    // scenarios는 JSONB에서 unknown으로 올라오므로 원소별로 신뢰할 수 없다.
    // malformed 원소가 페이지를 throw로 날리지 않고 조용히 걸러지는지 확인한다.
    it('malformed 시나리오 원소를 걸러낸다', () => {
        render(
            <OverallSnapshotProse
                content={{
                    headlineKo: '종합 헤드라인',
                    scenarios: [
                        null,
                        'not-an-object',
                        {
                            name: 'not-a-scenario',
                            triggerConditionKo: '무시됨',
                        },
                        {
                            name: 'bullish',
                            triggerConditionKo: '저항 돌파 시',
                            priceRangeKo: '210~225',
                        },
                    ],
                }}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        expect(
            screen.getByText('저항 돌파 시 (예상 가격대: 210~225)')
        ).toBeInTheDocument();
        expect(screen.queryByText('무시됨')).not.toBeInTheDocument();
        expect(screen.queryByText('중립 시나리오')).not.toBeInTheDocument();
        expect(screen.queryByText('약세 시나리오')).not.toBeInTheDocument();
    });

    it('trigger·priceRange 중 하나만 유효하면 그 하나로 bullet을 합성한다', () => {
        render(
            <OverallSnapshotProse
                content={{
                    scenarios: [
                        // priceRangeKo가 문자열이 아니므로 trigger만 남는다.
                        {
                            name: 'bullish',
                            triggerConditionKo: '거래량 동반 상승',
                            priceRangeKo: 123,
                        },
                        // triggerConditionKo가 문자열이 아니므로 가격대만 남는다.
                        {
                            name: 'neutral',
                            triggerConditionKo: null,
                            priceRangeKo: '195~205',
                        },
                    ],
                }}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        expect(screen.getByText('거래량 동반 상승')).toBeInTheDocument();
        expect(screen.getByText('예상 가격대: 195~205')).toBeInTheDocument();
    });

    it('trigger·priceRange가 둘 다 비면 그 시나리오 섹션 자체를 렌더하지 않는다', () => {
        render(
            <OverallSnapshotProse
                content={{
                    headlineKo: '헤드라인만 유효',
                    scenarios: [
                        {
                            name: 'bearish',
                            triggerConditionKo: '   ',
                            priceRangeKo: '',
                        },
                    ],
                }}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        expect(screen.getByText('헤드라인만 유효')).toBeInTheDocument();
        expect(screen.queryByText('약세 시나리오')).not.toBeInTheDocument();
    });
});

describe('OverallSnapshotProse — 기준일 표기 + 라이브 분석 상호참조', () => {
    it('generatedAt이 있으면 기준일 캡션과 "지난 AI 분석" 배지를 렌더한다', () => {
        render(
            <OverallSnapshotProse
                content={buildFixture()}
                symbol="AAPL"
                displayName="Apple Inc."
                generatedAt={new Date('2026-07-31T20:00:00Z')}
            />
        );

        expect(screen.getByText('지난 AI 분석')).toBeInTheDocument();
        expect(
            screen.getByText(/2026년 7월 31일 미국 장마감 기준/)
        ).toBeInTheDocument();
    });

    it('라이브 분석 패널을 가리키는 상호참조 문장을 렌더한다', () => {
        render(
            <OverallSnapshotProse
                content={buildFixture()}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        expect(
            screen.getByText(
                '실시간 AI 분석 결과는 분석 패널에서 따로 제공됩니다.'
            )
        ).toBeInTheDocument();
    });

    it('generatedAt이 없어도 헤딩은 그대로 렌더한다', () => {
        render(
            <OverallSnapshotProse
                content={buildFixture()}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        expect(
            screen.getByRole('heading', { name: '종합 분석 결론' })
        ).toBeInTheDocument();
        expect(screen.queryByText('지난 AI 분석')).not.toBeInTheDocument();
    });
});
