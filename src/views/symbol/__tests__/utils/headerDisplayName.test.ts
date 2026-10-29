import { describe, expect, it } from 'vitest';
import type { AssetInfo } from '@/shared/lib/types';
import { resolveHeaderDisplayName } from '../../utils/headerDisplayName';

function asset(name: string, koreanName?: string): AssetInfo {
    return { symbol: 'AAPL', name, koreanName } as AssetInfo;
}

describe('resolveHeaderDisplayName', () => {
    it('자산 정보가 없으면 티커만 남긴다', () => {
        expect(resolveHeaderDisplayName(undefined, 'AAPL', 'ko')).toEqual({
            koreanName: null,
            companyName: null,
            watchlistLabel: 'AAPL',
        });
    });

    it('ko는 한국어명을 앞세우고 영문명도 함께 둔다', () => {
        expect(
            resolveHeaderDisplayName(asset('Apple Inc.', '애플'), 'AAPL', 'ko')
        ).toEqual({
            koreanName: '애플',
            companyName: 'Apple Inc.',
            watchlistLabel: '애플',
        });
    });

    it('비-ko는 영문명이 있으면 한국어명을 앞세우지 않는다', () => {
        expect(
            resolveHeaderDisplayName(asset('Apple Inc.', '애플'), 'AAPL', 'en')
        ).toEqual({
            koreanName: null,
            companyName: 'Apple Inc.',
            watchlistLabel: 'Apple Inc.',
        });
    });

    it('비-ko라도 영문명이 티커뿐이면 한국어명으로 폴백한다', () => {
        expect(
            resolveHeaderDisplayName(asset('AAPL', '애플'), 'AAPL', 'en')
        ).toEqual({
            koreanName: '애플',
            companyName: null,
            watchlistLabel: '애플',
        });
    });

    it('한국어명이 없으면 영문명이 표시명이다', () => {
        expect(
            resolveHeaderDisplayName(asset('Apple Inc.'), 'AAPL', 'ko')
        ).toEqual({
            koreanName: null,
            companyName: 'Apple Inc.',
            watchlistLabel: 'Apple Inc.',
        });
    });
});
