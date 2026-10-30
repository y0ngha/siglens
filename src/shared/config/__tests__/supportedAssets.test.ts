import {
    missingAssetMentions,
    SUPPORTED_ASSET_IDS,
} from '@/shared/config/supportedAssets';

describe('SUPPORTED_ASSET_IDS', () => {
    it('자산군 세 개를 선언 순서대로 담는다', () => {
        expect(SUPPORTED_ASSET_IDS).toEqual(['usEquity', 'krEquity', 'crypto']);
    });
});

describe('missingAssetMentions', () => {
    it('모든 자산군을 언급하면 빈 배열이다', () => {
        expect(
            missingAssetMentions('미국 주식, 코스피 종목, 비트코인 분석')
        ).toEqual([]);
    });

    it('언급하지 않은 자산군만 돌려준다', () => {
        expect(missingAssetMentions('미국 주식과 비트코인')).toEqual([
            'krEquity',
        ]);
    });

    it('아무것도 언급하지 않으면 전부 돌려준다', () => {
        expect(missingAssetMentions('주가 분석')).toEqual([
            'usEquity',
            'krEquity',
            'crypto',
        ]);
    });

    it('`미국, 한국 주식`은 미국·한국 주식을 함께 충족한다', () => {
        expect(missingAssetMentions('미국, 한국 주식과 암호화폐')).toEqual([]);
    });
});
