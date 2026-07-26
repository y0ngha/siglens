import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { OptionsAnalysisResponse } from '@y0ngha/siglens-core';
import { OptionsSnapshotProse } from '../renderers/OptionsSnapshotProse';

// 스냅샷 저장소 content는 harvest.ts가 prewarmOptions(→core submitOptionsAnalysis)의
// status==='cached' 분기에서 얻은 result.result(OptionsAnalysisResponse)를 그대로
// 저장한 unknown이다. options submit 경로는 tier를 BYOK 게이트·usage 한도에만
// 사용하고 응답 필드를 tier로 마스킹하지 않으므로 free tier로 pre-warm해도 전
// 필드가 그대로 채워진다. 이 타입을 그대로 fixture에 대입해두면 core 쪽 필드명이
// 바뀔 때 이 테스트가 컴파일 단계에서부터 깨진다.
const SUMMARY_TEXT =
    'AAPL 옵션 시장은 콜 매수세가 우세하며 낮은 풋콜비율이 단기 상승 기대를 반영하고 있습니다.';
const COMMENTARY_TEXT =
    '해당 만기의 콜 옵션 미결제약정이 풋 대비 두 배 이상 높아 강세 포지셔닝이 뚜렷합니다.';

function buildFixture(
    overrides: Partial<OptionsAnalysisResponse> = {}
): OptionsAnalysisResponse {
    return {
        summary: SUMMARY_TEXT,
        perExpiration: [
            {
                expirationDate: '2026-08-15',
                commentary: COMMENTARY_TEXT,
                tone: 'bullish',
            },
        ],
        signals: [
            { kind: 'bullish', message: '콜 옵션 거래량이 급증했습니다.' },
        ],
        analyzedAt: '2026-07-24T00:00:00.000Z',
        ...overrides,
    };
}

