import { describe, expect, it } from 'vitest';
import {
    classifyFmpSymbolMapping,
    planAssetTranslationCleanup,
    planOrphanedKoreanTickers,
} from '../assetTranslationMismatch';

describe('classifyFmpSymbolMapping', () => {
    it('같은 심볼은 same', () => {
        expect(classifyFmpSymbolMapping('AAPL', 'AAPL')).toBe('same');
    });

    it('클래스 주식 dot→hyphen 정규화는 정당한 차이다 (별칭 맵 안팎 모두)', () => {
        expect(classifyFmpSymbolMapping('BRK.B', 'BRK-B')).toBe('class-share');
        expect(classifyFmpSymbolMapping('BF.B', 'BF-B')).toBe('class-share');
        expect(classifyFmpSymbolMapping('HEI.A', 'HEI-A')).toBe('class-share');
    });

    it('^ 지수 심볼은 정당한 차이다', () => {
        expect(classifyFmpSymbolMapping('SPX', '^SPX')).toBe('index');
        expect(classifyFmpSymbolMapping('VIX', '^VIX')).toBe('index');
    });

    it('옛 첫 US 행 폴백이 만든 매핑은 mismatch', () => {
        expect(classifyFmpSymbolMapping('VIX', 'VIXM')).toBe('mismatch');
        expect(classifyFmpSymbolMapping('APPL', 'APPLX')).toBe('mismatch');
        expect(classifyFmpSymbolMapping('AST', 'ASTI')).toBe('mismatch');
        // 점 포함이어도 정규화 결과와 다르면 mismatch다.
        expect(classifyFmpSymbolMapping('HEI.A', 'HEIA')).toBe('mismatch');
    });
});

describe('planAssetTranslationCleanup', () => {
    it('종류별로 세고 삭제 대상만 정렬해 돌려준다', () => {
        const plan = planAssetTranslationCleanup([
            { symbol: 'VIX', fmpSymbol: 'VIXM' },
            { symbol: 'BRK.B', fmpSymbol: 'BRK-B' },
            { symbol: 'APPL', fmpSymbol: 'APPLX' },
            { symbol: 'SPX', fmpSymbol: '^SPX' },
            { symbol: 'AAPL', fmpSymbol: 'AAPL' },
        ]);
        expect(plan).toEqual({
            scanned: 5,
            classShare: 1,
            index: 1,
            mismatched: ['APPL', 'VIX'],
        });
    });
});

describe('planOrphanedKoreanTickers', () => {
    it('잘못된 매핑이 쓴(영문명이 같은) korean_tickers 행만 고르고, 다른 경로가 다시 쓴 행은 남긴다', () => {
        const plan = planOrphanedKoreanTickers(
            [
                { symbol: 'APPL', name: 'Apple Hospitality Fund' },
                { symbol: 'VIX', name: 'ProShares VIX Mid-Term Futures ETF' },
            ],
            [
                { symbol: 'APPL', name: 'Apple Hospitality Fund' },
                { symbol: 'VIX', name: 'CBOE Volatility Index' },
                // 잘못된 매핑과 무관한 심볼은 이름이 같아도 건드리지 않는다.
                { symbol: 'APPLX', name: 'Apple Hospitality Fund' },
            ]
        );
        expect(plan).toEqual({ orphaned: ['APPL'], keptDifferentName: 1 });
    });
});
