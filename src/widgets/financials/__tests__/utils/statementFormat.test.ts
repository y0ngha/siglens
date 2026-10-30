import { describe, expect, it } from 'vitest';
import {
    EMPTY_CELL,
    cellToneClass,
    formatPercent,
    formatStatementValue,
} from '@/widgets/financials/utils/statementFormat';

describe('formatStatementValue', () => {
    it('값이 없으면 대시를 쓴다', () => {
        expect(formatStatementValue(null, 'usd', 'USD', 'ko')).toBe(EMPTY_CELL);
        expect(formatStatementValue(null, 'perShare', 'USD', 'ko')).toBe('-');
    });

    it('usd는 보고 통화로 축약 금액을 낸다', () => {
        expect(formatStatementValue(5_000_000_000, 'usd', 'USD', 'en')).toBe(
            '$5B'
        );
        expect(
            formatStatementValue(1_200_000_000_000, 'usd', 'TWD', 'en')
        ).toContain('TWD');
    });

    it('perShare는 천 단위 구분자를 붙이고 원화는 소수를 쓰지 않는다', () => {
        expect(formatStatementValue(4950, 'perShare', 'KRW', 'ko')).toBe(
            '₩4,950'
        );
        expect(formatStatementValue(1234.5, 'perShare', 'USD', 'en')).toBe(
            '$1,234.50'
        );
    });

    it('거부된 통화 코드는 상장 통화 표기로 폴백한다', () => {
        expect(formatStatementValue(5, 'perShare', 'bad-code', 'en')).toBe(
            '$5.00'
        );
        expect(
            formatStatementValue(5_000_000_000, 'usd', 'bad-code', 'en')
        ).toBe('$5B');
    });

    it('pct와 num, 그리고 format 생략은 통화와 무관하다', () => {
        expect(formatStatementValue(12.527, 'pct', 'KRW', 'ko')).toBe('12.5%');
        expect(formatStatementValue(1.5, 'num', 'KRW', 'ko')).toBe('1.50');
        expect(formatStatementValue(1.5, undefined, 'KRW', 'ko')).toBe('1.50');
    });
});

describe('formatPercent', () => {
    it('소수 첫째 자리까지 퍼센트로 표기한다', () => {
        expect(formatPercent(12.527431)).toBe('12.5%');
    });
});

describe('cellToneClass', () => {
    it('값이 없으면 흐린 색이다', () => {
        expect(cellToneClass(null, true)).toBe('text-secondary-400');
    });

    it('colorize가 꺼진 행은 부호와 무관하게 중립색이다', () => {
        expect(cellToneClass(-5, false)).toBe('text-secondary-300');
        expect(cellToneClass(5, false)).toBe('text-secondary-300');
    });

    it('colorize가 켜진 행은 음수 위험 / 양수 성공 / 0 상속이다', () => {
        expect(cellToneClass(-5, true)).toBe('text-ui-danger-text');
        expect(cellToneClass(5, true)).toBe('text-ui-success-text');
        expect(cellToneClass(0, true)).toBe('');
    });
});
