import { isKoreanInput, deduplicateResults } from '@/domain/ticker';
import type { TickerSearchResult } from '@/domain/types';

const makeResult = (symbol: string): TickerSearchResult => ({
    symbol,
    name: `${symbol} Corp`,
    exchange: 'NASDAQ',
    exchangeFullName: 'NASDAQ Global Select',
});

describe('isKoreanInput', () => {
    describe('한국어 문자만 포함할 때', () => {
        it('true를 반환한다', () => {
            expect(isKoreanInput('애플')).toBe(true);
        });
    });

    describe('한국어 자모만 포함할 때', () => {
        it('true를 반환한다', () => {
            expect(isKoreanInput('ㅇ')).toBe(true);
        });
    });

    describe('한국어와 영어가 혼합될 때', () => {
        it('true를 반환한다', () => {
            expect(isKoreanInput('Apple애플')).toBe(true);
        });
    });

    describe('영어만 포함할 때', () => {
        it('false를 반환한다', () => {
            expect(isKoreanInput('AAPL')).toBe(false);
        });
    });

    describe('숫자만 포함할 때', () => {
        it('false를 반환한다', () => {
            expect(isKoreanInput('123')).toBe(false);
        });
    });

    describe('빈 문자열일 때', () => {
        it('false를 반환한다', () => {
            expect(isKoreanInput('')).toBe(false);
        });
    });
});

describe('deduplicateResults', () => {
    describe('빈 배열일 때', () => {
        it('빈 배열을 반환한다', () => {
            expect(deduplicateResults([])).toEqual([]);
        });
    });

    describe('중복이 없을 때', () => {
        it('입력과 동일한 배열을 반환한다', () => {
            const results = [makeResult('AAPL'), makeResult('NVDA')];
            expect(deduplicateResults(results)).toEqual(results);
        });
    });

    describe('동일한 심볼이 중복될 때', () => {
        it('첫 번째 항목만 유지한다', () => {
            const first = { ...makeResult('AAPL'), name: 'First' };
            const second = { ...makeResult('AAPL'), name: 'Second' };
            const result = deduplicateResults([first, second]);
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('First');
        });
    });

    describe('여러 종목에서 일부만 중복될 때', () => {
        it('중복 항목을 제거하고 나머지는 유지한다', () => {
            const results = [
                makeResult('AAPL'),
                makeResult('NVDA'),
                makeResult('AAPL'),
                makeResult('TSLA'),
            ];
            const deduplicated = deduplicateResults(results);
            expect(deduplicated).toHaveLength(3);
            expect(deduplicated.map(r => r.symbol)).toEqual([
                'AAPL',
                'NVDA',
                'TSLA',
            ]);
        });
    });
});
