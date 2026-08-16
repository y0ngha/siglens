import { describe, it, expect } from 'vitest';
import { getDescriptor, marketProfileOf, isKrEquitySymbol } from '../registry';
import { isAdmissibleSymbolShape, KR_SYMBOL_RE } from '@/shared/config/ticker';

describe('kr-equity market profile', () => {
    describe('descriptor', () => {
        const d = getDescriptor('kr-equity');

        it('formats prices as whole KRW', () => {
            expect(d.priceFormat.currency).toBe('KRW');
            expect(d.priceFormat.precision).toEqual({ kind: 'integer' });
            expect(d.priceFormat.locale).toBe('ko-KR');
        });

        it('routes to the yahoo provider and naver news', () => {
            expect(d.dataProvider).toBe('yahoo');
            expect(d.newsSource).toBe('naver');
            expect(d.searchSource).toBe('kr-store');
        });

        it('passes the canonical symbol straight through to the provider', () => {
            expect(d.toProviderSymbol('005930.KS')).toBe('005930.KS');
        });

        it('excludes options and congress tabs', () => {
            // 개별주식옵션은 국내 유동성이 없고, 공직자 백지신탁은 API가 존재하지 않는다.
            expect(d.tabs).not.toContain('options');
            expect(d.tabs).not.toContain('congress');
            expect(d.tabs).toEqual([
                'chart',
                'news',
                'fundamental',
                'financials',
                'fear-greed',
                'overall',
                'position',
            ]);
        });

        it('omits 4Hour — yahoo chart has no 4h interval', () => {
            expect(d.allowedTimeframes).toEqual([
                '5Min',
                '15Min',
                '30Min',
                '1Hour',
                '1Day',
            ]);
            expect(d.defaultTimeframe).toBe('1Day');
        });
    });

    describe('isKrEquitySymbol', () => {
        it.each(['005930.KS', '247540.KQ', '000660.KS'])(
            'accepts %s',
            symbol => {
                expect(isKrEquitySymbol(symbol)).toBe(true);
            }
        );

        it('normalizes case before matching', () => {
            expect(isKrEquitySymbol('005930.ks')).toBe(true);
        });

        it.each([
            '005930', // 접미사 없음 — 거래소를 알 수 없다
            '05930.KS', // 5자리
            '0059300.KS', // 7자리
            'AAPL.KS', // 종목코드가 숫자가 아님
            '005930.KX', // 알 수 없는 거래소
            'AAPL',
            'BTCUSD',
        ])('rejects %s', symbol => {
            expect(isKrEquitySymbol(symbol)).toBe(false);
        });

        it('survives a partial AssetInfo with no symbol', () => {
            // 캐시·DB에서 되살아난 부분 객체가 실제로 이 경로에 닿는다(useChat의 assetInfo 등).
            // 크래시 대신 false로 떨어져야 한다.
            expect(isKrEquitySymbol(undefined as unknown as string)).toBe(
                false
            );
            expect(marketProfileOf({ name: 'Apple Inc.' } as never)).toBe(
                'us-equity'
            );
        });

        it('never overlaps with US dual-class shapes', () => {
            // KR_SYMBOL_RE와 미국 클래스 구분자 규칙의 교집합이 공집합임을 고정한다.
            expect(KR_SYMBOL_RE.test('BRK.B')).toBe(false);
            expect(isKrEquitySymbol('BRK.B')).toBe(false);
        });
    });

    describe('isAdmissibleSymbolShape', () => {
        it('admits Korean symbols despite the US-only dot-suffix allowlist', () => {
            // `.KS`/`.KQ`는 SUPPORTED_DOT_SUFFIXES에 없다 — 해외 거래소 접미사 차단을
            // 깨지 않기 위해 별도 정규식으로 통과시킨다.
            expect(isAdmissibleSymbolShape('005930.KS')).toBe(true);
            expect(isAdmissibleSymbolShape('247540.KQ')).toBe(true);
        });

        it('still blocks other foreign exchange suffixes', () => {
            expect(isAdmissibleSymbolShape('SHOP.TO')).toBe(false);
            expect(isAdmissibleSymbolShape('HVO.L')).toBe(false);
        });

        it('still admits US shapes', () => {
            expect(isAdmissibleSymbolShape('AAPL')).toBe(true);
            expect(isAdmissibleSymbolShape('BRK.B')).toBe(true);
        });
    });

    describe('marketProfileOf', () => {
        it('honours an explicit marketProfile', () => {
            expect(
                marketProfileOf({
                    symbol: '005930.KS',
                    name: 'Samsung',
                    marketProfile: 'kr-equity',
                })
            ).toBe('kr-equity');
        });

        it('recovers kr-equity from symbol shape when the field is absent', () => {
            // 캐시에 남은 구버전 레코드나 marketProfile을 채우지 않는 경로(DB 조회 결과)가
            // us-equity로 오분류되면 KRW 포맷·KST 세션·탭 구성이 전부 어긋난다.
            expect(
                marketProfileOf({ symbol: '005930.KS', name: 'Samsung' })
            ).toBe('kr-equity');
        });

        it('leaves US symbols on the default profile', () => {
            expect(marketProfileOf({ symbol: 'AAPL', name: 'Apple' })).toBe(
                'us-equity'
            );
        });
    });
});
