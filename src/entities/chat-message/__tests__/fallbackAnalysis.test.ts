import { describe, it, expect } from 'vitest';
import { FALLBACK_ANALYSIS, isFallbackAnalysis } from '@/entities/chat-message';

describe('isFallbackAnalysis', () => {
    it('FALLBACK_ANALYSIS 상수(동일 참조)는 true', () => {
        expect(isFallbackAnalysis(FALLBACK_ANALYSIS)).toBe(true);
    });

    // RSC 직렬화(Server Component → 'use client' 경계)와 normalizeAnalysisResponse의
    // `{ ...analysis }` 스프레드는 FALLBACK_ANALYSIS를 참조가 다른 clone으로 바꿔
    // 놓는다. 이게 실제 프로덕션에서 클라이언트가 받는 값의 형태다. 값 기반 판정으로
    // 바뀌었으므로 내용이 같은 clone은 true여야 한다(참조만 다른 clone을 false로 보면
    // 가드가 프로덕션에서 절대 발동하지 않는 dead code가 된다. PR #685 round-3).
    it('내용이 같은 clone(참조만 다름)도 true, 값 기반 판정', () => {
        expect(isFallbackAnalysis({ ...FALLBACK_ANALYSIS })).toBe(true);
    });

    it('실제 분석 결과는 false', () => {
        const real = { ...FALLBACK_ANALYSIS, summary: 'AAPL 상승 추세' };
        expect(isFallbackAnalysis(real)).toBe(false);
    });

    it('free-tier 필터로 배열은 비었지만 summary가 다른 응답(빈 문자열)은 false', () => {
        // normalizeAnalysisResponse가 nulled 필드를 기본값으로 채운 free-filtered
        // 응답은 summary가 ''(빈 문자열)이지 FALLBACK_ANALYSIS의 sentinel 텍스트가
        // 아니다. 값 기반 판정이 이 둘을 혼동하면 안 된다.
        const freeFiltered = {
            ...FALLBACK_ANALYSIS,
            summary: '',
        };
        expect(isFallbackAnalysis(freeFiltered)).toBe(false);
    });
});
