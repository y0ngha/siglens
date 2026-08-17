import {
    buildDisplayName,
    deduplicateResults,
    isKoreanInput,
} from '@/entities/ticker/lib/ticker';
import type { AssetInfo, TickerSearchResult } from '@/shared/lib/types';

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

describe('buildDisplayName', () => {
    describe('assetInfo가 null일 때', () => {
        it('ticker를 그대로 반환한다', () => {
            expect(buildDisplayName(null, 'AAPL')).toBe('AAPL');
        });
    });

    describe('assetInfo가 있고 name이 ticker와 다를 때', () => {
        it('koreanName 없이 "name (ticker)" 형식으로 반환한다', () => {
            const assetInfo: AssetInfo = { symbol: 'AAPL', name: 'Apple Inc' };
            expect(buildDisplayName(assetInfo, 'AAPL')).toBe(
                'Apple Inc (AAPL)'
            );
        });

        it('koreanName과 함께 "koreanName, name (ticker)" 형식으로 반환한다', () => {
            const assetInfo: AssetInfo = {
                symbol: 'AAPL',
                name: 'Apple Inc',
                koreanName: '애플',
            };
            expect(buildDisplayName(assetInfo, 'AAPL')).toBe(
                '애플, Apple Inc (AAPL)'
            );
        });
    });

    describe('assetInfo가 있고 name이 ticker와 같을 때', () => {
        it('koreanName 없이 ticker를 반환한다', () => {
            const assetInfo: AssetInfo = { symbol: 'AAPL', name: 'AAPL' };
            expect(buildDisplayName(assetInfo, 'AAPL')).toBe('AAPL');
        });

        it('koreanName이 있으면 "koreanName (ticker)" 형식으로 반환한다', () => {
            const assetInfo: AssetInfo = {
                symbol: 'AAPL',
                name: 'AAPL',
                koreanName: '애플',
            };
            expect(buildDisplayName(assetInfo, 'AAPL')).toBe('애플 (AAPL)');
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

/**
 * 국내 상장 종목의 표시명에서 영문 법인명을 뺀다.
 *
 * `displayName`은 meta description의 주어로 그대로 들어간다. 고정 후미가 90자인데
 * `삼성전자, Samsung Electronics Co., Ltd. (005930.KS)`가 47자라 합이 137자 —
 * 상한 120자를 넘겨 **모든 국내 종목 페이지에서 설명 끝문장이 잘려 나갔다**.
 * 한국어 SERP에서 영문 법인명이 보태는 것도 없다.
 */
describe('buildDisplayName — 국내 상장 종목', () => {
    it('영문 법인명을 빼고 한글명 + 티커만 남긴다', () => {
        expect(
            buildDisplayName(
                {
                    symbol: '005930.KS',
                    name: 'Samsung Electronics Co., Ltd.',
                    koreanName: '삼성전자',
                },
                '005930.KS'
            )
        ).toBe('삼성전자 (005930.KS)');
    });

    it('종목 마스터 시드가 name에 한글명을 넣어 둔 행도 중복 표기하지 않는다', () => {
        // 시드는 영문명을 주지 않아 `name`에 한글명을 채운다 — 방문 전 종목이 이 상태다.
        expect(
            buildDisplayName(
                {
                    symbol: '247540.KQ',
                    name: '에코프로비엠',
                    koreanName: '에코프로비엠',
                },
                '247540.KQ'
            )
        ).toBe('에코프로비엠 (247540.KQ)');
    });

    it('한글명이 없으면 종전대로 영문명을 쓴다', () => {
        expect(
            buildDisplayName(
                { symbol: '005930.KS', name: 'Samsung Electronics Co., Ltd.' },
                '005930.KS'
            )
        ).toBe('Samsung Electronics Co., Ltd. (005930.KS)');
    });

    it('미국 종목은 영문 법인명을 그대로 유지한다', () => {
        expect(
            buildDisplayName(
                { symbol: 'AAPL', name: 'Apple Inc.', koreanName: '애플' },
                'AAPL'
            )
        ).toBe('애플, Apple Inc. (AAPL)');
    });
});
