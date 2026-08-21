import {
    buildDisplayName,
    deduplicateResults,
    isKoreanInput,
    shouldShowEnglishName,
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
            expect(buildDisplayName(null, 'AAPL', 'ko')).toBe('AAPL');
        });
    });

    describe('assetInfo가 있고 name이 ticker와 다를 때', () => {
        it('koreanName 없이 "name (ticker)" 형식으로 반환한다', () => {
            const assetInfo: AssetInfo = { symbol: 'AAPL', name: 'Apple Inc' };
            expect(buildDisplayName(assetInfo, 'AAPL', 'ko')).toBe(
                'Apple Inc (AAPL)'
            );
        });

        it('koreanName과 함께 "koreanName, name (ticker)" 형식으로 반환한다', () => {
            const assetInfo: AssetInfo = {
                symbol: 'AAPL',
                name: 'Apple Inc',
                koreanName: '애플',
            };
            expect(buildDisplayName(assetInfo, 'AAPL', 'ko')).toBe(
                '애플, Apple Inc (AAPL)'
            );
        });
    });

    describe('assetInfo가 있고 name이 ticker와 같을 때', () => {
        it('koreanName 없이 ticker를 반환한다', () => {
            const assetInfo: AssetInfo = { symbol: 'AAPL', name: 'AAPL' };
            expect(buildDisplayName(assetInfo, 'AAPL', 'ko')).toBe('AAPL');
        });

        it('koreanName이 있으면 "koreanName (ticker)" 형식으로 반환한다', () => {
            const assetInfo: AssetInfo = {
                symbol: 'AAPL',
                name: 'AAPL',
                koreanName: '애플',
            };
            expect(buildDisplayName(assetInfo, 'AAPL', 'ko')).toBe(
                '애플 (AAPL)'
            );
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
                '005930.KS',
                'ko'
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
                '247540.KQ',
                'ko'
            )
        ).toBe('에코프로비엠 (247540.KQ)');
    });

    it('한글명이 없으면 종전대로 영문명을 쓴다', () => {
        expect(
            buildDisplayName(
                { symbol: '005930.KS', name: 'Samsung Electronics Co., Ltd.' },
                '005930.KS',
                'ko'
            )
        ).toBe('Samsung Electronics Co., Ltd. (005930.KS)');
    });

    it('미국 종목이라도 영문명이 한글명과 같으면 한 번만 쓴다', () => {
        // KR 분기와 confound되지 않도록 미국 티커로 검증한다 — 이 조건이 없으면
        // 번역이 원문을 그대로 돌려준 종목에서 `애플, 애플 (AAPL)`이 나온다.
        expect(
            buildDisplayName(
                { symbol: 'AAPL', name: '애플', koreanName: '애플' },
                'AAPL',
                'ko'
            )
        ).toBe('애플 (AAPL)');
    });

    it('미국 종목은 영문 법인명을 그대로 유지한다', () => {
        expect(
            buildDisplayName(
                { symbol: 'AAPL', name: 'Apple Inc.', koreanName: '애플' },
                'AAPL',
                'ko'
            )
        ).toBe('애플, Apple Inc. (AAPL)');
    });
});

/**
 * `buildDisplayName`과 `SymbolLayoutHeader`가 공유하는 판정. 헤더 쪽 옛 구현은
 * `name !== ''` 가드가 빠져 있어 이름이 빈 문자열인 종목에서 `한글명, (TICKER)`처럼
 * 빈 span과 낙오된 쉼표가 렌더됐다 — 이 describe는 그 회귀를 이 함수 하나로 막는다.
 */
describe('shouldShowEnglishName — 기본 로케일(ko)', () => {
    it('국내 상장 종목이면 영문명이 달라도 보여주지 않는다', () => {
        expect(
            shouldShowEnglishName(
                'Samsung Electronics Co., Ltd.',
                '삼성전자',
                '005930.KS',
                'ko'
            )
        ).toBe(false);
    });

    it('name과 koreanName이 같으면 보여주지 않는다', () => {
        expect(shouldShowEnglishName('애플', '애플', 'AAPL', 'ko')).toBe(false);
    });

    it('name이 ticker와 같으면 보여주지 않는다', () => {
        expect(shouldShowEnglishName('AAPL', '애플', 'AAPL', 'ko')).toBe(false);
    });

    it('name이 빈 문자열이면 보여주지 않는다', () => {
        // getAssetInfo.crypto.test.ts가 실증하듯 시세만 있고 이름이 없는 종목에서
        // name은 빈 문자열로 온다 — 빈 span과 낙오된 쉼표를 막는 가드.
        expect(shouldShowEnglishName('', '애플', 'AAPL', 'ko')).toBe(false);
    });

    it('미국 종목에서 name이 ticker·koreanName과 모두 다르면 보여준다', () => {
        expect(shouldShowEnglishName('Apple Inc.', '애플', 'AAPL', 'ko')).toBe(
            true
        );
    });
});

