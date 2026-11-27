import { describe, expect, it } from 'vitest';
import {
    formatChangeSinceThen,
    formatMarketPrice,
    formatTradingDate,
} from '@/widgets/agent-chat/utils/sinceEarlierFormat';

const NOW = new Date('2026-11-26T03:00:00Z');

describe('formatTradingDate', () => {
    it('올해 거래일은 연도 없이 로케일 표기로 쓴다', () => {
        expect(formatTradingDate('2026-11-18', 'ko', NOW)).toBe('11월 18일');
        expect(formatTradingDate('2026-11-18', 'en', NOW)).toBe('November 18');
        expect(formatTradingDate('2026-11-18', 'ja', NOW)).toBe('11月18日');
        expect(formatTradingDate('2026-11-18', 'zh', NOW)).toBe('11月18日');
    });

    it('올해가 아니면 연도를 붙인다', () => {
        expect(formatTradingDate('2025-12-31', 'ko', NOW)).toBe(
            '2025년 12월 31일'
        );
    });

    it('시간대가 아니라 날짜 그대로 읽는다(UTC 자정 일봉이 하루 밀리지 않는다)', () => {
        expect(formatTradingDate('2026-01-01', 'ko', NOW)).toBe('1월 1일');
    });

    it('날짜가 아닌 값은 그대로 돌려준다', () => {
        expect(formatTradingDate('어제', 'ko', NOW)).toBe('어제');
    });
});

describe('formatMarketPrice', () => {
    it('시장 프로필의 통화와 소수 자릿수로 쓴다', () => {
        expect(formatMarketPrice(1234.5, 'us-equity')).toBe('$1,234.50');
        expect(formatMarketPrice(72_000, 'kr-equity')).toBe('₩72,000');
    });
});

describe('formatChangeSinceThen', () => {
    it('부호 있는 퍼센트로 쓴다', () => {
        expect(formatChangeSinceThen(103.2, 100)).toBe('+3.2%');
        expect(formatChangeSinceThen(95, 100)).toBe('-5.0%');
        expect(formatChangeSinceThen(100, 100)).toBe('+0.0%');
    });

    it('기준값이 양수가 아니면 퍼센트를 지어내지 않는다', () => {
        expect(formatChangeSinceThen(100, 0)).toBeNull();
        expect(formatChangeSinceThen(100, -1)).toBeNull();
        expect(formatChangeSinceThen(Number.NaN, 100)).toBeNull();
    });
});
