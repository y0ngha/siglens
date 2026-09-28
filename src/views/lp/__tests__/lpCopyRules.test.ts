import { describe, expect, it } from 'vitest';
import { lpCopyViolations } from './lpCopyRules';

describe('lpCopyViolations', () => {
    it('passes clean copy', () => {
        expect(lpCopyViolations('종목 하나로 AI 종합 분석')).toEqual([]);
    });

    it.each([
        ['비트코인 분석', '비트코인'],
        ['Bitcoin price', 'Bitcoin'],
        ['시세·차트', '·'],
        ['분석 — 요약', '—'],
        ['티커 하나로', '티커'],
        ['가입 없이 무료', '가입 없이'],
        ['로그인없이', '로그인없이'],
    ])('flags %j', (text, hit) => {
        expect(lpCopyViolations(text)).toContain(hit);
    });
});
