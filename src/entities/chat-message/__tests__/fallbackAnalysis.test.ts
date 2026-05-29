import { describe, it, expect } from 'vitest';
import { FALLBACK_ANALYSIS, isFallbackAnalysis } from '@/entities/chat-message';

describe('isFallbackAnalysis', () => {
    it('FALLBACK_ANALYSIS 상수(동일 참조)는 true', () => {
        expect(isFallbackAnalysis(FALLBACK_ANALYSIS)).toBe(true);
    });

    it('내용이 같아도 다른 객체(clone)는 false — 참조 계약', () => {
        expect(isFallbackAnalysis({ ...FALLBACK_ANALYSIS })).toBe(false);
    });

    it('실제 분석 결과는 false', () => {
        const real = { ...FALLBACK_ANALYSIS, summary: 'AAPL 상승 추세' };
        expect(isFallbackAnalysis(real)).toBe(false);
    });
});
