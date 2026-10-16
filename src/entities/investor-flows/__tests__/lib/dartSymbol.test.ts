import { describe, expect, it } from 'vitest';
import {
    buildKrDartUniverse,
    commonShareCandidates,
    krSymbolToStockCode,
    resolveDartCorp,
} from '../../lib/dartSymbol';

/** `dart_corp_code` 일부(대표 종목코드만 실린다 — 우선주 없음). */
const CORP_BY_STOCK = new Map([
    ['005930', '00126380'], // 삼성전자
    ['005380', '00164742'], // 현대차
    ['000880', '00160843'], // 한화
    ['0001A0', '01799999'], // 덕양에너젠(영문 섞인 신규 코드)
    ['000660', '00164779'], // SK하이닉스
]);

describe('krSymbolToStockCode', () => {
    it.each([
        ['005930.KS', '005930'],
        ['035720.KQ', '035720'],
        ['0001a0.kq', '0001A0'],
        ['00088K.KS', '00088K'],
    ])('%s → %s', (symbol, expected) => {
        expect(krSymbolToStockCode(symbol)).toBe(expected);
    });

    it.each(['AAPL', 'BRK.B', '005930', '005930.KX', '5930.KS'])(
        '%s is not a KR symbol',
        symbol => {
            expect(krSymbolToStockCode(symbol)).toBeNull();
        }
    );
});

describe('commonShareCandidates', () => {
    it('is the code itself for a common share (last char 0)', () => {
        expect(commonShareCandidates('005930')).toEqual(['005930']);
        expect(commonShareCandidates('0001A0')).toEqual(['0001A0']);
    });

    it.each([
        ['005935', '005930'], // 삼성전자우
        ['005387', '005380'], // 현대차2우B
        ['005389', '005380'], // 현대차3우B
        ['00088K', '000880'], // 한화3우B(신형 우선주)
    ])('preferred %s also tries the common code %s', (code, common) => {
        expect(commonShareCandidates(code)).toEqual([code, common]);
    });
});

describe('resolveDartCorp', () => {
    it('matches a common share directly', () => {
        expect(resolveDartCorp('005930', CORP_BY_STOCK)).toEqual({
            corpCode: '00126380',
            matchedStockCode: '005930',
            viaCommonShare: false,
        });
    });

    it.each([
        ['005935', '005930', '00126380'],
        ['005387', '005380', '00164742'],
        ['00088K', '000880', '00160843'],
    ])('maps preferred %s through common %s', (code, common, corp) => {
        expect(resolveDartCorp(code, CORP_BY_STOCK)).toEqual({
            corpCode: corp,
            matchedStockCode: common,
            viaCommonShare: true,
        });
    });

    it('prefers an exact match even when the last char is not 0', () => {
        const map = new Map([
            ['0220WL', '01111111'],
            ['0220W0', '02222222'],
        ]);
        expect(resolveDartCorp('0220WL', map)?.corpCode).toBe('01111111');
    });

    it('does not guess when neither the code nor its common code exists (ETF, unknown)', () => {
        expect(resolveDartCorp('069500', CORP_BY_STOCK)).toBeNull(); // KODEX 200 — ETF, not in corpCode
        expect(resolveDartCorp('123455', CORP_BY_STOCK)).toBeNull();
    });

    it('applies the same last-char rule to new-format (letter) codes', () => {
        expect(resolveDartCorp('0001A5', CORP_BY_STOCK)).toEqual({
            corpCode: '01799999',
            matchedStockCode: '0001A0',
            viaCommonShare: true,
        });
    });
});

describe('buildKrDartUniverse', () => {
    it('groups common and preferred symbols under one corp, sorted by corp code', () => {
        const universe = buildKrDartUniverse(
            [
                '005935.KS',
                '005930.KS',
                '00088K.KS',
                '000880.KS',
                '069500.KS',
                '0001A0.KQ',
                'AAPL',
            ],
            CORP_BY_STOCK
        );
        expect(universe.corpCodes).toEqual([
            '00126380',
            '00160843',
            '01799999',
        ]);
        expect(Object.fromEntries(universe.symbolsByCorp)).toEqual({
            '00126380': ['005935.KS', '005930.KS'],
            '00160843': ['00088K.KS', '000880.KS'],
            '01799999': ['0001A0.KQ'],
        });
        expect(universe.unmappedSymbols).toEqual(['069500.KS', 'AAPL']);
    });

    it('is empty without symbols', () => {
        expect(buildKrDartUniverse([], CORP_BY_STOCK)).toEqual({
            corpCodes: [],
            symbolsByCorp: new Map(),
            unmappedSymbols: [],
        });
    });
});
