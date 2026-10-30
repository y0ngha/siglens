import { CANONICAL_KOREAN_NAMES } from '@/shared/config/canonical-korean-names';
import type { KoreanTickerEntry } from '@/shared/lib/types';
import {
    koreanEntryToSearchResult,
    matchKoreanNameQuery,
    pickListedKrSuffix,
    siblingKrSymbol,
    toKoreanNameMap,
    toSearchableEntry,
    toTickerDisplayNames,
    withCanonical,
} from '../koreanNameSearch';

function entry(
    symbol: string,
    koreanName: string,
    name = symbol
): KoreanTickerEntry {
    return {
        symbol,
        name,
        koreanName,
        exchange: 'NASDAQ',
        exchangeFullName: 'NASDAQ Global Select',
    };
}

const [canonicalSymbol, canonicalName] = [...CANONICAL_KOREAN_NAMES][0];

describe('withCanonical', () => {
    it('정본이 없으면 같은 객체를 돌려준다', () => {
        const e = entry('ZZZZ_NO_CANON', '제드');

        expect(withCanonical(e)).toBe(e);
    });

    it('정본이 있으면 한글명만 덮는다', () => {
        expect(
            withCanonical(entry(canonicalSymbol, '틀린이름', 'Orig'))
        ).toEqual({ ...entry(canonicalSymbol, canonicalName, 'Orig') });
    });
});

describe('koreanEntryToSearchResult', () => {
    it('국내 심볼에는 marketProfile kr-equity를 싣는다', () => {
        expect(
            koreanEntryToSearchResult(entry('005930.KS', '삼성전자'))
                .marketProfile
        ).toBe('kr-equity');
    });

    it('미국 심볼에는 marketProfile을 싣지 않는다', () => {
        expect(
            koreanEntryToSearchResult(entry('AAPL', '애플'))
        ).not.toHaveProperty('marketProfile');
    });

    it('검색 키 같은 내부 필드는 밖으로 내지 않는다', () => {
        expect(
            koreanEntryToSearchResult(toSearchableEntry(entry('AAPL', '애플')))
        ).not.toHaveProperty('searchNames');
    });
});

describe('matchKoreanNameQuery', () => {
    const entries = [
        toSearchableEntry(entry('AAPL', '애플', 'Apple Inc.')),
        toSearchableEntry(entry('LAES', '실스큐', 'SEALSQ Corp')),
        toSearchableEntry(
            entry('005930.KS', '삼성전자', 'Samsung Electronics')
        ),
    ];

    it('부분 문자열로 한글명을 찾는다', () => {
        expect(
            matchKoreanNameQuery(entries, '삼성').map(r => r.symbol)
        ).toEqual(['005930.KS']);
    });

    it('공백만 있는 질의는 아무것도 고르지 않는다', () => {
        expect(matchKoreanNameQuery(entries, '   ')).toEqual([]);
    });

    it('한글·영문이 섞인 질의는 토막별로 맞춘다', () => {
        expect(
            matchKoreanNameQuery(entries, '실 SEAL').map(r => r.symbol)
        ).toEqual(['LAES']);
    });

    it('영문 토막이 맞지 않으면 한글 토막이 맞아도 제외한다', () => {
        expect(matchKoreanNameQuery(entries, '실 ZZZ')).toEqual([]);
    });
});

describe('toTickerDisplayNames', () => {
    it('행이 있으면 한글명과 영문명을 함께 내보낸다', () => {
        expect(
            toTickerDisplayNames(
                ['AAPL'],
                [entry('AAPL', '애플', 'Apple Inc.')]
            )
        ).toEqual({ AAPL: { koreanName: '애플', name: 'Apple Inc.' } });
    });

    it('행이 없는 정본 심볼은 정본 한글명만 내보낸다', () => {
        expect(toTickerDisplayNames([canonicalSymbol], [])).toEqual({
            [canonicalSymbol]: { koreanName: canonicalName, name: null },
        });
    });

    it('이름이 하나도 없는 심볼은 키를 뺀다', () => {
        expect(toTickerDisplayNames(['ZZZZ_NO_CANON'], [])).toEqual({});
    });
});

describe('toKoreanNameMap', () => {
    it('저장된 한글명을 심볼별로 매핑한다', () => {
        expect(
            toKoreanNameMap(['AAPL', 'MSFT'], [entry('AAPL', '애플')])
        ).toEqual({ AAPL: '애플' });
    });

    it('정본이 저장된 이름을 덮는다', () => {
        expect(
            toKoreanNameMap([canonicalSymbol], [entry(canonicalSymbol, '틀림')])
        ).toEqual({ [canonicalSymbol]: canonicalName });
    });
});

describe('siblingKrSymbol / pickListedKrSuffix', () => {
    it('.KS의 짝은 .KQ이고 .KQ의 짝은 .KS다', () => {
        expect(siblingKrSymbol('253450.KS')).toBe('253450.KQ');
        expect(siblingKrSymbol('253450.KQ')).toBe('253450.KS');
    });

    it('요청 심볼의 행이 없고 짝의 행만 있으면 짝을 고른다', () => {
        expect(
            pickListedKrSuffix('253450.KS', '253450.KQ', [
                entry('253450.KQ', '스튜디오드래곤'),
            ])
        ).toBe('253450.KQ');
    });

    it('요청 심볼의 행이 있으면 짝이 있어도 그대로 둔다', () => {
        expect(
            pickListedKrSuffix('253450.KS', '253450.KQ', [
                entry('253450.KS', 'a'),
                entry('253450.KQ', 'b'),
            ])
        ).toBe('253450.KS');
    });
});
