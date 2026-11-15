import { describe, expect, it } from 'vitest';
import { truncateFilingText } from '../truncateFilingText';

describe('truncateFilingText', () => {
    it('정확히 max자면 자르지 않는다', () => {
        const text = 'a'.repeat(100);
        expect(truncateFilingText(text, 100)).toEqual({
            text,
            truncated: false,
            totalChars: 100,
        });
    });

    it('max+1자면 자른다(경계가 없으면 max에서 하드 컷)', () => {
        const text = 'a'.repeat(101);
        const result = truncateFilingText(text, 100);
        expect(result).toEqual({
            text: 'a'.repeat(100),
            truncated: true,
            totalChars: 101,
        });
    });

    it('끝 500자 안에 줄바꿈이 있으면 마지막 줄바꿈에서 자른다', () => {
        const text = `${'a'.repeat(900)}\n${'b'.repeat(200)}`;
        const result = truncateFilingText(text, 1000);
        expect(result.text).toBe('a'.repeat(900));
        expect(result.truncated).toBe(true);
        expect(result.totalChars).toBe(1101);
    });

    it('줄바꿈이 없으면 마지막 문장 끝(마침표 + 공백)에서 자른다', () => {
        const text = `${'a'.repeat(800)}. ${'b'.repeat(300)}`;
        const result = truncateFilingText(text, 1000);
        expect(result.text).toBe(`${'a'.repeat(800)}.`);
    });

    it('max번째 글자에서 문장이 정확히 끝나도 그 문장은 남긴다', () => {
        const text = `${'a'.repeat(99)}. bbbb`;
        const result = truncateFilingText(text, 100);
        expect(result.text).toBe(`${'a'.repeat(99)}.`);
        expect(result.truncated).toBe(true);
    });

    it('경계가 500자보다 멀리 있으면 무시하고 max에서 자른다', () => {
        const text = `${'a'.repeat(100)}\n${'b'.repeat(2000)}`;
        const result = truncateFilingText(text, 1000);
        expect(result.text).toBe(`${'a'.repeat(100)}\n${'b'.repeat(899)}`);
        expect(result.text).toHaveLength(1000);
    });

    it('서로게이트 쌍을 쪼개지 않는다', () => {
        const text = `${'a'.repeat(99)}😀${'b'.repeat(10)}`;
        const result = truncateFilingText(text, 100);
        expect(result.text).toBe('a'.repeat(99));
    });
});
