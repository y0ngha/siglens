import { describe, it, expect } from 'vitest';
import {
    buildFallbackAnalysis,
    isFallbackAnalysis,
} from '@/entities/chat-message';
import { catalogTranslator } from '@/shared/test-utils/catalogTranslator';

// 폴백은 이제 로케일별 빌더다 — 예전 `FALLBACK_ANALYSIS` 상수는 한국어 요약을
// 들고 있어 `/en/AAPL`이 영어 화면에 한국어 폴백을 렌더했다.
const tFallback = catalogTranslator('entities.chat-message.fallback', 'ko');
const FALLBACK_SUMMARY = tFallback('unavailable');
const FALLBACK_ANALYSIS = buildFallbackAnalysis(FALLBACK_SUMMARY);

describe('isFallbackAnalysis', () => {
    it('FALLBACK_ANALYSIS 상수(동일 참조)는 true', () => {
        expect(isFallbackAnalysis(FALLBACK_ANALYSIS, FALLBACK_SUMMARY)).toBe(
            true
        );
    });

    // RSC 직렬화(Server Component → 'use client' 경계)와 normalizeAnalysisResponse의
    // `{ ...analysis }` 스프레드는 FALLBACK_ANALYSIS를 참조가 다른 clone으로 바꿔
    // 놓는다. 이게 실제 프로덕션에서 클라이언트가 받는 값의 형태다. 값 기반 판정으로
    // 바뀌었으므로 내용이 같은 clone은 true여야 한다(참조만 다른 clone을 false로 보면
    // 가드가 프로덕션에서 절대 발동하지 않는 dead code가 된다. PR #685 round-3).
    it('내용이 같은 clone(참조만 다름)도 true, 값 기반 판정', () => {
        expect(
            isFallbackAnalysis({ ...FALLBACK_ANALYSIS }, FALLBACK_SUMMARY)
        ).toBe(true);
    });

    it('실제 분석 결과는 false', () => {
        const real = { ...FALLBACK_ANALYSIS, summary: 'AAPL 상승 추세' };
        expect(isFallbackAnalysis(real, FALLBACK_SUMMARY)).toBe(false);
    });

    it('free-tier 필터로 배열은 비었지만 summary가 다른 응답(빈 문자열)은 false', () => {
        // normalizeAnalysisResponse가 nulled 필드를 기본값으로 채운 free-filtered
        // 응답은 summary가 ''(빈 문자열)이지 FALLBACK_ANALYSIS의 sentinel 텍스트가
        // 아니다. 값 기반 판정이 이 둘을 혼동하면 안 된다.
        const freeFiltered = {
            ...FALLBACK_ANALYSIS,
            summary: '',
        };
        expect(isFallbackAnalysis(freeFiltered, FALLBACK_SUMMARY)).toBe(false);
    });

    // summary는 sentinel과 같지만 나머지 필드 중 하나라도 실제 데이터를 담고
    // 있으면 폴백이 아니다 — 각 필드를 개별로 검증해 어느 하나가 판정을
    // 무시하지 않는지 확인한다.
    it('summary는 일치하지만 indicatorResults가 채워져 있으면 false', () => {
        const partial = {
            ...FALLBACK_ANALYSIS,
            indicatorResults: [
                {
                    indicatorName: 'RSI',
                    signals: [
                        {
                            type: 'skill' as const,
                            description: 'RSI 55 - 중립',
                            trend: 'neutral' as const,
                        },
                    ],
                },
            ],
        };
        expect(isFallbackAnalysis(partial, FALLBACK_SUMMARY)).toBe(false);
    });

    it('summary는 일치하지만 patternSummaries가 채워져 있으면 false', () => {
        const partial = {
            ...FALLBACK_ANALYSIS,
            patternSummaries: [
                {
                    id: 'p1',
                    patternName: 'rising_wedge',
                    skillName: '쐐기형',
                    detected: true,
                    trend: 'bearish' as const,
                    summary: '상승 쐐기형이 감지되었습니다.',
                    confidenceWeight: 0.7,
                },
            ],
        };
        expect(isFallbackAnalysis(partial, FALLBACK_SUMMARY)).toBe(false);
    });

    it('summary는 일치하지만 strategyResults가 채워져 있으면 false', () => {
        const partial = {
            ...FALLBACK_ANALYSIS,
            strategyResults: [
                {
                    id: 's1',
                    strategyName: '골든크로스',
                    trend: 'bullish' as const,
                    summary: '단기 이평선이 장기 이평선을 상향 돌파',
                    confidenceWeight: 0.8,
                },
            ],
        };
        expect(isFallbackAnalysis(partial, FALLBACK_SUMMARY)).toBe(false);
    });

    it('summary는 일치하지만 candlePatterns가 채워져 있으면 false', () => {
        const partial = {
            ...FALLBACK_ANALYSIS,
            candlePatterns: [
                {
                    id: 'c1',
                    patternName: '헤드앤숄더',
                    detected: true,
                    trend: 'bearish' as const,
                    summary: '헤드앤숄더 패턴이 감지되었습니다.',
                },
            ],
        };
        expect(isFallbackAnalysis(partial, FALLBACK_SUMMARY)).toBe(false);
    });

    it('summary는 일치하지만 trendlines가 채워져 있으면 false', () => {
        const partial = {
            ...FALLBACK_ANALYSIS,
            trendlines: [
                {
                    direction: 'ascending' as const,
                    start: { time: 1_700_000_000, price: 100 },
                    end: { time: 1_700_100_000, price: 105 },
                },
            ],
        };
        expect(isFallbackAnalysis(partial, FALLBACK_SUMMARY)).toBe(false);
    });

    // 실제 AnalysisResponse의 배열 필드는 optional이 아니지만, 이 판정 함수는
    // 네트워크 경계를 건넌 값(직렬화/역직렬화, 다른 소스의 부분 객체 등)에도
    // 방어적으로 동작해야 해서 `?? 0`로 nullish를 흡수한다. 타입을 우회해 그
    // 방어 경로가 실제로 true를 유지하는지 확인한다.
    it('optional 배열 필드가 undefined여도 (nullish 병합 방어 경로) true로 판정한다', () => {
        const withUndefinedArrays = {
            ...FALLBACK_ANALYSIS,
            indicatorResults: undefined,
            patternSummaries: undefined,
            strategyResults: undefined,
            candlePatterns: undefined,
            trendlines: undefined,
        } as unknown as typeof FALLBACK_ANALYSIS;
        expect(isFallbackAnalysis(withUndefinedArrays, FALLBACK_SUMMARY)).toBe(
            true
        );
    });
});
