import { describe, expect, it } from 'vitest';
import { sym } from '@/shared/api/fmp/symKey';

describe('sym — 심볼 대문자 정규화', () => {
    it('소문자 심볼을 대문자로 변환한다', () => {
        expect(sym('aapl')).toBe('AAPL');
    });

    it('이미 대문자인 심볼은 그대로 반환한다', () => {
        expect(sym('TSLA')).toBe('TSLA');
    });

    it('혼합 대소문자를 대문자로 변환한다', () => {
        expect(sym('nVdA')).toBe('NVDA');
    });

    it('빈 문자열은 빈 문자열로 반환한다', () => {
        expect(sym('')).toBe('');
    });
});
