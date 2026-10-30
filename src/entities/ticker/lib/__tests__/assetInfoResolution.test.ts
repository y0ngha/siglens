import { CANONICAL_KOREAN_NAMES } from '@/shared/config/canonical-korean-names';
import {
    recordToAssetInfo,
    reusableKoreanName,
    withCanonicalKoreanName,
} from '../assetInfoResolution';

const [canonicalSymbol, canonicalName] = [...CANONICAL_KOREAN_NAMES][0];

describe('recordToAssetInfo', () => {
    it('FMP 심볼이 정본과 같으면 fmpSymbol을 싣지 않는다', () => {
        expect(
            recordToAssetInfo({
                symbol: 'AAPL',
                name: 'Apple Inc.',
                koreanName: '애플',
                fmpSymbol: 'AAPL',
            })
        ).toEqual({ symbol: 'AAPL', name: 'Apple Inc.', koreanName: '애플' });
    });

    it('FMP 심볼이 정본과 다르면 fmpSymbol을 싣는다', () => {
        expect(
            recordToAssetInfo({
                symbol: 'VIX',
                name: 'CBOE Volatility Index',
                koreanName: '변동성 지수',
                fmpSymbol: '^VIX',
            })
        ).toEqual({
            symbol: 'VIX',
            name: 'CBOE Volatility Index',
            koreanName: '변동성 지수',
            fmpSymbol: '^VIX',
        });
    });
});

describe('withCanonicalKoreanName', () => {
    it('null은 그대로 돌려준다', () => {
        expect(withCanonicalKoreanName(null)).toBeNull();
    });

    it('정본이 없는 심볼은 같은 객체를 돌려준다', () => {
        const info = {
            symbol: 'ZZZZ_NO_CANON',
            name: 'Zed',
            koreanName: '제드',
        };

        expect(withCanonicalKoreanName(info)).toBe(info);
    });

    it('정본이 있는 심볼은 한글명을 정본으로 덮는다', () => {
        expect(
            withCanonicalKoreanName({
                symbol: canonicalSymbol,
                name: 'X',
                koreanName: '틀린이름',
            })
        ).toEqual({
            symbol: canonicalSymbol,
            name: 'X',
            koreanName: canonicalName,
        });
    });
});

describe('reusableKoreanName', () => {
    it('저장된 한글명이 없으면 재사용하지 않는다', () => {
        expect(
            reusableKoreanName('ZZZZ_NO_CANON', 'Zed Inc', {
                koreanName: null,
                name: 'Zed Inc',
            })
        ).toBeUndefined();
        expect(
            reusableKoreanName('ZZZZ_NO_CANON', 'Zed Inc', undefined)
        ).toBeUndefined();
    });

    it('정규화한 영문명이 같으면 저장된 한글명을 재사용한다', () => {
        expect(
            reusableKoreanName('ZZZZ_NO_CANON', 'Zed Inc.', {
                koreanName: '제드',
                name: 'ZED INC',
            })
        ).toBe('제드');
    });

    it('영문명이 달라졌으면(티커 재할당) 재사용하지 않는다', () => {
        expect(
            reusableKoreanName('ZZZZ_NO_CANON', 'Brand New Corp', {
                koreanName: '제드',
                name: 'Zed Inc',
            })
        ).toBeUndefined();
    });

    it('저장된 영문명이 없으면 비교 없이 재사용한다', () => {
        expect(
            reusableKoreanName('ZZZZ_NO_CANON', 'Zed Inc', {
                koreanName: '제드',
                name: null,
            })
        ).toBe('제드');
    });

    it('정본 심볼은 영문명이 달라도 재사용한다', () => {
        expect(
            reusableKoreanName(canonicalSymbol, 'Totally Different', {
                koreanName: canonicalName,
                name: 'Old Name',
            })
        ).toBe(canonicalName);
    });
});
