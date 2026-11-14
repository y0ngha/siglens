import { describe, expect, it } from 'vitest';
import {
    takeWholeSentences,
    truncateAtWordBoundary,
    truncateWithEllipsis,
} from '../truncate';

describe('truncateWithEllipsis', () => {
    it('returns the text unchanged when it fits', () => {
        expect(truncateWithEllipsis('abc', 3)).toBe('abc');
        expect(truncateWithEllipsis('', 3)).toBe('');
    });

    it('cuts to max - 1 code points and appends an ellipsis', () => {
        expect(truncateWithEllipsis('abcdef', 4)).toBe('abc…');
    });

    it('never splits a surrogate pair (emoji)', () => {
        // '😀' is 2 UTF-16 units; a unit-based slice(0, 3) would leave a lone surrogate.
        const result = truncateWithEllipsis('ab😀cd', 4);
        expect(result).toBe('ab😀…');
        expect(result.isWellFormed()).toBe(true);
    });

    it('counts length in code points, not UTF-16 units', () => {
        // 3 code points / 6 units — fits in max 3.
        expect(truncateWithEllipsis('😀😀😀', 3)).toBe('😀😀😀');
    });

    it('trimEnd strips trailing whitespace before the ellipsis', () => {
        expect(truncateWithEllipsis('ab   cdef', 5, { trimEnd: true })).toBe(
            'ab…'
        );
        expect(truncateWithEllipsis('ab   cdef', 5)).toBe('ab  …');
    });
});

describe('truncateAtWordBoundary', () => {
    it('returns the text unchanged when it fits', () => {
        expect(truncateAtWordBoundary('가나 다라', 5)).toBe('가나 다라');
        expect(truncateAtWordBoundary('', 3)).toBe('');
    });

    it('어절 한가운데가 아니라 직전 어절 끝에서 자른다', () => {
        // 글자 수로만 자르면 `…목표 주가도 이어 봅…`처럼 단어가 끊긴다.
        const text = '애널리스트 컨센서스와 목표 주가도 이어 봅니다.';
        const result = truncateAtWordBoundary(text, 22);
        expect(result).toBe('애널리스트 컨센서스와 목표 주가도 이어…');
        expect([...result].length).toBeLessThanOrEqual(22);
    });

    it('잘린 자리 바로 뒤가 공백이면 그 어절을 버리지 않는다', () => {
        // max - 1 = 5 code points `가나다 라마` 뒤가 공백이다.
        expect(truncateAtWordBoundary('가나다 라마 바사아', 7)).toBe(
            '가나다 라마…'
        );
    });

    it('말줄임표 앞에 홀로 남은 쉼표와 여는 괄호를 남기지 않는다', () => {
        // 직전 어절 끝이 `수익성,` — 쉼표만 남기지 않는다.
        expect(
            truncateAtWordBoundary('수익성, 건전성(부채 현금흐름)', 10)
        ).toBe('수익성…');
        // 직전 공백 뒤가 여는 괄호뿐이면 괄호도 걷는다.
        expect(
            truncateAtWordBoundary('가격대 ( 지지선 저항선)을 본다', 8)
        ).toBe('가격대…');
    });

    it('닫는 따옴표와 단어에 붙은 하이픈은 걷지 않는다', () => {
        // 닫는 쪽을 걷으면 `그는 "안정적…`처럼 따옴표 짝이 깨진다.
        expect(
            truncateAtWordBoundary('그는 "안정적" 이라고 평가했다', 11)
        ).toBe('그는 "안정적"…');
        expect(truncateAtWordBoundary('버크셔 BRK- 클래스 주식', 9)).toBe(
            '버크셔 BRK-…'
        );
    });

    it('공백 뒤에 홀로 선 줄표와 여는 따옴표는 걷는다', () => {
        expect(truncateAtWordBoundary('애플 — 아이폰 제조사', 6)).toBe('애플…');
        expect(truncateAtWordBoundary('그는 “안정적”이라고 했다', 6)).toBe(
            '그는…'
        );
    });

    it('걷고 나면 남는 게 없을 때는 글자 수로 자른 머리에서 꼬리 공백만 걷는다', () => {
        expect(truncateAtWordBoundary(',  가나다라마바', 4)).toBe(',…');
    });

    it('창 안에 공백이 없으면(띄어쓰기 없는 긴 토큰) 글자 수로 자른다', () => {
        const token = '가'.repeat(60);
        const result = truncateAtWordBoundary(`앞 ${token}`, 40);
        expect([...result].length).toBe(40);
        expect(result.endsWith('…')).toBe(true);
    });

    it('never splits a surrogate pair (emoji)', () => {
        const result = truncateAtWordBoundary('ab 😀😀😀😀', 6);
        expect(result.isWellFormed()).toBe(true);
        expect([...result].length).toBeLessThanOrEqual(6);
    });

    it('결과는 항상 max code point 이하다', () => {
        const text =
            '비자, Visa Inc. (V) 회사 프로필, 밸류에이션(PER, PSR, EPS), 수익성(ROE, 마진)을 정리합니다.';
        for (const max of [1, 2, 10, 30, 50]) {
            expect(
                [...truncateAtWordBoundary(text, max)].length
            ).toBeLessThanOrEqual(max);
        }
    });
});

describe('takeWholeSentences', () => {
    it('예산에 들어가는 문장까지만 이어 붙인다', () => {
        const text = '첫 문장입니다. 둘째 문장입니다. 셋째 문장입니다.';
        expect(takeWholeSentences(text, 20)).toBe(
            '첫 문장입니다. 둘째 문장입니다.'
        );
    });

    it('첫 문장도 안 들어가면 null', () => {
        expect(takeWholeSentences('아주 긴 첫 문장입니다.', 5)).toBeNull();
    });

    it('소수점은 문장 끝이 아니다', () => {
        expect(takeWholeSentences('종가는 354.88달러입니다. 다음.', 18)).toBe(
            '종가는 354.88달러입니다.'
        );
    });

    it('빈 입력은 null', () => {
        expect(takeWholeSentences('   ', 10)).toBeNull();
    });
});
