import {
    ASSET_INFO_SEED_UPDATED_AT,
    assetInfoSeedUpdatedAt,
} from '@/shared/config/assetInfoSeed';

describe('assetInfoSeedUpdatedAt', () => {
    it('정상 조회된 시드는 resolved 값을 돌려준다', () => {
        expect(assetInfoSeedUpdatedAt(false)).toBe(
            ASSET_INFO_SEED_UPDATED_AT.resolved
        );
    });

    it('폴백으로 푼 시드는 degraded 값을 돌려준다', () => {
        expect(assetInfoSeedUpdatedAt(true)).toBe(
            ASSET_INFO_SEED_UPDATED_AT.degraded
        );
    });

    it('두 값이 서로 다르다 — 클라이언트가 시드 성격을 구분한다', () => {
        expect(ASSET_INFO_SEED_UPDATED_AT.resolved).not.toBe(
            ASSET_INFO_SEED_UPDATED_AT.degraded
        );
    });
});
