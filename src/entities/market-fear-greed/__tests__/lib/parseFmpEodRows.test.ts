import { describe, it, expect } from 'vitest';
import {
    parseCryptoBarRows,
    parseDailyCloseRows,
    priceSourceFor,
} from '../../lib/parseFmpEodRows';

describe('priceSourceFor', () => {
    it('^ 지수 심볼은 light 엔드포인트의 price를 읽는다', () => {
        expect(priceSourceFor('^VIX')).toEqual({
            endpoint: 'historical-price-eod/light',
            field: 'price',
        });
    });

    it('ETF 심볼은 dividend-adjusted 엔드포인트의 adjClose를 읽는다', () => {
        expect(priceSourceFor('HYG')).toEqual({
            endpoint: 'historical-price-eod/dividend-adjusted',
            field: 'adjClose',
        });
    });
});

describe('parseDailyCloseRows', () => {
    it('지정한 필드를 close로 매핑한다', () => {
        expect(
            parseDailyCloseRows(
                [{ date: '2024-01-02', price: 17.8, adjClose: 999 }],
                'price'
            )
        ).toEqual([{ date: '2024-01-02', close: 17.8 }]);
    });

    it.each([null, undefined, '100', Number.NaN, 0, -5])(
        '종가가 %p인 행은 버린다',
        value => {
            expect(
                parseDailyCloseRows(
                    [{ date: '2024-01-02', adjClose: value }],
                    'adjClose'
                )
            ).toEqual([]);
        }
    );

    it('날짜가 문자열이 아닌 행은 버린다', () => {
        expect(
            parseDailyCloseRows([{ date: 20240102, adjClose: 1 }], 'adjClose')
        ).toEqual([]);
    });

    it('null 원소는 조용히 버리지 않고 던진다 — fetch가 reject해 캐시에 쓰지 않는다', () => {
        expect(() =>
            parseDailyCloseRows(
                [null, { date: '2024-01-03', adjClose: 2 }],
                'adjClose'
            )
        ).toThrow(TypeError);
    });

    it('문자열·숫자 원소는 속성이 없어 버려진다', () => {
        expect(
            parseDailyCloseRows(
                ['row', 3, { date: '2024-01-03', adjClose: 2 }],
                'adjClose'
            )
        ).toEqual([{ date: '2024-01-03', close: 2 }]);
    });

    it('배열이 아닌 응답은 빈 배열이다', () => {
        expect(parseDailyCloseRows({ error: 'x' }, 'adjClose')).toEqual([]);
    });
});

describe('parseCryptoBarRows', () => {
    it('close와 volume을 매핑하고 나머지 필드는 버린다', () => {
        expect(
            parseCryptoBarRows([
                { date: '2026-09-24', close: 10, volume: 5, open: 1 },
            ])
        ).toEqual([{ date: '2026-09-24', close: 10, volume: 5 }]);
    });

    it.each([null, undefined, '5', Number.NaN, 0, -1])(
        '거래량이 %p이면 0으로 두고 행은 남긴다',
        volume => {
            expect(
                parseCryptoBarRows([{ date: '2026-09-24', close: 10, volume }])
            ).toEqual([{ date: '2026-09-24', close: 10, volume: 0 }]);
        }
    );

    it.each([null, 0, -1, Number.NaN, '10'])(
        '종가가 %p인 행은 버린다',
        close => {
            expect(
                parseCryptoBarRows([{ date: '2026-09-24', close, volume: 5 }])
            ).toEqual([]);
        }
    );

    it('null 원소는 던진다', () => {
        expect(() => parseCryptoBarRows([null])).toThrow(TypeError);
    });

    it('배열이 아닌 응답은 빈 배열이다', () => {
        expect(parseCryptoBarRows({ 'Error Message': 'limit' })).toEqual([]);
    });
});
