import { describe, expect, it } from 'vitest';
import { stripExhibitPreamble } from '../stripExhibitPreamble';

describe('stripExhibitPreamble', () => {
    it('IonQ: 표지 찌꺼기를 걷고 본문 첫 줄부터 남긴다', () => {
        const text =
            'EX-99.1\n3\nionq-ex99_1.htm\nEX-99.1\n\nExhibit 99.1\nIonQ Announces Record 3Q26 Revenues\nBody';
        expect(stripExhibitPreamble(text)).toBe(
            'IonQ Announces Record 3Q26 Revenues\nBody'
        );
    });

    it('SEALSQ: PRESS RELEASE OF … ISSUED ON … 표지 줄도 걷는다', () => {
        const text =
            'EX-99.1\n2\nea030967501ex99-1.htm\nPRESS RELEASE OF SEALSQ CORP ISSUED ON OCTOBER 26, 2026\n\nExhibit 99.1\n\nSEALSQ Announces Intent';
        expect(stripExhibitPreamble(text)).toBe('SEALSQ Announces Intent');
    });

    it('대소문자와 번호 유무를 가리지 않는다', () => {
        expect(
            stripExhibitPreamble('ex-99\nEXHIBIT 99.2\nexhibit 99\nReal')
        ).toBe('Real');
    });

    it('표지 토큰이 본문 첫 줄에 붙어 있으면 토큰만 벗긴다', () => {
        expect(
            stripExhibitPreamble(
                'EX-99.1 3 x-ex99_1.htm Exhibit 99.1 Title text here'
            )
        ).toBe('Title text here');
    });

    it('본문의 숫자·파일명·Exhibit 언급은 건드리지 않는다', () => {
        const text = 'Title text\n3\nsee Exhibit 99.1';
        expect(stripExhibitPreamble(text)).toBe(text);
    });

    it('표지 토큰이 수천 개 붙어도 끝난다(상한만큼만 벗긴다)', () => {
        const line = `${'EX-99.1 '.repeat(5_000)}Real title text`;
        expect(() => stripExhibitPreamble(line)).not.toThrow();
        const lines = Array.from({ length: 10_000 }, () => 'EX-99.1').join(
            '\n'
        );
        expect(stripExhibitPreamble(`${lines}\nTitle here`)).toBe('Title here');
    });

    it('전부 표지거나 빈 입력이면 빈 문자열', () => {
        expect(stripExhibitPreamble('EX-99.1\n2\nx.htm')).toBe('');
        expect(stripExhibitPreamble('')).toBe('');
    });
});
