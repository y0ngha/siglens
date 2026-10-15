import { describe, it, expect } from 'vitest';
import {
    EXTENDED_BARS_LOOKBACK_DAYS,
    extendedBarsFrom,
    parseExtendedBarsRequest,
} from '@/entities/extended-bars/lib/extendedBarsRequest';
import { EXTENDED_BAR_TIMEFRAMES } from '@/shared/api/market/extendedBarsSession';
import { MS_PER_DAY } from '@/shared/config/time';

describe('parseExtendedBarsRequest', () => {
    it('심볼을 대문자로 정규화하고 인트라데이 타임프레임을 받는다', () => {
        expect(parseExtendedBarsRequest('aapl', '5Min', undefined)).toEqual({
            ticker: 'AAPL',
            timeframe: '5Min',
        });
    });

    it.each(EXTENDED_BAR_TIMEFRAMES)('%s는 받는다', timeframe => {
        expect(
            parseExtendedBarsRequest('AAPL', timeframe, undefined)?.timeframe
        ).toBe(timeframe);
    });

    it('1Day는 받지 않는다(일봉 엔드포인트는 extended를 무시한다)', () => {
        expect(parseExtendedBarsRequest('AAPL', '1Day', undefined)).toBeNull();
    });

    it.each([['1Min'], [''], [5], [null], [undefined], ['5min']])(
        '알 수 없는 타임프레임(%s)은 받지 않는다',
        timeframe => {
            expect(
                parseExtendedBarsRequest('AAPL', timeframe, undefined)
            ).toBeNull();
        }
    );

    it.each([
        [42],
        [null],
        [undefined],
        [{}],
        ['A'.repeat(17)],
        [''],
        ['AA PL'],
        ['^SPX'],
        ['../etc'],
    ])('잘못된 심볼(%s)은 받지 않는다', symbol => {
        expect(parseExtendedBarsRequest(symbol, '5Min', undefined)).toBeNull();
    });

    it('형식이 맞는 fmpSymbol이 와도 결과에 싣지 않는다(조회 심볼은 서버가 푼 자산이 정한다)', () => {
        expect(parseExtendedBarsRequest('BRKB', '5Min', 'brk-b')).toEqual({
            ticker: 'BRKB',
            timeframe: '5Min',
        });
        expect(
            parseExtendedBarsRequest('BRKB', '5Min', 'brk-b')
        ).not.toHaveProperty('fmpSymbol');
    });

    it.each([['BRK.B'], ['PBR-A'], ['005930.KS']])(
        '페이지와 같은 허용 판정(isAdmissibleSymbolShape)을 쓴다: %s는 받는다',
        symbol => {
            expect(
                parseExtendedBarsRequest(symbol, '5Min', undefined)?.ticker
            ).toBe(symbol);
        }
    );

    it.each([['AAPL.XX'], ['AAPL.']])(
        '지원하지 않는 점 접미사(%s)는 받지 않는다',
        symbol => {
            expect(
                parseExtendedBarsRequest(symbol, '5Min', undefined)
            ).toBeNull();
        }
    );

    it.each([['^SPX'], [42], [null], ['A'.repeat(17)], ['a b']])(
        '형식이 어긋난 fmpSymbol(%s)이 주어지면 요청 전체를 받지 않는다(지수 표기 포함)',
        fmpSymbol => {
            expect(
                parseExtendedBarsRequest('AAPL', '5Min', fmpSymbol)
            ).toBeNull();
        }
    );
});

describe('extendedBarsFrom', () => {
    const now = new Date('2026-10-15T12:00:00Z');

    it.each(EXTENDED_BAR_TIMEFRAMES)(
        '%s: 조회 창만큼 거슬러 UTC 자정 ISO 문자열이다',
        timeframe => {
            const expected = new Date(
                now.getTime() -
                    EXTENDED_BARS_LOOKBACK_DAYS[timeframe] * MS_PER_DAY
            )
                .toISOString()
                .slice(0, 10);
            expect(extendedBarsFrom(timeframe, now)).toBe(
                `${expected}T00:00:00Z`
            );
        }
    );

    it('5분봉은 10일, 4시간봉은 200일(정규장 봉 창과 같다)', () => {
        expect(extendedBarsFrom('5Min', now)).toBe('2026-10-05T00:00:00Z');
        expect(extendedBarsFrom('4Hour', now)).toBe('2026-03-29T00:00:00Z');
    });
});
