import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { NewsAnalysisResponse } from '@y0ngha/siglens-core';
import { NewsSnapshotProse } from '../renderers/NewsSnapshotProse';

// 스냅샷 저장소 content는 harvest.ts가 prewarmNews(→core submitNewsAnalysis)의
// status==='cached' 분기에서 얻은 result.result(NewsAnalysisResponse)를 그대로
// 저장한 unknown이다. news submit 경로는 tier를 BYOK 게이트·usage 한도·스킬
// 샘플링·캐시 키에만 사용하고 응답 필드를 tier로 마스킹하지 않으므로 free tier로
// pre-warm해도 전 필드가 그대로 채워진다. 이 타입을 그대로 fixture에 대입해두면
// core 쪽 필드명이 바뀔 때 이 테스트가 컴파일 단계에서부터 깨진다.
const DRIVER_TEXT =
    'AAPL 주가는 최근 발표된 신제품 판매 호조 소식에 힘입어 상승세를 이어가고 있습니다.';

function buildFixture(
    overrides: Partial<NewsAnalysisResponse> = {}
): NewsAnalysisResponse {
    return {
        currentDriverKo: DRIVER_TEXT,
        keyEventsKo: ['신제품 출시 발표로 투자 심리가 개선되었습니다.'],
        upcomingEventsKo: ['다음 분기 실적 발표가 2주 후 예정되어 있습니다.'],
        overallSentiment: 'bullish',
        ...overrides,
    };
}

describe('NewsSnapshotProse', () => {
    it('currentDriverKo·keyEventsKo·upcomingEventsKo가 모두 채워지면 눈에 보이는 텍스트로 렌더한다', () => {
        const { container } = render(
            <NewsSnapshotProse
                content={buildFixture()}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        const text = container.textContent?.trim() ?? '';
        expect(text.length).toBeGreaterThan(40);
        expect(text).toContain(DRIVER_TEXT);
        expect(text).toContain(
            '신제품 출시 발표로 투자 심리가 개선되었습니다.'
        );
        expect(text).toContain(
            '다음 분기 실적 발표가 2주 후 예정되어 있습니다.'
        );
        expect(
            screen.getByRole('heading', { name: '뉴스 종합 심리' })
        ).toBeInTheDocument();
    });

    it('overallSentiment가 유효하면 뉴스 종합 심리 리드 문구를 렌더한다', () => {
        render(
            <NewsSnapshotProse
                content={buildFixture({ overallSentiment: 'bullish' })}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        // getByText는 이제 h2 타이틀과 lead 문구(AAPL 뉴스 종합 심리: ...) 둘 다에 매치돼
        // "Found multiple elements"로 실패한다(audit fix FIX 6 — 타이틀이 더 이상
        // dead code가 아니게 됨). lead 문구만 특정해 검증한다.
        expect(
            screen.getByText(new RegExp(`AAPL 뉴스 종합 심리`))
        ).toBeInTheDocument();
    });

    it('overallSentiment가 __proto__여도 throw 없이 렌더하고 [object Object]를 노출하지 않는다 (audit fix — prototype-chain-unsafe guard)', () => {
        // 방어 이전엔 `'__proto__' in SENTIMENT_LABEL`이 true였고 SENTIMENT_LABEL['__proto__']가
        // Object.prototype을 반환해 React child로 렌더 시 throw했다. Object.hasOwn 가드는
        // own property만 인정한다.
        const { container } = render(
            <NewsSnapshotProse
                content={buildFixture({
                    overallSentiment: '__proto__' as never,
                })}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        expect(container.textContent ?? '').not.toContain('[object Object]');
        expect(screen.getByText(DRIVER_TEXT)).toBeInTheDocument();
    });

    it('모든 프로즈 필드가 비어있거나 content가 비객체면 아무것도 렌더하지 않는다', () => {
        const { container: emptyContainer } = render(
            <NewsSnapshotProse
                content={buildFixture({
                    currentDriverKo: '',
                    keyEventsKo: [],
                    upcomingEventsKo: [],
                })}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );
        expect(emptyContainer.textContent?.trim()).toBe('');

        const { container: nullContainer } = render(
            <NewsSnapshotProse
                content={null}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );
        expect(nullContainer.textContent?.trim()).toBe('');

        const { container: stringContainer } = render(
            <NewsSnapshotProse
                content="not-an-object"
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );
        expect(stringContainer.textContent?.trim()).toBe('');
    });

    it('currentDriverKo·keyEventsKo·upcomingEventsKo의 markdown 마커를 제거한다 (FIX 4)', () => {
        render(
            <NewsSnapshotProse
                content={buildFixture({
                    currentDriverKo: '**신제품 판매 호조** 소식',
                    keyEventsKo: ['- 신제품 출시 발표'],
                    upcomingEventsKo: ['`실적 발표` 2주 후'],
                })}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        expect(screen.getByText('신제품 판매 호조 소식')).toBeInTheDocument();
        expect(screen.getByText('신제품 출시 발표')).toBeInTheDocument();
        expect(screen.getByText('실적 발표 2주 후')).toBeInTheDocument();
    });

    it('현재 동인만 있고 핵심 이벤트·다가오는 일정이 비어있으면 동인만 렌더하고 빈 목록은 렌더하지 않는다', () => {
        render(
            <NewsSnapshotProse
                content={buildFixture({
                    keyEventsKo: [],
                    upcomingEventsKo: [],
                })}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        expect(screen.getByText(DRIVER_TEXT)).toBeInTheDocument();
        expect(screen.queryByText('핵심 이벤트')).not.toBeInTheDocument();
        expect(
            screen.queryByText('다가오는 주요 일정')
        ).not.toBeInTheDocument();
    });
});

describe('NewsSnapshotProse — 기준일 표기 (C1 감사)', () => {
    it('generatedAt이 있으면 기준일 캡션과 "지난 AI 분석" 배지를 렌더한다', () => {
        render(
            <NewsSnapshotProse
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
