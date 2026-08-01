import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CongressTrendResponse } from '@y0ngha/siglens-core';
import { CongressSnapshotProse } from '../renderers/CongressSnapshotProse';

// 스냅샷 저장소 content는 harvest.ts가 core prewarmCongress(→submitCongressTrend)의
// status==='cached' 분기에서 얻은 result.result(CongressTrendResponse)를 그대로
// 저장한 unknown이다. congress는 공개 의회 거래 공시 데이터 요약이라 BYOK 게이트도
// 없고, submit 경로는 tier를 스킬 샘플링·캐시 키에만 사용하고 응답 필드를 tier로
// 마스킹하지 않으므로 free tier로 pre-warm해도 전 필드가 그대로 채워진다. 이 타입을
// 그대로 fixture에 대입해두면 core 쪽 필드명이 바뀔 때 이 테스트가 컴파일
// 단계에서부터 깨진다.
const SUMMARY_TEXT =
    '최근 3개월간 AAPL에 대한 의회 거래는 매수가 매도를 크게 상회하며 순매수 우위 흐름을 보이고 있습니다.';

function buildFixture(
    overrides: Partial<CongressTrendResponse> = {}
): CongressTrendResponse {
    return {
        summaryKo: SUMMARY_TEXT,
        notableMembersKo: [
            '낸시 펠로시 의원이 최근 대규모 매수를 신고했습니다.',
        ],
        riskNoteKo: '공시 지연으로 최신 거래는 반영되지 않았을 수 있습니다.',
        overallSentiment: 'bullish',
        ...overrides,
    };
}

describe('CongressSnapshotProse', () => {
    it('summaryKo·notableMembersKo·riskNoteKo가 모두 채워지면 눈에 보이는 텍스트로 렌더한다', () => {
        const { container } = render(
            <CongressSnapshotProse
                content={buildFixture()}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        const text = container.textContent?.trim() ?? '';
        expect(text.length).toBeGreaterThan(40);
        expect(text).toContain(SUMMARY_TEXT);
        expect(text).toContain(
            '낸시 펠로시 의원이 최근 대규모 매수를 신고했습니다.'
        );
        expect(text).toContain(
            '공시 지연으로 최신 거래는 반영되지 않았을 수 있습니다.'
        );
        expect(
            screen.getByRole('heading', { name: '의회 거래 동향 요약' })
        ).toBeInTheDocument();
    });

    it('overallSentiment가 유효하면 의회 거래 동향 리드 문구를 렌더한다', () => {
        render(
            <CongressSnapshotProse
                content={buildFixture({ overallSentiment: 'bullish' })}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        expect(
            screen.getByText(/의회 거래 동향:\s*매수 우위/)
        ).toBeInTheDocument();
    });

    it('overallSentiment가 __proto__여도 throw 없이 렌더하고 [object Object]를 노출하지 않는다 (audit fix — prototype-chain-unsafe guard)', () => {
        // 방어 이전엔 `'__proto__' in SENTIMENT_LABEL`이 true였고 SENTIMENT_LABEL['__proto__']가
        // Object.prototype을 반환해 React child로 렌더 시 throw했다. Object.hasOwn 가드는
        // own property만 인정한다.
        const { container } = render(
            <CongressSnapshotProse
                content={buildFixture({
                    overallSentiment: '__proto__' as never,
                })}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        expect(container.textContent ?? '').not.toContain('[object Object]');
        expect(screen.getByText(SUMMARY_TEXT)).toBeInTheDocument();
    });

    it('모든 프로즈 필드가 비어있거나 content가 비객체면 아무것도 렌더하지 않는다', () => {
        const { container: emptyContainer } = render(
            <CongressSnapshotProse
                content={buildFixture({
                    summaryKo: '',
                    notableMembersKo: [],
                    riskNoteKo: '',
                })}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );
        expect(emptyContainer.textContent?.trim()).toBe('');

        const { container: nullContainer } = render(
            <CongressSnapshotProse
                content={null}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );
        expect(nullContainer.textContent?.trim()).toBe('');

        const { container: stringContainer } = render(
            <CongressSnapshotProse
                content="not-an-object"
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );
        expect(stringContainer.textContent?.trim()).toBe('');
    });

    it('summaryKo·notableMembersKo·riskNoteKo의 markdown 마커를 제거한다 (FIX 4)', () => {
        render(
            <CongressSnapshotProse
                content={buildFixture({
                    summaryKo: '**순매수** 우위 흐름',
                    notableMembersKo: ['- 낸시 펠로시 의원 매수'],
                    riskNoteKo: '`공시 지연` 45일',
                })}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        expect(screen.getByText('순매수 우위 흐름')).toBeInTheDocument();
        expect(screen.getByText('낸시 펠로시 의원 매수')).toBeInTheDocument();
        expect(screen.getByText('공시 지연 45일')).toBeInTheDocument();
    });

    it('요약만 있고 주목할 인물·참고 사항이 비어있으면 요약만 렌더하고 빈 항목은 렌더하지 않는다', () => {
        render(
            <CongressSnapshotProse
                content={buildFixture({
                    notableMembersKo: [],
                    riskNoteKo: '',
                })}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        expect(screen.getByText(SUMMARY_TEXT)).toBeInTheDocument();
        expect(screen.queryByText('주목할 인물')).not.toBeInTheDocument();
        expect(screen.queryByText('참고 사항')).not.toBeInTheDocument();
    });
});

describe('CongressSnapshotProse — 기준일 표기 (C1 감사)', () => {
    it('generatedAt이 있으면 기준일 캡션과 "지난 AI 분석" 배지를 렌더한다', () => {
        render(
            <CongressSnapshotProse
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
});