describe('OptionsSnapshotProse', () => {
    it('summary·perExpiration·signals가 모두 채워지면 눈에 보이는 텍스트로 렌더한다', () => {
        const { container } = render(
            <OptionsSnapshotProse
                content={buildFixture()}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        const text = container.textContent?.trim() ?? '';
        expect(text.length).toBeGreaterThan(40);
        expect(text).toContain(SUMMARY_TEXT);
        expect(text).toContain(COMMENTARY_TEXT);
        expect(text).toContain('2026-08-15');
        expect(text).toContain('콜 옵션 거래량이 급증했습니다.');
        expect(
            screen.getByRole('heading', { name: '옵션 시장 요약' })
        ).toBeInTheDocument();
    });

    it('perExpiration의 tone이 유효하면 톤 라벨을 렌더한다', () => {
        render(
            <OptionsSnapshotProse
                content={buildFixture()}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        expect(screen.getByText(/2026-08-15 \(강세\)/)).toBeInTheDocument();
    });

    it('tone·signal kind가 __proto__여도 throw 없이 렌더하고 [object Object]를 노출하지 않는다 (audit fix — prototype-chain-unsafe guard)', () => {
        // 방어 이전엔 `'__proto__' in TONE_LABEL`/`SIGNAL_KIND_LABEL`이 true였고
        // MAP['__proto__']가 Object.prototype을 반환해 React child로 렌더 시 throw했다.
        // Object.hasOwn 가드는 own property만 인정한다.
        const { container } = render(
            <OptionsSnapshotProse
                content={buildFixture({
                    perExpiration: [
                        {
                            expirationDate: '2026-08-15',
                            commentary: COMMENTARY_TEXT,
                            tone: '__proto__' as never,
                        },
                    ],
                    signals: [
                        {
                            kind: '__proto__' as never,
                            message: '콜 옵션 거래량이 급증했습니다.',
                        },
                    ],
                })}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        expect(container.textContent ?? '').not.toContain('[object Object]');
        expect(screen.getByText(COMMENTARY_TEXT)).toBeInTheDocument();
    });

    it('모든 프로즈 필드가 비어있거나 content가 비객체면 아무것도 렌더하지 않는다', () => {
        const { container: emptyContainer } = render(
            <OptionsSnapshotProse
                content={buildFixture({
                    summary: '',
                    perExpiration: [],
                    signals: [],
                })}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );
        expect(emptyContainer.textContent?.trim()).toBe('');

        const { container: nullContainer } = render(
            <OptionsSnapshotProse
                content={null}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );
        expect(nullContainer.textContent?.trim()).toBe('');

        const { container: stringContainer } = render(
            <OptionsSnapshotProse
                content="not-an-object"
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );
        expect(stringContainer.textContent?.trim()).toBe('');
    });

    it('summary·commentary·message의 markdown 마커를 제거한다 (FIX 4)', () => {
        render(
            <OptionsSnapshotProse
                content={buildFixture({
                    summary: '**콜 매수세** 우세',
                    perExpiration: [
                        {
                            expirationDate: '2026-08-15',
                            commentary: '`OI` 풋 대비 두 배 이상',
                            tone: 'bullish',
                        },
                    ],
                    signals: [
                        { kind: 'bullish', message: '- 콜 옵션 거래량 급증' },
                    ],
                })}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        expect(screen.getByText('콜 매수세 우세')).toBeInTheDocument();
        expect(screen.getByText('OI 풋 대비 두 배 이상')).toBeInTheDocument();
        expect(screen.getByText(/콜 옵션 거래량 급증/)).toBeInTheDocument();
    });

    it('summary만 있고 perExpiration·signals가 비어있으면 summary만 렌더하고 빈 목록은 렌더하지 않는다', () => {
        render(
            <OptionsSnapshotProse
                content={buildFixture({ perExpiration: [], signals: [] })}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        expect(screen.getByText(SUMMARY_TEXT)).toBeInTheDocument();
        expect(screen.queryByText('만기별 해석')).not.toBeInTheDocument();
        expect(screen.queryByText('시그널')).not.toBeInTheDocument();
    });

    // content는 JSONB에서 unknown으로 올라오므로 배열 원소 하나하나가 신뢰할 수
    // 없다. 유효 항목만 남기고 나머지를 조용히 버리는 경로 — 이게 깨지면
    // malformed 원소 하나가 페이지 전체를 throw로 날린다.
    it('perExpiration·signals의 malformed 원소를 걸러내고 유효 항목만 렌더한다', () => {
        render(
            <OptionsSnapshotProse
                content={{
                    summary: SUMMARY_TEXT,
                    perExpiration: [
                        null,
                        'not-an-object',
                        { commentary: 123 },
                        { commentary: '   ' },
                        {
                            commentary: '유효한 만기 해설',
                            expirationDate: 20260101,
                        },
                    ],
                    signals: [
                        null,
                        { message: 42 },
                        { message: '' },
                        { message: '유효한 시그널', kind: 'not-a-kind' },
                    ],
                }}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        expect(screen.getByText('유효한 만기 해설')).toBeInTheDocument();
        expect(screen.getByText('유효한 시그널')).toBeInTheDocument();
        // 만기 1건 + 시그널 1건만 살아남는다.
        expect(screen.getAllByRole('listitem')).toHaveLength(2);
        // 숫자 expirationDate는 ''로 떨어지고, 인식 못 하는 kind는 라벨을 붙이지 않는다.
        expect(screen.queryByText(/20260101/)).not.toBeInTheDocument();
        expect(screen.queryByText(/not-a-kind/)).not.toBeInTheDocument();
    });

    it('세 프로즈 소스 중 signals만 유효하면 시그널 목록만 렌더한다', () => {
        render(
            <OptionsSnapshotProse
                content={{
                    summary: '   ',
                    perExpiration: [{ commentary: '' }],
                    signals: [{ message: '변동성 확대', kind: 'volatility' }],
                }}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        expect(screen.getByText('시그널')).toBeInTheDocument();
        expect(screen.getByText(/변동성 확대/)).toBeInTheDocument();
        expect(screen.queryByText('만기별 해석')).not.toBeInTheDocument();
    });
});