/**
 * 로케일 회귀.
 *
 * `buildDisplayName`은 한국어 *리터럴*을 담지 않고 한국어 *데이터*를 고른다 —
 * 그래서 `i18n:lint` 기준선이 구조적으로 볼 수 없었고, `/en/AAPL`의
 * `<title>`·`og:description`·페이지 헤더가 전부 `애플, Apple Inc. (AAPL)`로
 * 나갔다.
 */
describe('buildDisplayName — 로케일', () => {
    const APPLE = {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        koreanName: '애플',
    } as never;

    it('ko는 한국어명을 앞세운다', () => {
        expect(buildDisplayName(APPLE, 'AAPL', 'ko')).toContain('애플');
    });

    it.each(['en', 'ja', 'zh'] as const)('%s는 한글을 쓰지 않는다', locale => {
        expect(buildDisplayName(APPLE, 'AAPL', locale)).toBe(
            'Apple Inc. (AAPL)'
        );
    });

    /** 영문명이 없으면 티커만 남기는 것보다 한국어명이 낫다 — 데이터 부재다. */
    it('영문명이 없으면 비-ko도 한국어명으로 떨어진다', () => {
        const krOnly = {
            symbol: '005930.KS',
            name: '',
            koreanName: '삼성전자',
        } as never;

        expect(buildDisplayName(krOnly, '005930.KS', 'en')).toBe(
            '삼성전자 (005930.KS)'
        );
    });
});

/**
 * 헤더(`SymbolLayoutHeader`)는 색을 나눠 span으로 그리느라 `buildDisplayName`의
 * **문자열**을 재사용할 수 없다. 그래서 **판정**만 공유한다. 이 테스트는 그
 * 공유가 실제로 성립하는지 — 두 소비자가 같은 이름을 말하는지 — 를 본다.
 *
 * 갈렸던 실제 사례: `/en/005930.KS`에서 헤더 `삼성전자`, `<title>`
 * `Samsung Electronics Co Ltd`.
 */
describe('shouldShowEnglishName — buildDisplayName과 판정 일치', () => {
    const cases: Array<{ info: AssetInfo; ticker: string }> = [
        {
            info: {
                name: 'Samsung Electronics Co Ltd',
                koreanName: '삼성전자',
            } as AssetInfo,
            ticker: '005930.KS',
        },
        {
            info: { name: 'Apple Inc.', koreanName: '애플' } as AssetInfo,
            ticker: 'AAPL',
        },
        {
            info: { name: '', koreanName: '삼성전자' } as AssetInfo,
            ticker: '005930.KS',
        },
    ];

    it.each(cases)(
        '$ticker — 영문명 노출 판정이 최종 문자열과 어긋나지 않는다',
        ({ info, ticker }) => {
            for (const locale of ['ko', 'en', 'ja', 'zh'] as const) {
                const shown = shouldShowEnglishName(
                    info.name,
                    info.koreanName,
                    ticker,
                    locale
                );
                const display = buildDisplayName(info, ticker, locale);

                // 판정이 true면 영문명이 문자열에 있어야 하고, false면 없어야 한다.
                expect(info.name !== '' && display.includes(info.name)).toBe(
                    shown
                );
            }
        }
    );

    it('비-ko에서는 국내 종목도 영문 법인명을 노출한다', () => {
        // `isKrEquitySymbol` 배제는 한국어 SERP 예산 규칙이라 ko에만 적용된다.
        expect(
            shouldShowEnglishName(
                'Samsung Electronics Co Ltd',
                '삼성전자',
                '005930.KS',
                'en'
            )
        ).toBe(true);
        expect(
            shouldShowEnglishName(
                'Samsung Electronics Co Ltd',
                '삼성전자',
                '005930.KS',
                'ko'
            )
        ).toBe(false);
    });
});
