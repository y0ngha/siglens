import {
    shouldShowAdBanner,
    AD_SLOT_ID,
    type AdBannerSlot,
} from '@/components/analysis/AdBanner';

describe('shouldShowAdBanner', () => {
    it('isFreeUser=true이고 publisherId가 있으면 광고를 표시한다', () => {
        expect(shouldShowAdBanner(true, 'ca-pub-1234567890')).toBe(true);
    });

    it('isFreeUser=false이면 광고를 표시하지 않는다 (Pro 사용자)', () => {
        expect(shouldShowAdBanner(false, 'ca-pub-1234567890')).toBe(false);
    });

    it('publisherId가 빈 문자열이면 광고를 표시하지 않는다 (환경 변수 미설정)', () => {
        expect(shouldShowAdBanner(true, '')).toBe(false);
    });

    it('isFreeUser=false이고 publisherId도 없으면 광고를 표시하지 않는다', () => {
        expect(shouldShowAdBanner(false, '')).toBe(false);
    });
});

describe('AD_SLOT_ID', () => {
    it('analysis-progress 슬롯 키가 존재한다', () => {
        const slot: AdBannerSlot = 'analysis-progress';
        expect(Object.prototype.hasOwnProperty.call(AD_SLOT_ID, slot)).toBe(
            true
        );
    });

    it('analysis-panel-bottom 슬롯 키가 존재한다', () => {
        const slot: AdBannerSlot = 'analysis-panel-bottom';
        expect(Object.prototype.hasOwnProperty.call(AD_SLOT_ID, slot)).toBe(
            true
        );
    });

    it('정확히 두 가지 슬롯이 정의되어 있다', () => {
        expect(Object.keys(AD_SLOT_ID)).toHaveLength(2);
    });
});
