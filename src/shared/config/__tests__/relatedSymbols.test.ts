import { describe, expect, it } from 'vitest';
import {
    RELATED_SYMBOL_COUNT,
    relatedSymbolsFor,
    ringNeighbors,
    roundRobinMerge,
    SYMBOL_LINK_RINGS,
    themePeersOf,
} from '@/shared/config/relatedSymbols';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import {
    CURATED_KOREAN_NAMES,
    POPULAR_TICKERS,
} from '@/shared/config/popular-tickers';
import {
    MARKET_INDICES,
    SECTOR_ETFS,
    SECTOR_STOCKS,
} from '@/shared/config/dashboard-tickers';
import { CRYPTO_CATEGORIES } from '@/shared/config/crypto-categories';
import { KR_SYMBOL_RE } from '@/shared/config/ticker';

const UNIVERSE: readonly string[] = [...POPULAR_TICKERS, ...POPULAR_CRYPTOS];

describe('relatedSymbolsFor', () => {
    /**
     * **이 파일의 존재 이유.** 2026-08-24 실측에서 sitemap이 광고하는 431종 중
     * 303종(70%)이 내부링크를 하나도 받지 못했다. 그 상태로 되돌아가는 회귀를
     * 잡는 게 이 스위트의 목적이고, 아래 첫 테스트가 그 계약이다.
     *
     * 섹터/테마 기반 선정으로 바꾸고 링 ±1 보장을 빼면 커버리지가 146/402로
     * 떨어지면서 **이 테스트가 즉시 깨진다** — 실제로 그렇게 되는지 확인하고
     * 채택한 설계다.
     */
    it('유니버스의 모든 심볼이 최소 1개의 인바운드 링크를 받는다 (고아 0)', () => {
        const inbound = new Map<string, number>(
            UNIVERSE.map(symbol => [symbol, 0])
        );
        for (const symbol of UNIVERSE) {
            for (const related of relatedSymbolsFor(symbol)) {
                inbound.set(
                    related.symbol,
                    (inbound.get(related.symbol) ?? 0) + 1
                );
            }
        }
        const orphans = [...inbound]
            .filter(([, count]) => count === 0)
            .map(([symbol]) => symbol);
        expect(orphans).toEqual([]);
    });

    /**
     * 고아 0을 **구조적으로** 고정하는 계약.
     *
     * 위의 "고아 0" 테스트만으로는 부족하다 — 링 예약을 없애도 지금 데이터에서는
     * 우연히 통과한다(테마 그룹이 8칸을 다 먹는 심볼의 이웃들이 마침 다른 곳에서
     * 인바운드를 받고 있기 때문). 그런 우연에 기대면 카테고리를 하나 넓히는 순간
     * 조용히 고아가 생긴다. 그래서 결과가 아니라 **원인**을 단언한다: 모든 심볼이
     * 자기 링 ±1 이웃 **둘 다**를 반드시 포함해야 한다. 이게 유니버스 전체를 하나의
     * 해밀턴 순환으로 이어 준다.
     *
     * 변이 검증(2026-08-24): `themeBudget` 예약을 제거하면 XLK처럼 테마 피어가
     * 8칸을 채우는 심볼에서 이 테스트가 실패한다 — 실제로 확인했다.
     */
    it('모든 심볼이 링 ±1 이웃을 반드시 포함한다 (해밀턴 순환 = 고아 0의 원인)', () => {
        for (const ring of SYMBOL_LINK_RINGS) {
            for (const [index, symbol] of ring.entries()) {
                const symbols = relatedSymbolsFor(symbol).map(r => r.symbol);
                const prev = ring[(index - 1 + ring.length) % ring.length];
                const next = ring[(index + 1) % ring.length];
                expect(symbols).toContain(prev);
                expect(symbols).toContain(next);
            }
        }
    });

    /**
     * 라운드로빈 병합 — 실제 데이터로는 도달하지 않는 조합(그룹 길이가 서로 다름,
     * 그룹 간 중복 피어)을 작은 입력으로 직접 고정한다. `ringNeighbors`와 같은 이유다.
     *
     * 이 순서가 곧 "관련 종목" 칩의 노출 순서이고, 평탄화로 되돌리면 교차시장
     * 그룹이 예산에서 밀려난다(round 1에서 실제로 겪은 회귀).
     */
    describe('roundRobinMerge — 그룹 간 균등 배분', () => {
        it('각 그룹의 1번째 → 2번째 … 순으로 번갈아 편다', () => {
            expect(
                roundRobinMerge([
                    ['A', 'B', 'C'],
                    ['X', 'Y'],
                ])
            ).toEqual(['A', 'X', 'B', 'Y', 'C']);
        });

        it('그룹 간 중복 피어는 첫 등장 위치를 유지한 채 접는다', () => {
            expect(
                roundRobinMerge([
                    ['A', 'B', 'C'],
                    ['X', 'Y'],
                    ['B', 'Z'],
                ])
            ).toEqual(['A', 'X', 'B', 'Y', 'Z', 'C']);
        });

        it('한 그룹이 앞자리를 독식하지 않는다 (평탄화와의 차이)', () => {
            const long = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8'];
            const short = ['S1', 'S2'];
            const merged = roundRobinMerge([long, short]);
            // 평탄화였다면 앞 8칸이 전부 long이라 S1이 9번째로 밀린다.
            expect(merged.indexOf('S1')).toBeLessThan(3);
            expect(merged.indexOf('S2')).toBeLessThan(5);
        });

        it('그룹이 없거나 비면 빈 배열', () => {
            expect(roundRobinMerge([])).toEqual([]);
            expect(roundRobinMerge([[], []])).toEqual([]);
        });
    });

    /**
     * 링 반경 상한의 경계 — 실제 링은 전부 20개가 넘어 통합 테스트로는 고정할 수
     * 없다. 그래서 순수 헬퍼를 직접 부른다.
     *
     * 리뷰(round 1)가 잡은 결함: 상한이 `floor((length - 1) / 2)`였을 때
     * **length 2에서 0**이 되어 그 링의 두 심볼이 서로를 링크하지 않았다. 지금 링을
     * 쪼개다 2개짜리가 생기는 순간 조용히 고아가 됐을 것이다.
     */
    describe('ringNeighbors — 짧은 링 경계', () => {
        it('2원소 링도 서로를 이웃으로 낸다 (고아 0의 최소 조건)', () => {
            expect(ringNeighbors(['A', 'B'], 0, 1)).toContain('B');
            expect(ringNeighbors(['A', 'B'], 1, 1)).toContain('A');
        });

        it('자기 자신을 이웃으로 내지 않는다', () => {
            for (const length of [2, 3, 4, 5, 6, 7]) {
                const ring = Array.from({ length }, (_, i) => `S${i}`);
                for (const [index, symbol] of ring.entries()) {
                    expect(ringNeighbors(ring, index, 4)).not.toContain(symbol);
                }
            }
        });

        it('원소가 하나뿐이면 이웃이 없다 (링으로는 이을 짝이 없음)', () => {
            expect(ringNeighbors(['ONLY'], 0, 4)).toEqual([]);
        });
    });

    it('링들이 유니버스를 빠짐없이·중복 없이 덮는다', () => {
        // 위 해밀턴 순환 단언은 "링에 있는 심볼"만 훑는다. 링 분리(미국/한국/
        // 암호화폐)가 심볼을 흘리면 그 심볼은 검사조차 되지 않은 채 고아가 된다.
        const covered = SYMBOL_LINK_RINGS.flat();
        expect(new Set(covered).size).toBe(covered.length);
        expect([...covered].sort()).toEqual([...UNIVERSE].sort());
    });

    it('모든 심볼이 정확히 RELATED_SYMBOL_COUNT개를 내보내고 자기 자신은 없다', () => {
        for (const symbol of UNIVERSE) {
            const related = relatedSymbolsFor(symbol);
            expect(related).toHaveLength(RELATED_SYMBOL_COUNT);
            expect(related.map(r => r.symbol)).not.toContain(symbol);
        }
    });

    it('중복 심볼을 내보내지 않는다', () => {
        for (const symbol of UNIVERSE) {
            const symbols = relatedSymbolsFor(symbol).map(r => r.symbol);
            expect(new Set(symbols).size).toBe(symbols.length);
        }
    });

    // ISR은 첫 렌더를 캐시에 굳힌다. 호출마다 결과가 달라지면 재생성 때마다
    // HTML 해시가 달라져 write churn이 생긴다(다른 seed 경로에서 실제로 겪은 문제).
    it('같은 입력에 항상 같은 결과를 준다 (ISR HTML 결정성)', () => {
        for (const symbol of ['NVDA', 'BTCUSD', '005930.KS']) {
            expect(relatedSymbolsFor(symbol)).toEqual(
                relatedSymbolsFor(symbol)
            );
        }
    });

    it('대소문자를 정규화한다', () => {
        expect(relatedSymbolsFor('nvda')).toEqual(relatedSymbolsFor('NVDA'));
    });

    it('유니버스 밖 심볼은 빈 배열 — 호출부가 섹션을 생략한다', () => {
        expect(relatedSymbolsFor('NOT-A-REAL-TICKER')).toEqual([]);
    });

    it('주식과 암호화폐 링을 섞지 않는다', () => {
        const cryptoSet = new Set<string>(POPULAR_CRYPTOS);
        for (const crypto of POPULAR_CRYPTOS) {
            for (const related of relatedSymbolsFor(crypto)) {
                expect(cryptoSet.has(related.symbol)).toBe(true);
            }
        }
        for (const related of relatedSymbolsFor('NVDA')) {
            expect(cryptoSet.has(related.symbol)).toBe(false);
        }
    });

    /**
     * 링을 하나로 합쳤을 때 실제로 나온 결함: `AAPL`(배열 0번)의 이웃에
     * `HPSP(403870.KQ)`가 붙었다. 배열 양 끝이 맞물리는 지점이라 미국 대형주가
     * 코스닥 종목을 "관련 종목"으로 내보내고 있었다.
     *
     * **금지하는 것은 "시장을 넘는 것"이 아니라 "근거 없이 넘는 것"이다.**
     * 시장을 넘더라도 같은 테마 그룹이면 정당한 관련 종목이다 — 반도체 테마로
     * `NVDA ↔ SK하이닉스`를 묶는 큐레이션은 언제든 추가할 수 있어야 한다.
     * 그래서 결과 전체에 혼합 금지를 걸지 않고, **테마 근거가 없는 혼합만**
     * 막는다. 링(배열 인접성)은 위치 잡음이라 시장을 넘을 근거가 되지 못한다.
     */
    it('테마 근거 없이 시장을 넘지 않는다 (테마 피어는 넘어도 됨)', () => {
        const isKr = (symbol: string) => KR_SYMBOL_RE.test(symbol);
        for (const symbol of POPULAR_TICKERS) {
            const themePeers = new Set(themePeersOf(symbol));
            for (const related of relatedSymbolsFor(symbol)) {
                if (isKr(related.symbol) === isKr(symbol)) continue;
                expect(themePeers).toContain(related.symbol);
            }
        }
    });

    describe('관련성 — 테마 피어가 먼저 온다', () => {
        it('섹터 ETF는 자기 구성종목을 앞에 세운다', () => {
            const xlkStocks = SECTOR_STOCKS.filter(
                s => s.sectorSymbol === 'XLK'
            ).map(s => s.symbol);
            expect(xlkStocks.length).toBeGreaterThan(0);

            const related = relatedSymbolsFor('XLK').map(r => r.symbol);
            // 구성종목이 8개를 넘지 않는 한 링 ±1 두 자리를 뺀 앞부분이 전부
            // 구성종목이어야 한다.
            const themeSlots = related.slice(
                0,
                Math.min(xlkStocks.length, RELATED_SYMBOL_COUNT - 2)
            );
            for (const symbol of themeSlots) {
                expect(xlkStocks).toContain(symbol);
            }
        });

        it('섹터 구성종목은 같은 섹터의 형제와 그 섹터 ETF로 이어진다', () => {
            const peers = new Set(
                SECTOR_STOCKS.filter(s => s.sectorSymbol === 'XLK').map(
                    s => s.symbol
                )
            );
            peers.add('XLK');
            const related = relatedSymbolsFor('AAPL').map(r => r.symbol);
            expect(related.some(symbol => peers.has(symbol))).toBe(true);
        });

        it('한국 종목은 같은 KR 카테고리 형제를 포함한다', () => {
            // 큐레이션 KR 카테고리(반도체·IT)에 함께 있는 형제.
            const related = relatedSymbolsFor('005930.KS').map(r => r.symbol);
            expect(related).toContain('000660.KS');
        });
    });

    /**
     * 교차시장 큐레이션 — 사용자 요구(2026-08-24): "NVDA ↔ SK하이닉스/삼성전자,
     * 현대자동차 ↔ 테슬라 뭐 이런거로다가".
     *
     * **양방향이어야 한다.** 그룹 기반이라 자동으로 대칭이지만, 누군가 단방향
     * 매핑으로 리팩터링하면 한쪽만 남는다 — 그 회귀를 막는다.
     */
    describe('교차시장 테마 — 미국·한국을 의도적으로 잇는다', () => {
        const CROSS_PAIRS: readonly (readonly [string, string])[] = [
            ['NVDA', '005930.KS'], // 엔비디아 ↔ 삼성전자
            ['NVDA', '000660.KS'], // 엔비디아 ↔ SK하이닉스
            ['TSLA', '005380.KS'], // 테슬라 ↔ 현대차
            ['GOOGL', '035420.KS'], // 알파벳 ↔ 네이버
            ['LLY', '207940.KS'], // 일라이릴리 ↔ 삼성바이오로직스
        ];

        it.each(CROSS_PAIRS)('%s ↔ %s 가 서로를 링크한다', (a, b) => {
            expect(relatedSymbolsFor(a).map(r => r.symbol)).toContain(b);
            expect(relatedSymbolsFor(b).map(r => r.symbol)).toContain(a);
        });

        /**
         * 라운드로빈이 없으면 먼저 나열된 그룹이 예산 6칸을 통째로 먹는다.
         * `NVDA`는 메가캡 카테고리(피어 8개)와 AI 반도체 밸류체인 두 그룹에
         * 속하는데, 평탄화 순서대로 자르면 삼성전자·SK하이닉스가 한 칸도 못
         * 들어간다 — 교차시장 그룹을 만든 이유가 통째로 사라진다.
         */
        it('여러 테마에 속한 심볼은 한 그룹이 예산을 독식하지 않는다', () => {
            const related = relatedSymbolsFor('NVDA').map(r => r.symbol);
            const megacap = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META'];
            const crossChain = ['005930.KS', '000660.KS', 'AMD', 'AVGO'];
            expect(related.some(x => megacap.includes(x))).toBe(true);
            expect(related.some(x => crossChain.includes(x))).toBe(true);
        });
    });

    describe('앵커 텍스트', () => {
        /**
         * `KOREAN_NAMES`는 다섯 소스를 spread로 합치는데, `Map` 생성자는 같은 키가
         * 두 번 오면 **나중 값으로 조용히 덮어쓴다.** 지금은 어긋나는 심볼이 없지만
         * 그건 우연이고, 소스를 추가하면 예고 없이 이름이 바뀔 수 있다
         * (claude-review PR #765 제안). 충돌을 즉시 실패로 만든다.
         */
        it('소스 간 한글명이 어긋나지 않는다 (조용한 덮어쓰기 방지)', () => {
            const sources: readonly (readonly (readonly [string, string])[])[] =
                [
                    [...CURATED_KOREAN_NAMES],
                    SECTOR_STOCKS.map(x => [x.symbol, x.koreanName] as const),
                    SECTOR_ETFS.map(x => [x.symbol, x.koreanName] as const),
                    MARKET_INDICES.map(x => [x.symbol, x.koreanName] as const),
                    CRYPTO_CATEGORIES.flatMap(c =>
                        c.items.map(i => [i.symbol, i.name] as const)
                    ),
                ];
            const seen = new Map<string, string>();
            const conflicts: string[] = [];
            for (const source of sources) {
                for (const [symbol, name] of source) {
                    const prior = seen.get(symbol);
                    if (prior !== undefined && prior !== name) {
                        conflicts.push(`${symbol}: "${prior}" vs "${name}"`);
                    }
                    seen.set(symbol, name);
                }
            }
            // 2026-08-24 이전엔 12건이 어긋나 있었다(홈 카드 vs 마켓 대시보드).
            // `CANONICAL_KOREAN_NAMES`가 정본을 정하고 양쪽을 그 값으로 맞춰
            // 0이 됐다 — 동결 목록 없이 빈 배열을 단언하는 게 이제 정확하다.
            expect(conflicts).toEqual([]);
        });

        it('큐레이션 한글명이 있으면 함께 노출한다', () => {
            const related = relatedSymbolsFor('MSFT');
            const nvda = related.find(r => r.symbol === 'NVDA');
            // NVDA는 메가캡 카테고리 형제라 반드시 목록에 있다.
            expect(nvda?.koreanName).toBe(CURATED_KOREAN_NAMES.get('NVDA'));
        });

        it('섹터 ETF 한글명도 소스로 쓴다', () => {
            const etf = SECTOR_ETFS[0];
            const related = relatedSymbolsFor(etf.symbol);
            const named = related.filter(r => r.koreanName !== undefined);
            expect(named.length).toBeGreaterThan(0);
        });

        /**
         * `.KS`/`.KQ`는 yahoo 벤더 규약이고 한국 검색량이 0이다. 사이트의 title
         * 표기(`삼성전자(005930) 주가 전망`)와 JSON-LD 식별자(`KRX:005930`)가 이미
         * 떼고 있으므로 칩만 다르게 두면 같은 종목이 화면마다 다른 이름이 된다.
         * **href는 절대 자르면 안 된다** — 접미사가 없으면 라우트가 종목을 특정하지
         * 못한다. 그 둘이 갈라지는 것을 이 테스트가 막는다.
         */
        it('국내 종목은 표기에서만 거래소 접미사를 뗀다 (href는 유지)', () => {
            const samsung = relatedSymbolsFor('000660.KS').find(
                r => r.symbol === '005930.KS'
            );
            expect(samsung).toBeDefined();
            expect(samsung!.displayTicker).toBe('005930');

            for (const symbol of UNIVERSE) {
                for (const related of relatedSymbolsFor(symbol)) {
                    expect(related.displayTicker).toBe(
                        related.symbol.replace(/\.K[SQ]$/, '')
                    );
                    // 미국·암호화폐 심볼은 손대지 않는다.
                    if (!KR_SYMBOL_RE.test(related.symbol)) {
                        expect(related.displayTicker).toBe(related.symbol);
                    }
                }
            }
        });

        it('한글명이 없는 심볼은 koreanName을 붙이지 않는다 (빈 문자열 아님)', () => {
            for (const symbol of UNIVERSE) {
                for (const related of relatedSymbolsFor(symbol)) {
                    if (related.koreanName !== undefined) {
                        expect(related.koreanName).not.toBe('');
                    }
                }
            }
        });
    });
});
