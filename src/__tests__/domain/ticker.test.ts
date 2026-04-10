import { isKoreanInput, deduplicateResults, isValidTickerFormat } from '@/domain/ticker';
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

describe('isValidTickerFormat', () => {
    describe('표준 미국 주식 티커일 때', () => {
        it('단일 알파벳 티커를 허용한다', () => {
            expect(isValidTickerFormat('A')).toBe(true);
        });

        it('4자리 티커를 허용한다', () => {
            expect(isValidTickerFormat('AAPL')).toBe(true);
        });

        it('5자리 티커를 허용한다', () => {
            expect(isValidTickerFormat('GOOGL')).toBe(true);
        });
    });

    describe('클래스 주식 티커(점 포함)일 때', () => {
        it('BRK.A 형식을 허용한다', () => {
            expect(isValidTickerFormat('BRK.A')).toBe(true);
        });

        it('BRK.B 형식을 허용한다', () => {
            expect(isValidTickerFormat('BRK.B')).toBe(true);
        });
    });

    describe('파일 확장자 형식일 때', () => {
        it('FAVICON.ICO를 거부한다', () => {
            expect(isValidTickerFormat('FAVICON.ICO')).toBe(false);
        });

        it('INDEX.PHP를 거부한다', () => {
            expect(isValidTickerFormat('INDEX.PHP')).toBe(false);
        });

        it('XMLRPC.PHP를 거부한다', () => {
            expect(isValidTickerFormat('XMLRPC.PHP')).toBe(false);
        });

        it('MANIFEST.WEBMANIFEST를 거부한다', () => {
            expect(isValidTickerFormat('MANIFEST.WEBMANIFEST')).toBe(false);
        });
    });

    describe('하이픈이 포함된 경로 형식일 때', () => {
        it('WP-LOGIN.PHP를 거부한다', () => {
            expect(isValidTickerFormat('WP-LOGIN.PHP')).toBe(false);
        });
    });

    describe('숫자가 포함된 형식일 때', () => {
        it('INVALIDTICKER123을 거부한다', () => {
            expect(isValidTickerFormat('INVALIDTICKER123')).toBe(false);
        });
    });

    describe('6자 이상 알파벳 형식일 때', () => {
        it('6자리 티커를 거부한다', () => {
            expect(isValidTickerFormat('TOOLNG')).toBe(false);
        });
    });

    describe('빈 문자열일 때', () => {
        it('false를 반환한다', () => {
            expect(isValidTickerFormat('')).toBe(false);
        });
    });

    describe('소문자가 포함될 때', () => {
        it('소문자 티커를 거부한다', () => {
            expect(isValidTickerFormat('aapl')).toBe(false);
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
