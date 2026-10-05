/**
 * 종목 디렉터리의 **커버리지**를 고정한다.
 *
 * 이 페이지의 존재 이유가 "sitemap에만 있는 심볼을 없앤다"이므로, 목록이 sitemap
 * 소스와 어긋나는 순간 페이지는 의미를 잃는다(링크 없는 심볼이 다시 생긴다).
 * 그래서 화면 렌더가 아니라 **집합 동등성**을 단언한다.
 */
import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { buildPrewarmUniverse } from '@/entities/seo-snapshot/lib/applicability';
import { buildSymbolDirectory } from '@/shared/lib/symbolDirectory';

const allItems = () =>
    buildSymbolDirectory(new Map(), 'ko-KR').flatMap(s => s.items);

describe('buildSymbolDirectory', () => {
    it('sitemap 소스(POPULAR_TICKERS + POPULAR_CRYPTOS)의 모든 심볼을 정확히 한 번 담는다', () => {
        const listed = allItems().map(i => i.symbol);
        const expected = [...POPULAR_TICKERS, ...POPULAR_CRYPTOS];

        expect([...new Set(listed)]).toHaveLength(listed.length);
        expect(new Set(listed)).toEqual(new Set(expected));
    });

    /**
     * 우리가 링크하는 페이지는 프리웜 대상이어야 한다 — 스냅샷 없는 콜드 페이지로
     * 크롤러를 끌고 가면 얇은 상태로 색인된다(`internalLinksArePrewarmed` 가드와
     * 같은 이유. 그 가드는 `RelatedSymbols`만 덮으므로 이 표면은 여기서 본다).
     */
    it('링크하는 모든 심볼이 프리웜 유니버스 안에 있다', () => {
        const prewarmed = new Set(buildPrewarmUniverse().map(p => p.symbol));
        const escaped = allItems()
            .map(i => i.symbol)
            .filter(symbol => !prewarmed.has(symbol));

        expect(escaped).toEqual([]);
    });

    it('한국 종목과 암호화폐를 미국 섹션과 섞지 않는다', () => {
        const [us, kr, crypto] = buildSymbolDirectory(new Map(), 'ko-KR');

        expect(us.id).toBe('us');
        expect(kr.items.every(i => /\.K[SQ]$/.test(i.symbol))).toBe(true);
        expect(us.items.every(i => !/\.K[SQ]$/.test(i.symbol))).toBe(true);
        expect(new Set(crypto.items.map(i => i.symbol))).toEqual(
            new Set(POPULAR_CRYPTOS)
        );
    });

    it('이름을 모르면 섹션마다 티커 순이다 — 416개를 눈으로 찾으려면 순서가 필요하다', () => {
        for (const section of buildSymbolDirectory(new Map(), 'en-US')) {
            const symbols = section.items.map(i => i.symbol);
            const collator = new Intl.Collator('en-US', {
                numeric: true,
                sensitivity: 'base',
            });
            expect(symbols).toEqual(
                [...symbols].sort(
                    (a, b) =>
                        collator.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0)
                )
            );
        }
    });

    it('이름을 알면 `자산명 (티커)`, 모르면 티커만 찍는다', () => {
        const [us] = buildSymbolDirectory(
            new Map([[POPULAR_TICKERS[0], '애플']]),
            'ko-KR'
        );

        const named = us.items.find(i => i.symbol === POPULAR_TICKERS[0]);
        expect(named?.label).toBe(`애플 (${POPULAR_TICKERS[0]})`);

        // 이름 맵에 없는 종목은 티커만 — 링크는 어떤 경우에도 남아야 한다.
        const unnamed = us.items.find(i => i.symbol !== POPULAR_TICKERS[0]);
        expect(unnamed?.label).toBe(unnamed?.symbol);
    });

    it('이름 맵이 비어도(조회 실패) 전 종목을 그대로 링크한다', () => {
        const items = buildSymbolDirectory(new Map(), 'ko-KR').flatMap(
            s => s.items
        );

        expect(items).toHaveLength(
            POPULAR_TICKERS.length + POPULAR_CRYPTOS.length
        );
        expect(items.every(i => i.label === i.symbol)).toBe(true);
    });

    /**
     * 정렬은 티커가 아니라 **화면에 찍히는 이름**을 따른다. 티커 순이던 때는
     * `아모레퍼시픽(090430.KS)`이 `삼성전자(005930.KS)`보다 뒤에 와서 한글 목록이
     * 가나다순으로 읽히지 않았다.
     */
    describe('이름 기준 정렬', () => {
        const KR = ['005930.KS', '000660.KS', '035420.KS', '035720.KS'];
        const kr = (names: Map<string, string>, locale: string) =>
            buildSymbolDirectory(names, locale)
                .find(s => s.id === 'kr')!
                .items.filter(i => KR.includes(i.symbol));

        it('ko: 가나다순 — 카카오(035720)가 삼성전자(005930)보다 뒤고 네이버(035420)는 앞선다', () => {
            const items = kr(
                new Map([
                    ['005930.KS', '삼성전자'],
                    ['000660.KS', 'SK하이닉스'],
                    ['035420.KS', '네이버'],
                    ['035720.KS', '카카오'],
                ]),
                'ko-KR'
            );
            // 티커 순이었다면 000660 → 005930(삼성전자) → 035420(네이버) → 035720(카카오).
            // 이름 순: 네이버 → 삼성전자 → 카카오 (ko collation은 한글이 라틴 앞).
            expect(items.map(i => i.label)).toEqual([
                '네이버 (035420.KS)',
                '삼성전자 (005930.KS)',
                '카카오 (035720.KS)',
                'SK하이닉스 (000660.KS)',
            ]);
        });

        it('이름을 모르는 종목은 티커를 이름처럼 써서 정렬한다', () => {
            const items = kr(
                new Map([
                    ['005930.KS', '삼성전자'],
                    ['035720.KS', '카카오'],
                ]),
                'ko-KR'
            );
            // 이름 없는 000660·035420은 숫자 티커라 한글 앞에, 티커 순으로 온다.
            expect(items.map(i => i.symbol)).toEqual([
                '000660.KS',
                '035420.KS',
                '005930.KS',
                '035720.KS',
            ]);
        });

        it('en: 영문 이름 순으로 정렬한다', () => {
            const items = kr(
                new Map([
                    ['005930.KS', 'Samsung Electronics'],
                    ['000660.KS', 'SK Hynix'],
                    ['035420.KS', 'Naver'],
                    ['035720.KS', 'Kakao'],
                ]),
                'en-US'
            );
            expect(items.map(i => i.label)).toEqual([
                'Kakao (035720.KS)',
                'Naver (035420.KS)',
                'Samsung Electronics (005930.KS)',
                'SK Hynix (000660.KS)',
            ]);
        });

        it('대소문자를 무시하고 숫자는 숫자 크기로 비교한다', () => {
            const [us] = buildSymbolDirectory(
                new Map([
                    [POPULAR_TICKERS[0], 'b item 10'],
                    [POPULAR_TICKERS[1], 'B item 9'],
                    [POPULAR_TICKERS[2], 'a item'],
                ]),
                'en-US'
            );
            const order = us.items
                .map(i => i.label)
                .filter(label => /item/.test(label));
            expect(order).toEqual([
                `a item (${POPULAR_TICKERS[2]})`,
                `B item 9 (${POPULAR_TICKERS[1]})`,
                `b item 10 (${POPULAR_TICKERS[0]})`,
            ]);
        });

        it('같은 이름이면 티커로 결정론적으로 가른다', () => {
            const [us] = buildSymbolDirectory(
                new Map([
                    ['MSFT', '같은이름'],
                    ['AAPL', '같은이름'],
                ]),
                'ko-KR'
            );
            const same = us.items
                .filter(i => i.label.startsWith('같은이름'))
                .map(i => i.symbol);
            expect(same).toEqual(['AAPL', 'MSFT']);
        });
    });
});
